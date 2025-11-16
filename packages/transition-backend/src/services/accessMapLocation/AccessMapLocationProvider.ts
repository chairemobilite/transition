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
import { parseCsvFile as parseCsvFileFromStream } from 'chaire-lib-common/lib/utils/files/CsvFile';
import fs from 'fs';

import { AccessibilityMapLocation } from 'transition-common/lib/services/accessibilityMap/AccessibiltyMapLocation';
import {
    timeStrToSecondsSinceMidnight,
    intTimeToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import constants from 'chaire-lib-common/lib/config/constants';

export interface accessMapLocationOptions {
    projection: string;
    idAttribute: string;
    xAttribute: string;
    yAttribute: string;
    timeAttributeDepartureOrArrival: 'arrival' | 'departure';
    timeFormat: string;
    timeAttribute: string;
    debug?: boolean;
}

const extractLocation = (
    line: {
        [key: string]: any;
    },
    options: accessMapLocationOptions,
    projection: { srid: number; value: string }
): AccessibilityMapLocation => {
    const internalId = line[options.idAttribute];
    const [locationLat, locationLon] = [parseFloat(line[options.yAttribute]), parseFloat(line[options.xAttribute])];
    if (isNaN(locationLat) || isNaN(locationLon)) {
        throw new TrError(
            'Location coordinates are invalid',
            'ODTRIP002',
            'transit:transitRouting:errors:InvalidLocationCoordinates'
        );
    }
    const location =
        projection.srid === constants.geographicCoordinateSystem.srid
            ? turfPoint([locationLon, locationLat]).geometry
            : turfPoint(proj4(projection.value, constants.geographicCoordinateSystem.value, [locationLon, locationLat]))
                .geometry;

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
        data: {} //TODO This used to contains the whole line, but we should instead have a mechanism to let
        // people tell us explicitily that they want to merge data in the result file.
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
 * Internal function that parses accessibility map locations from a CSV stream
 * This contains the shared logic used by both path-based and stream-based functions
 *
 * @param {NodeJS.ReadableStream} csvStream The stream to parse
 * @param {accessMapLocationOptions} options The attributes mapping the csv fields to the corresponding location fields
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} An array of accessibility map locations contained in the stream
 */
const parseLocationsFromCsvInternal = async (
    csvStream: NodeJS.ReadableStream,
    options: accessMapLocationOptions,
    progressEmitter?: EventEmitter
): Promise<{ locations: AccessibilityMapLocation[]; errors: ErrorMessage[] }> => {
    const locations: AccessibilityMapLocation[] = [];
    const projections = Preferences.get('proj4Projections');
    let nbErrors = 0;
    const errors: ErrorMessage[] = [];

    const projection =
        projections[options.projection] !== undefined
            ? projections[options.projection]
            : constants.geographicCoordinateSystem;
    if (projections[options.projection] === undefined) {
        console.log(
            `Parsing access map locations: unknown projections '${options.projection}' will use default value of ${projection.label}`
        );
    }

    await parseCsvFileFromStream(
        csvStream,
        (line, rowNumber) => {
            try {
                const location = extractLocation(line, options, projection);

                if (options.debug) {
                    console.log(
                        `line ${rowNumber} new location ${location.id} ${
                            location.timeType === 'departure' ? 'dts=' : 'ats='
                        }${location.timeOfTrip}
                            `
                    );
                }

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

    return { locations, errors };
};

/**
 * Parses a csv file containing accessibility map locations and times
 *
 * @param {string} csvFilePath The absolute path of the csv file containing the locations
 * @param {accessMapLocationOptions} options The attributes mapping the csv fields to the corresponding location fields
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} An array of accessibility map locations contained in the file
 */
export const parseLocationsFromCsv = async (
    csvFilePath: string,
    options: accessMapLocationOptions,
    progressEmitter?: EventEmitter
): Promise<{ locations: AccessibilityMapLocation[]; errors: ErrorMessage[] }> => {
    console.log(`parsing csv file ${csvFilePath}...`);

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
        throw 'CSV file does not exist';
    }

    // Create stream and use internal parser
    const csvStream = fs.createReadStream(csvFilePath);

    try {
        const result = await parseLocationsFromCsvInternal(csvStream, options, progressEmitter);
        console.log(`CSV file ${csvFilePath} parsed`);
        return result;
    } catch (error) {
        csvStream.destroy();
        throw error;
    }
};

/**
 * Parses a csv file stream containing accessibility map locations and times
 *
 * @param {fs.ReadStream} csvFileStream The read stream of the csv file containing the locations
 * @param {accessMapLocationOptions} options The attributes mapping the csv fields to the corresponding location fields
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} An array of accessibility map locations contained in the stream
 */
export const parseLocationsFromCsvStream = async (
    csvFileStream: NodeJS.ReadableStream,
    options: accessMapLocationOptions,
    progressEmitter?: EventEmitter
): Promise<{ locations: AccessibilityMapLocation[]; errors: ErrorMessage[] }> => {
    return parseLocationsFromCsvInternal(csvFileStream, options, progressEmitter);
};
