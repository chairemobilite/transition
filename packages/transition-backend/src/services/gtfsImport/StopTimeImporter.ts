/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsCsvOptions } from './gtfsCsvOptions';
import { timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsInternalData, StopTimeImportData, StopTime } from './GtfsImportTypes';

import { GtfsObjectPreparator } from './GtfsObjectPreparator';

/**
 * Estimate stop_times row count from the number of trips.
 *
 * US bus stop spacing averages ~313 m (see "Distributions of Bus Stop Spacings
 * in the United States": https://findingspress.org/article/27373-distributions-of-bus-stop-spacings-in-the-united-states).
 * Urban bus routes typically range from 5–20 km, giving roughly 15–65 stops per
 * trip. We use 30 as a conservative midpoint for progress estimation; the exact
 * value only affects progress bar granularity, not correctness.
 */
const estimateStopTimeRows = (tripCount: number): number => Math.max(1, tripCount * 30);

export class StopTimeImporter
implements GtfsObjectPreparator<StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>> {
    private _filePath: string;

    constructor(options: { directoryPath: string }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.stop_times.name
            : `${options.directoryPath}/${gtfsFiles.stop_times.name}`;
    }

    private getTripIdsToImport(trips: GtfsTypes.Trip[]): { [key: string]: boolean } {
        const tripHashMap = {};
        trips.forEach((trip) => (tripHashMap[trip.trip_id] = true));
        return tripHashMap;
    }

    async prepareImportData(
        importData?: GtfsInternalData,
        // Reports a 0→1 fraction; the caller maps it into the appropriate named step sub-range.
        onProgress?: (fraction: number) => void
    ): Promise<(StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>)[]> {
        if (!importData || !importData.tripsToImport || importData.tripsToImport.length === 0) {
            console.log('Not importing stop times, because there are no trips to import');
            return [];
        }
        const totalRows = onProgress ? estimateStopTimeRows(importData.tripsToImport.length) : 0;
        const emitInterval = Math.max(1, Math.floor(totalRows / 100));
        let processedRows = 0;
        const tripIds = this.getTripIdsToImport(importData.tripsToImport);
        const stopTimes: StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>[] = [];
        await parseCsvFile(
            this._filePath,
            (data, rowNum) => {
                processedRows++;
                if (rowNum % 100000 === 0) {
                    console.log(`reading row number ${rowNum}`);
                }
                if (onProgress && totalRows > 0 && processedRows % emitInterval === 0) {
                    onProgress(Math.min(0.99, processedRows / totalRows));
                }
                // Ignore for trips not to import
                if (!tripIds[data.trip_id]) {
                    return;
                }

                const sequence = parseInt(data.stop_sequence);
                const distance = parseFloat(data.shape_dist_traveled);
                const pickupType = parseInt(data.pickup_type);
                const dropOffType = parseInt(data.drop_off_type);
                const continuousPickup = parseInt(data.continuous_pickup);
                const continuousDropoff = parseInt(data.continuous_drop_off);
                const timepointNum = parseInt(data.timepoint);
                const arrivalTimeSeconds = timeStrToSecondsSinceMidnight(data.arrival_time);
                const departureTimeSeconds = timeStrToSecondsSinceMidnight(data.departure_time);
                if (data.stop_id === undefined || isNaN(sequence) || sequence < 0) {
                    console.log(`GTFS StopTime import: Invalid data on row ${rowNum}`);
                    return;
                }
                const trip: StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'> = {
                    trip_id: data.trip_id,
                    stop_sequence: sequence,
                    pickup_type: pickupType >= 0 && pickupType <= 4 ? (pickupType as GtfsTypes.Alight) : 0,
                    drop_off_type: dropOffType >= 0 && dropOffType <= 4 ? (dropOffType as GtfsTypes.Alight) : 0,
                    continuous_pickup:
                        continuousPickup >= 0 && continuousPickup <= 4 ? (continuousPickup as GtfsTypes.Alight) : 1,
                    continuous_drop_off:
                        continuousDropoff >= 0 && continuousDropoff <= 4 ? (continuousDropoff as GtfsTypes.Alight) : 1,
                    timepoint: timepointNum >= 0 && timepointNum <= 1 ? (timepointNum as 0 | 1) : 1,
                    arrival_time: data.arrival_time || '',
                    departure_time: data.departure_time || '',
                    // Trim the stop_id as some gtfs tested (STM 2013) have trailing spaces. Maybe we should trim everything?
                    stop_id: typeof data.stop_id === 'string' ? data.stop_id.trim() : data.stop_id,
                    stop_headsign: data.stop_headsign || '',
                    // If time is null for one, but not the other, fallback to that other
                    arrivalTimeSeconds:
                        arrivalTimeSeconds !== null
                            ? (arrivalTimeSeconds as number)
                            : departureTimeSeconds !== null
                                ? (departureTimeSeconds as number)
                                : undefined,
                    departureTimeSeconds:
                        departureTimeSeconds !== null
                            ? (departureTimeSeconds as number)
                            : arrivalTimeSeconds !== null
                                ? (arrivalTimeSeconds as number)
                                : undefined
                };
                if (!isNaN(distance)) {
                    if (distance < 0) {
                        console.log(`GTFS StopTime import: Negative distance on row ${rowNum}, ignoring the distance`);
                    } else {
                        trip.shape_dist_traveled = distance;
                    }
                }

                stopTimes.push(trip);
            },
            gtfsCsvOptions({ header: true })
        );
        return stopTimes;
    }

    private static isFullStopTime = (
        stopTime: StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>
    ): stopTime is StopTime => {
        return (
            (stopTime as unknown as StopTime).arrivalTimeSeconds !== undefined &&
            (stopTime as unknown as StopTime).departureTimeSeconds !== undefined
        );
    };

    private static interpolateStopTimes = (
        stopTimes: (StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>)[]
    ): StopTime[] => {
        // If any stop time has no arrival or departure time, it should be interpolated
        const toInterpolateIndex = stopTimes.findIndex((stopTime) => !this.isFullStopTime(stopTime));
        if (toInterpolateIndex === -1) {
            // Nothing to interpolate
            return stopTimes as StopTime[];
        }
        console.log(`Interpolating stop times for trip ${stopTimes[0].trip_id}`);
        const stopTimesWithTimes = stopTimes
            .map((_stopTime, index) => index)
            .filter((stIndex) => this.isFullStopTime(stopTimes[stIndex]));
        for (let i = 0; i < stopTimesWithTimes.length - 1; i++) {
            const startIndex = stopTimesWithTimes[i];
            const stopIndex = stopTimesWithTimes[i + 1];
            const timeBetweenReferences =
                (stopTimes[stopIndex] as StopTime).arrivalTimeSeconds -
                (stopTimes[startIndex] as StopTime).departureTimeSeconds;
            const interpolationDelta = Math.ceil(timeBetweenReferences / (stopIndex - startIndex));
            // Interpolate times
            for (let segmentIndex = startIndex + 1; segmentIndex < stopIndex; segmentIndex++) {
                (stopTimes[segmentIndex] as StopTime).arrivalTimeSeconds =
                    (stopTimes[segmentIndex - 1] as StopTime).departureTimeSeconds + interpolationDelta;
                (stopTimes[segmentIndex] as StopTime).departureTimeSeconds = (
                    stopTimes[segmentIndex] as StopTime
                ).arrivalTimeSeconds;
            }
        }
        return stopTimes as StopTime[];
    };

    static async groupAndSortByTripId(
        stopTimes: (StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>)[],
        // Reports a 0→1 fraction; the caller maps it into the appropriate named step sub-range.
        onProgress?: (fraction: number) => void
    ): Promise<StopTimeImportData> {
        const partialStopTimeData: {
            [key: string]: (StopTime | Omit<StopTime, 'arrivalTimeSeconds' | 'departureTimeSeconds'>)[];
        } = {};
        stopTimes.forEach((stopTime) => {
            const stopTimeForTrip = partialStopTimeData[stopTime.trip_id] || [];
            stopTimeForTrip.push(stopTime);
            partialStopTimeData[stopTime.trip_id] = stopTimeForTrip;
        });
        const stopTimeData: StopTimeImportData = {};

        // Sort the trip's stop times by sequence number and interpolate their times
        const tripKeys = Object.keys(partialStopTimeData);
        const totalTrips = tripKeys.length;
        const emitInterval = Math.max(1, Math.floor(totalTrips / 100));
        for (let i = 0; i < tripKeys.length; i++) {
            const key = tripKeys[i];
            partialStopTimeData[key].sort((stopTimeA, stopTimeB) => stopTimeA.stop_sequence - stopTimeB.stop_sequence);
            stopTimeData[key] = this.interpolateStopTimes(partialStopTimeData[key]);
            if (onProgress && (i + 1) % emitInterval === 0) {
                onProgress(Math.min(0.99, (i + 1) / totalTrips));
                // Yield to the event loop so socket.io can flush progress to the client
                await new Promise((resolve) => setImmediate(resolve));
            }
        }
        return stopTimeData;
    }
}

export default StopTimeImporter;
