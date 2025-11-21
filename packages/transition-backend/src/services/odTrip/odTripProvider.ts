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

import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import {
    timeStrToSecondsSinceMidnight,
    intTimeToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import constants from 'chaire-lib-common/lib/config/constants';
import { TransitDemandFromCsvRoutingAttributes } from 'transition-common/lib/services/transitDemand/types';

export type OdTripCsvMapping = TransitDemandFromCsvRoutingAttributes & {
    debug?: boolean;
};

const extractOdTrip = (
    line: {
        [key: string]: any;
    },
    mappings: OdTripCsvMapping,
    projection: { srid: number; value: string }
): BaseOdTrip => {
    const internalId = line[mappings.id];
    const [originLat, originLon, destinationLat, destinationLon] = [
        parseFloat(line[mappings.originLat]),
        parseFloat(line[mappings.originLon]),
        parseFloat(line[mappings.destinationLat]),
        parseFloat(line[mappings.destinationLon])
    ];
    if ((isNaN(originLat) || isNaN(originLon)) && (isNaN(destinationLat) || isNaN(destinationLon))) {
        throw new TrError(
            'Origin and destination coordinates are invalid',
            'ODTRIP002',
            'transit:transitRouting:errors:InvalidOriginDestinationCoordinates'
        );
    }
    if (isNaN(originLat) || isNaN(originLon)) {
        throw new TrError(
            'Origin coordinates are invalid',
            'ODTRIP003',
            'transit:transitRouting:errors:InvalidOriginCoordinates'
        );
    }
    if (isNaN(destinationLat) || isNaN(destinationLon)) {
        throw new TrError(
            'Destination coordinates are invalid',
            'ODTRIP004',
            'transit:transitRouting:errors:InvalidDestinationCoordinates'
        );
    }
    const originGeography =
        projection.srid === constants.geographicCoordinateSystem.srid
            ? turfPoint([originLon, originLat]).geometry
            : turfPoint(proj4(projection.value, constants.geographicCoordinateSystem.value, [originLon, originLat]))
                .geometry;
    const destinationGeography =
        projection.srid === constants.geographicCoordinateSystem.srid
            ? turfPoint([destinationLon, destinationLat]).geometry
            : turfPoint(
                proj4(projection.value, constants.geographicCoordinateSystem.value, [destinationLon, destinationLat])
            ).geometry;

    let arrivalTime: number | null | undefined = undefined;
    let departureTime: number | null | undefined = undefined;
    // set departure or arrival time:
    if (mappings.timeType === 'arrival') {
        if (mappings.timeFormat === 'HH:MM') {
            arrivalTime = timeStrToSecondsSinceMidnight(line[mappings.time]);
        } else if (mappings.timeFormat === 'HMM') {
            arrivalTime = intTimeToSecondsSinceMidnight(line[mappings.time]);
        } else {
            arrivalTime = parseInt(line[mappings.time]);
            arrivalTime = Number.isNaN(arrivalTime) ? undefined : arrivalTime;
        }
    } else {
        if (mappings.timeFormat === 'HH:MM') {
            departureTime = timeStrToSecondsSinceMidnight(line[mappings.time]);
        } else if (mappings.timeFormat === 'HMM') {
            departureTime = intTimeToSecondsSinceMidnight(line[mappings.time]);
        } else {
            departureTime = parseInt(line[mappings.time]);
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
 * Internal function that parses OD trips from a CSV stream
 * This contains the shared logic used by both path-based and stream-based functions
 *
 * @param {NodeJS.ReadableStream} csvStream The stream to parse
 * @param {OdTripOptions} options The attributes mapping the csv fields to the corresponding od trip fields
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} An array of OD trips contained in the stream
 */
const parseOdTripsFromCsvInternal = async (
    csvStream: NodeJS.ReadableStream,
    options: OdTripCsvMapping,
    progressEmitter?: EventEmitter
): Promise<{ odTrips: BaseOdTrip[]; errors: ErrorMessage[] }> => {
    const odTrips: BaseOdTrip[] = [];
    const projections = Preferences.get('proj4Projections');
    let nbErrors = 0;
    const errors: ErrorMessage[] = [];

    const projection =
        projections[options.projection] !== undefined
            ? projections[options.projection]
            : constants.geographicCoordinateSystem;
    if (projections[options.projection] === undefined) {
        console.log(
            `Parsing OD trips: unknown projections '${options.projection}' will use default value of ${projection.label}`
        );
    }

    await parseCsvFileFromStream(
        csvStream,
        (line, rowNumber) => {
            try {
                const odTrip = extractOdTrip(line, options, projection);

                if (options.debug) {
                    console.log(
                        `line ${rowNumber} new odTrip ${odTrip.attributes.id}` +
                            `${odTrip.attributes.timeType === 'departure' ? 'dts=' : 'ats='}${odTrip.attributes.timeOfTrip}` +
                            `orig: ${odTrip.attributes.origin_geography.coordinates[0]},${odTrip.attributes.origin_geography.coordinates[1]}` +
                            `dest: ${odTrip.attributes.destination_geography.coordinates[0]},${odTrip.attributes.destination_geography.coordinates[1]}`
                    );
                }

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

    return { odTrips, errors };
};

/**
 * Parses a csv file containing OD trips
 *
 * @param {string} csvFilePath The absolute path of the csv file containing the OD trips
 * @param {OdTripOptions} options The attributes mapping the csv fields to the corresponding od trip fields
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} An array of OD trips contained in the file
 */
export const parseOdTripsFromCsv = async (
    csvFilePath: string,
    options: OdTripCsvMapping,
    progressEmitter?: EventEmitter
): Promise<{ odTrips: BaseOdTrip[]; errors: ErrorMessage[] }> => {
    console.log(`parsing csv file ${csvFilePath}...`);

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
        throw 'CSV file does not exist';
    }

    // Create stream and use internal parser
    const csvStream = fs.createReadStream(csvFilePath);

    try {
        const result = await parseOdTripsFromCsvInternal(csvStream, options, progressEmitter);
        console.log(`CSV file ${csvFilePath} parsed`);
        return result;
    } catch (error) {
        csvStream.destroy();
        throw error;
    }
};

/**
 * Parses a csv file stream containing OD trips
 *
 * @param {fs.ReadStream} csvFileStream The read stream of the csv file containing the OD trips
 * @param {OdTripOptions} options The attributes mapping the csv fields to the corresponding od trip fields
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} An array of OD trips contained in the stream
 */
export const parseOdTripsFromCsvStream = async (
    csvFileStream: NodeJS.ReadableStream,
    options: OdTripCsvMapping,
    progressEmitter?: EventEmitter
): Promise<{ odTrips: BaseOdTrip[]; errors: ErrorMessage[] }> => {
    return parseOdTripsFromCsvInternal(csvFileStream, options, progressEmitter);
};
