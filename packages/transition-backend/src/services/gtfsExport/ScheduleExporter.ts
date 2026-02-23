/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { unparse } from 'papaparse';
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import dbQueries from '../../models/db/transitSchedules.db.queries';
import pathDbQueries from '../../models/db/transitPaths.db.queries';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { ScheduleAttributes } from 'transition-common/lib/services/schedules/Schedule';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Path from 'transition-common/lib/services/path/Path';

// will return an object with trips and stop_times arrays
// + nodeIds (the node ids used in this schedule)
// + pathIds (the path ids used in this schedule)
const objectToGtfs = (
    schedule: ScheduleAttributes,
    lineId: string,
    gtfsServiceId: string,
    pathCollection: PathCollection
): {
    trips: GtfsTypes.Trip[];
    stopTimes: GtfsTypes.StopTime[];
    nodeIds: { [key: string]: boolean };
    pathIds: { [key: string]: boolean };
} => {
    const gtfsTrips: GtfsTypes.Trip[] = [];
    const gtfsStopTimes: GtfsTypes.StopTime[] = [];
    const nodeIds: { [key: string]: boolean } = {};
    const pathIds: { [key: string]: boolean } = {};

    const periods = schedule.periods;

    const pathsById: { [key: string]: { path: Path; distances: number[] } } = {};

    for (let periodIdx = 0, countI = periods.length; periodIdx < countI; periodIdx++) {
        const trips = periods[periodIdx].trips || [];
        for (let tripIdx = 0, countJ = trips.length; tripIdx < countJ; tripIdx++) {
            const trip = trips[tripIdx];
            if (!pathsById[trip.path_id]) {
                const pathGeojson = pathCollection.getById(trip.path_id);
                if (!pathGeojson) {
                    console.error('Path not found: ' + trip.path_id + ' for line ' + lineId);
                    continue;
                }
                const newPath = pathCollection.newObject(pathGeojson);
                pathsById[trip.path_id] = { path: newPath, distances: newPath.getCoordinatesDistanceTraveledMeters() };
                pathIds[newPath.id] = true;
                const nodes = newPath.attributes.nodes;
                for (let nodeI = 0, countNodes = nodes.length; nodeI < countNodes; nodeI++) {
                    nodeIds[nodes[nodeI]] = true;
                }
            }
            const { path, distances: pathDistancesTraveledMeters } = pathsById[trip.path_id];
            const pathGeography = path.attributes.geography;
            const pathCoordinates = pathGeography.coordinates;
            const pathNodeIds = path.attributes.nodes;
            const pathSegments = path.attributes.segments;
            const tripGtfsFields = {
                route_id: lineId, // required
                service_id: gtfsServiceId, // required
                trip_id: trip.id, // required
                trip_headsign: path.attributes.name || path.attributes.direction || undefined, // optional
                trip_short_name: undefined, // optional
                direction_id: path.get('direction') === 'inbound' ? 1 : (0 as 1 | 0), // shortname and/or longname required
                block_id: trip.block_id, // optional, TODO: implement blocks
                shape_id: trip.path_id, // required
                wheelchair_accessible: undefined, // optional
                bikes_allowed: undefined // optional
            };
            gtfsTrips.push(tripGtfsFields);

            const nodesArrivals = trip.node_arrival_times_seconds;
            const nodesDepartures = trip.node_departure_times_seconds;
            const nodesCanBoard = trip.nodes_can_board;
            const nodesCanUnboard = trip.nodes_can_unboard;

            for (let k = 0, countK = nodesArrivals.length; k < countK; k++) {
                const coordinateIndex = k < countK - 1 ? pathSegments[k] : pathCoordinates.length - 1;
                const distanceTraveledKm = pathDistancesTraveledMeters[coordinateIndex] / 1000;
                const arrival = nodesArrivals[k];
                const departure = nodesDepartures[k];
                const arrivalTimeStr =
                    typeof arrival === 'number' ? secondsSinceMidnightToTimeStr(arrival, true, true) : undefined;
                const departureTimeStr =
                    typeof departure === 'number' ? secondsSinceMidnightToTimeStr(departure, true, true) : undefined;
                // Per GTFS specification
                // (https://gtfs.org/documentation/schedule/reference/#stop_timestxt):
                // arrival_time and departure_time are "Conditionally Required" - must be provided for
                // timepoints. "If there are not separate times for arrival and departure at a stop,
                // arrival_time and departure_time should be the same."
                const arrivalTime = arrivalTimeStr ?? departureTimeStr;
                const departureTime = departureTimeStr ?? arrivalTimeStr;

                if (arrivalTime === undefined && departureTime === undefined) {
                    // TODO If both time are not available, we should implement time interpolation
                    // For now, simply throw an error
                    throw new Error(
                        `Missing both arrival_time and departure_time for trip ${trip.id} at stop_sequence ${k + 1}`
                    );
                }

                const canBoard = nodesCanBoard[k];
                const canUnboard = nodesCanUnboard[k];
                const stopTime = {
                    trip_id: trip.id, // required
                    arrival_time: arrivalTime, // required
                    departure_time: departureTime, // required
                    stop_id: pathNodeIds[k], // required
                    stop_sequence: k + 1, // required
                    stop_headsign: undefined, // optional, TODO: implement this?
                    pickup_type: canBoard === true ? 0 : 1, // optional, TODO: implement other choices (2: must phone agency, 3: must coordinate with driver)
                    drop_off_type: canUnboard === true ? 0 : 1, // optional, TODO: implement other choices (2: must phone agency, 3: must coordinate with driver)
                    continuous_pickup: 1, // optional, TODO: implement other choices (0: continousu pick up, 2: must phone agency, 3: must coordinate with driver)
                    continuous_drop_off: 1, // optional, TODO: implement other choices (0: continousu drop off, 2: must phone agency, 3: must coordinate with driver)
                    shape_dist_traveled: Math.round(distanceTraveledKm * 1000) / 1000, // optional
                    timepoint: 1 as const // optional, TODO: implement approximate: 0 (exact: 1)
                };
                gtfsStopTimes.push(stopTime);
            }
        }
    }

    return {
        trips: gtfsTrips,
        stopTimes: gtfsStopTimes,
        nodeIds,
        pathIds
    };
};

