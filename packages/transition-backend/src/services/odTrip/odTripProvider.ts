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
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import {
    timeStrToSecondsSinceMidnight,
    intTimeToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export interface OdTripOptions {
    projection: string;
    idAttribute: string;
    originXAttribute: string;
    originYAttribute: string;
    destinationXAttribute: string;
    destinationYAttribute: string;
    timeAttributeDepartureOrArrival: 'arrival' | 'departure';
    timeFormat: string;
    timeAttribute: string;
}

const extractOdTrip = (
    line: {
        [key: string]: any;
    },
    options: OdTripOptions,
    projections: any
): BaseOdTrip => {
    const internalId = line[options.idAttribute];
    const originGeography =
        options.projection === '4326'
            ? turfPoint([parseFloat(line[options.originXAttribute]), parseFloat(line[options.originYAttribute])])
                .geometry
            : turfPoint(
                proj4(projections[options.projection].value, projections['4326'].value, [
                    parseFloat(line[options.originXAttribute]),
                    parseFloat(line[options.originYAttribute])
                ])
            ).geometry;
    const destinationGeography =
        options.projection === '4326'
            ? turfPoint([
                parseFloat(line[options.destinationXAttribute]),
                parseFloat(line[options.destinationYAttribute])
            ]).geometry
            : turfPoint(
                proj4(projections[options.projection].value, projections['4326'].value, [
                    parseFloat(line[options.destinationXAttribute]),
                    parseFloat(line[options.destinationYAttribute])
                ])
            ).geometry;

    let arrivalTime: number | null | undefined = undefined;
    let departureTime: number | null | undefined = undefined;
    // set departure or arrival time:
    if (options.timeAttributeDepartureOrArrival === 'arrival') {
        if (options.timeFormat === 'HH:MM') {
            arrivalTime = timeStrToSecondsSinceMidnight(line[options.timeAttribute]);
        } else if (options.timeFormat === 'HMM') {
            arrivalTime = intTimeToSecondsSinceMidnight(line[options.timeAttribute]);
        } else {
            arrivalTime = parseInt(line[options.timeAttribute]);
            arrivalTime = Number.isNaN(arrivalTime) ? undefined : arrivalTime;
        }
    } else {
        if (options.timeFormat === 'HH:MM') {
            departureTime = timeStrToSecondsSinceMidnight(line[options.timeAttribute]);
        } else if (options.timeFormat === 'HMM') {
            departureTime = intTimeToSecondsSinceMidnight(line[options.timeAttribute]);
        } else {
            departureTime = parseInt(line[options.timeAttribute]);
            departureTime = Number.isNaN(departureTime) ? undefined : departureTime;
        }
    }
    if (_isBlank(departureTime) && _isBlank(arrivalTime)) {
        throw new TrError(
            'Arrival time or departure time is invalid',
            'ODTRIP001',
            'transit:transitRouting:errors:InvalidDepartureOrArrivalTime'
        );
    }

    return new BaseOdTrip({
        internal_id: internalId,
        origin_geography: originGeography,
        destination_geography: destinationGeography,
        timeOfTrip: !_isBlank(departureTime) ? (departureTime as number) : (arrivalTime as number),
        timeType: !_isBlank(departureTime) ? 'departure' : 'arrival'
    });
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
            console.error(`Error parsing od Trip on line ${rowNumber}: ${error.message}`);
        } else {
            errors.push({
                text: 'transit:transitRouting:errors:BatchRouteUnknownErrorOnLine',
                params: { n: String(rowNumber) }
            });
            console.error(`Error parsing od Trip on line ${rowNumber}: ${error}`);
        }
    } else if (nbErrors === MAX_ERROR) {
        errors.push('transit:transitRouting:errors:BatchRouteMoreErrors');
    }
};

/**
 * Parses a csv file containing OD trips
 *
 * @param {string} csvFilePath The absolute path of the csv file containing the
 * OD trips
 * @param {OdTripOptions} options The attributes mapping the
 * csv fields to the corresponding od trip fields.
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send
 * progress to
 * @return {*} An array of OD trips contained in the file
 */
export const parseOdTripsFromCsv = async (
    csvFilePath: string,
    options: OdTripOptions,
    progressEmitter?: EventEmitter
): Promise<{ odTrips: BaseOdTrip[]; errors: ErrorMessage[] }> => {
    const odTrips: BaseOdTrip[] = [];
    const projections = Preferences.get('proj4Projections');
    let nbErrors = 0;
    const errors: ErrorMessage[] = [];

    const status = await parseCsvFile(
        csvFilePath,
        (line, rowNumber) => {
            try {
                const odTrip = extractOdTrip(line, options, projections);

                console.log(
                    `line ${rowNumber} new odTrip ${odTrip.attributes.id} ${
                        odTrip.attributes.timeType === 'departure' ? 'dts=' : 'ats='
                    }${odTrip.attributes.timeOfTrip}
                           `
                );

                odTrips.push(odTrip);
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

    return { odTrips, errors };
};
