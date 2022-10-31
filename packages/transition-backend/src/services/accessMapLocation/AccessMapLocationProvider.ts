/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { point as turfPoint } from '@turf/turf';
import proj4 from 'proj4';
import { EventEmitter } from 'events';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { AccessibilityMapLocation } from 'transition-common/lib/services/accessibilityMap/AccessibiltyMapLocation';
import {
    timeStrToSecondsSinceMidnight,
    intTimeToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export interface accessMapLocationOptions {
    projection: string;
    idAttribute: string;
    xAttribute: string;
    yAttribute: string;
    timeAttributeDepartureOrArrival: 'arrival' | 'departure';
    timeFormat: string;
    timeAttribute: string;
}

const extractLocation = (
    line: {
        [key: string]: any;
    },
    options: accessMapLocationOptions,
    projections: any
): AccessibilityMapLocation => {
    const internalId = line[options.idAttribute];
    const location =
        options.projection === '4326'
            ? turfPoint([parseFloat(line[options.xAttribute]), parseFloat(line[options.yAttribute])]).geometry
            : turfPoint(
                proj4(projections[options.projection].value, projections['4326'].value, [
                    parseFloat(line[options.xAttribute]),
                    parseFloat(line[options.yAttribute])
                ])
            ).geometry;

    let time: number | null | undefined = undefined;
    if (options.timeFormat === 'HH:MM') {
        time = timeStrToSecondsSinceMidnight(line[options.timeAttribute]);
    } else if (options.timeFormat === 'HMM') {
        time = intTimeToSecondsSinceMidnight(line[options.timeAttribute]);
    } else {
        time = parseInt(line[options.timeAttribute]);
        time = Number.isNaN(time) ? undefined : time;
    }

    if (_isBlank(time)) {
        throw new TrError(
            'Arrival time or departure time is invalid',
            'AMLOC001',
            'transit:transitRouting:errors:InvalidDepartureOrArrivalTime'
        );
    }

    return {
        id: internalId,
        geography: location,
        timeOfTrip: time as number,
        timeType: options.timeAttributeDepartureOrArrival === 'arrival' ? 'arrival' : 'departure',
        data: line
    };
};

const MAX_ERROR = 10;
const addError = (errors: ErrorMessage[], error: unknown, nbErrors: number, rowNumber: number) => {
    if (nbErrors < MAX_ERROR) {
        if (TrError.isTrError(error)) {
            errors.push({
                text: 'transit:transitRouting:errors:BatchRouteErrorOnLine',
                params: { n: String(rowNumber) }
            });
            errors.push(error.export().localizedMessage);
            console.error(`Error parsing access map location on line ${rowNumber}: ${error.message}`);
        } else {
            errors.push({
                text: 'transit:transitRouting:errors:BatchRouteUnknownErrorOnLine',
                params: { n: String(rowNumber) }
            });
            console.error(`Error parsing access map location on line ${rowNumber}: ${error}`);
        }
    } else if (nbErrors === MAX_ERROR) {
        errors.push('transit:transitRouting:errors:BatchRouteMoreErrors');
    }
};

/**
 * Parses a csv file containing accessibility map locations and times
 *
 * @param {string} csvFilePath The absolute path of the csv file containing the
 * OD trips
 * @param {accessMapLocationOptions} options The attributes mapping the csv
 * fields to the corresponding location fields.
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send
 * progress to
 * @return {*} An array of accessibility map locations contained in the file
 */
export const parseLocationsFromCsv = async (
    csvFilePath: string,
    options: accessMapLocationOptions,
    progressEmitter?: EventEmitter
): Promise<{ locations: AccessibilityMapLocation[]; errors: ErrorMessage[] }> => {
    const locations: AccessibilityMapLocation[] = [];
    const projections = Preferences.get('proj4Projections');
    let nbErrors = 0;
    const errors: ErrorMessage[] = [];

    const status = await parseCsvFile(
        csvFilePath,
        (line, rowNumber) => {
            try {
                const location = extractLocation(line, options, projections);

                console.log(
                    `line ${rowNumber} new location ${location.id} ${
                        location.timeType === 'departure' ? 'dts=' : 'ats='
                    }${location.timeOfTrip}
                           `
                );

                locations.push(location);
            } catch (error) {
                // File has header, row number in file is + 1
                addError(errors, error, nbErrors, rowNumber + 1);

                nbErrors++;
                // For first 100 rows, bailout after 10 errors, otherwise, wait for > 5% errors
                if ((rowNumber < 100 && nbErrors > 10) || (rowNumber > 100 && (nbErrors * 100) / rowNumber > 5)) {
                    errors.unshift('transit:transitRouting:errors:TooManyErrorsParsingFile');
                    throw errors;
                }
            }

            if (rowNumber === 1 || (rowNumber > 0 && rowNumber % 1000 === 0)) {
                progressEmitter?.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: rowNumber });
            }
        },
        { header: true }
    );
    if (status === 'notfound') {
        throw 'CSV file does not exist';
    }

    return { locations, errors };
};