const schedulesBatchSize = 100;

// Export the schedules for a subset of lines, to avoid out of memory exception for large sets of lines
const exportScheduleForLineSubset = async (
    lineIds: string[],
    options: {
        shouldWriteTripHeader: boolean;
        shouldWriteStopTimesHeader: boolean;
        stopTimesStream: fs.WriteStream;
        tripStream: fs.WriteStream;
        pathCollection: PathCollection;
        quotesFct: (value: unknown) => boolean;
        serviceToGtfsId: { [key: string]: string };
    }
): Promise<{
    pathIds: string[];
    nodeIds: string[];
    shouldWriteStopTimesHeader: boolean;
    shouldWriteTripHeader: boolean;
}> => {
    // Fetch the schedules for the lines to export
    const allSchedulesAttributes = await dbQueries.readForLines(lineIds);
    const pathIds: { [key: string]: boolean } = {};
    const nodeIds: { [key: string]: boolean } = {};

    let shouldWriteTripHeader = options.shouldWriteTripHeader;
    let shouldWriteStopTimesHeader = options.shouldWriteStopTimesHeader;
    // Save schedules in batches to avoid out of memory exceptions, some schedules may have a lot of trips
    while (allSchedulesAttributes.length > 0) {
        const scheduleBatch = allSchedulesAttributes.splice(0, schedulesBatchSize);

        const gtfsScheduleData = scheduleBatch.map((schedule) =>
            !schedule.service_id || !options.serviceToGtfsId[schedule.service_id]
                ? { trips: [], stopTimes: [], nodeIds: {}, pathIds: {} }
                : objectToGtfs(
                    schedule,
                    schedule.line_id,
                    options.serviceToGtfsId[schedule.service_id],
                    options.pathCollection
                )
        );
        const gtfsTrips = gtfsScheduleData.flatMap((gtfsData) => gtfsData.trips);
        const gtfsStopTimes = gtfsScheduleData.flatMap((gtfsData) => gtfsData.stopTimes);
        gtfsScheduleData.forEach((gtfsData) => {
            Object.keys(gtfsData.nodeIds).forEach((nodeId) => (nodeIds[nodeId] = true));
            Object.keys(gtfsData.pathIds).forEach((pathId) => (pathIds[pathId] = true));
        });

        // Write the trips and stop_times to the gtfs file
        if (gtfsTrips.length > 0) {
            const fileOk = options.tripStream.write(
                unparse(gtfsTrips, {
                    newline: '\n',
                    quotes: options.quotesFct,
                    header: shouldWriteTripHeader
                }) + '\n'    // <-- add trailing newline between batches
            );
            // Wait for the stream to drain if necessary to avoid losing data when writing more later
            if (!fileOk) {
                await new Promise<void>((resolve) => {
                    options.tripStream.once('drain', () => resolve());
                });
            }
            shouldWriteTripHeader = false;
        }
        if (gtfsStopTimes.length > 0) {
            const fileOk = options.stopTimesStream.write(
                unparse(gtfsStopTimes, {
                    newline: '\n',
                    quotes: options.quotesFct,
                    header: shouldWriteStopTimesHeader
                }) + '\n'    // <-- add trailing newline between batches
            );
            // Wait for the stream to drain if necessary to avoid losing data when writing more later
            if (!fileOk) {
                await new Promise<void>((resolve) => {
                    options.stopTimesStream.once('drain', () => resolve());
                });
            }
            shouldWriteStopTimesHeader = false;
        }
    }

    return {
        pathIds: Object.keys(pathIds),
        nodeIds: Object.keys(nodeIds),
        shouldWriteStopTimesHeader,
        shouldWriteTripHeader
    };
};

