/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { unparse } from 'papaparse';
import * as GtfsTypes from 'gtfs-types';

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
            const pathGeography = path.getAttributes().geography;
            const pathCoordinates = pathGeography.coordinates;
            const pathNodeIds = path.attributes.nodes;
            const pathSegments = path.attributes.segments;
            const tripGtfsFields = {
                route_id: lineId, // required
                service_id: gtfsServiceId, // required
                trip_id: trip.id, // required
                trip_headsign: path.getAttributes().name || path.getAttributes().direction || undefined, // optional
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
                const canBoard = nodesCanBoard[k];
                const canUnboard = nodesCanUnboard[k];
                const stopTime = {
                    trip_id: trip.id, // required
                    arrival_time: k > 0 ? secondsSinceMidnightToTimeStr(arrival, true, true) : undefined, // required
                    departure_time: k < countK - 1 ? secondsSinceMidnightToTimeStr(departure, true, true) : undefined, // required
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

    // Fetch the schedules for the lines to export
    const schedulesAttributes = await dbQueries.readForLines(lineIds);
    const pathIds: { [key: string]: boolean } = {};
    const nodeIds: { [key: string]: boolean } = {};

    // Fetch the path collection
    const paths = await pathDbQueries.geojsonCollection();
    const pathCollection = new PathCollection([], {});
    pathCollection.loadFromCollection(paths.features);

    try {
        const gtfsScheduleData = schedulesAttributes.map((schedule) =>
            !schedule.service_id || !options.serviceToGtfsId[schedule.service_id]
                ? { trips: [], stopTimes: [], nodeIds: {}, pathIds: {} }
                : objectToGtfs(schedule, schedule.line_id, options.serviceToGtfsId[schedule.service_id], pathCollection)
        );

        const gtfsTrips = gtfsScheduleData.flatMap((gtfsData) => gtfsData.trips);
        const gtfsStopTimes = gtfsScheduleData.flatMap((gtfsData) => gtfsData.stopTimes);
        gtfsScheduleData.forEach((gtfsData) => {
            Object.keys(gtfsData.nodeIds).forEach((nodeId) => (nodeIds[nodeId] = true));
            Object.keys(gtfsData.pathIds).forEach((pathId) => (pathIds[pathId] = true));
        });
        // Write the trips and stop_times to the gtfs file
        if (gtfsTrips.length > 0) {
            tripStream.write(
                unparse(gtfsTrips, {
                    newline: '\n',
                    quotes: options.quotesFct,
                    header: true
                })
            );
        }
        if (gtfsStopTimes.length > 0) {
            stopTimesStream.write(
                unparse(gtfsStopTimes, {
                    newline: '\n',
                    quotes: options.quotesFct,
                    header: true
                })
            );
        }

        return { status: 'success', pathIds: Object.keys(pathIds), nodeIds: Object.keys(nodeIds) };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        stopTimesStream.end();
        tripStream.end();
    }
};