const lineIdsBatchSize = 50;
/**
 * Export the schedules for the given lines to GTFS format
 * @param lineIds The array of line IDs to export
 * @param options The options for exporting schedules
 * @returns Whether the export was successful or an error
 */
export const exportSchedule = async (
    lineIds: string[],
    options: {
        directoryPath: string;
        quotesFct: (value: unknown) => boolean;
        includeTransitionFields?: boolean;
        serviceToGtfsId: { [key: string]: string };
    }
): Promise<{ status: 'success'; pathIds: string[]; nodeIds: string[] } | { status: 'error'; error: unknown }> => {
    // Prepare the file streams
    const stopTimeFilePath = `${options.directoryPath}/${gtfsFiles.stop_times.name}`;
    fileManager.truncateFileAbsolute(stopTimeFilePath);
    const stopTimesStream = fs.createWriteStream(stopTimeFilePath);

    const tripFilePath = `${options.directoryPath}/${gtfsFiles.trips.name}`;
    fileManager.truncateFileAbsolute(tripFilePath);
    const tripStream = fs.createWriteStream(tripFilePath);

    try {
        const pathIds: { [key: string]: boolean } = {};
        const nodeIds: { [key: string]: boolean } = {};

        // Fetch the path collection
        const paths = await pathDbQueries.geojsonCollection();
        const pathCollection = new PathCollection([], {});
        pathCollection.loadFromCollection(paths.features);

        let shouldWriteTripHeader = true;
        let shouldWriteStopTimesHeader = true;

        // Copy to avoid mutating the lineIds array
        const lineIdsCopy = [...lineIds];
        while (lineIdsCopy.length > 0) {
            // To avoid out of memory exceptions, export schedules in chunks of 50 lines
            const linesToExport = lineIdsCopy.splice(0, lineIdsBatchSize);
            const {
                pathIds: batchPathIds,
                nodeIds: batchNodeIds,
                shouldWriteStopTimesHeader: newShouldWriteStopTimesHeader,
                shouldWriteTripHeader: newShouldWriteTripHeader
            } = await exportScheduleForLineSubset(linesToExport, {
                stopTimesStream,
                tripStream,
                shouldWriteTripHeader,
                shouldWriteStopTimesHeader,
                pathCollection,
                quotesFct: options.quotesFct,
                serviceToGtfsId: options.serviceToGtfsId
            });
            batchPathIds.forEach((pathId) => (pathIds[pathId] = true));
            batchNodeIds.forEach((nodeId) => (nodeIds[nodeId] = true));
            shouldWriteStopTimesHeader = newShouldWriteStopTimesHeader;
            shouldWriteTripHeader = newShouldWriteTripHeader;
        }

        return { status: 'success', pathIds: Object.keys(pathIds), nodeIds: Object.keys(nodeIds) };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        stopTimesStream.end();
        tripStream.end();
    }
};
