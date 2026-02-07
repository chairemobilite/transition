/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';
import pQueue from 'p-queue';
import _isEqual from 'lodash/isEqual';

import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import Line from 'transition-common/lib/services/line/Line';
import Path from 'transition-common/lib/services/path/Path';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { GtfsInternalData, StopTime } from './GtfsImportTypes';
import {
    generateGeographyAndSegmentsFromGtfs,
    generateGeographyAndSegmentsFromStopTimes
} from '../path/PathGtfsGeographyGenerator';
import pathsDbQueries from '../../models/db/transitPaths.db.queries';

/**
 * Generate and import paths from line trips. If the result is 'success', it
 * means at least some paths were generated and imported, but there may be
 * warnings. Warning messages will tell if the path was generated or not. If the
 * status is 'failed', no path was generated.
 *
 * @param {{ [key: string]: TripData[] }}
 * tripByGtfsLineId The trips data, by line ID
 * @param {GtfsInternalData} importData All the internal GTFS data prepared and
 * imported so far
 * @param {*} collectionManager The collection manager containing all lines
 * @return {*}  {(Promise< { status: 'success'; pathIdsByTripId: { [key:
 *     string]: string }; warnings: TranslatableMessage[] } | { status: 'failed';
 *     errors: TranslatableMessage[] }
 * >)}
 */
const generateAndImportPaths = async (
    tripByGtfsLineId: { [key: string]: TripData[] },
    importData: GtfsInternalData,
    collectionManager: any
): Promise<
    | { status: 'success'; pathIdsByTripId: { [key: string]: string }; warnings: TranslatableMessage[] }
    | { status: 'failed'; errors: TranslatableMessage[] }
> => {
    let allWarnings: TranslatableMessage[] = [];
    const pathIdsByTripId = {};

    try {
        importData.pathIdsByTripId = {};
        const gtfsRouteIds = Object.keys(tripByGtfsLineId);

        const promiseQueue = new pQueue({ concurrency: 1 });

        let newPaths: Path[] = [];
        const pathsForLinePromises = gtfsRouteIds.map(async (gtfsLineId) => {
            const lineId = importData.lineIdsByRouteGtfsId[gtfsLineId];
            const line = collectionManager.get('lines').getById(lineId);
            if (!line) {
                throw `GTFS import: No line imported for gtfs route ${gtfsLineId}`;
            }
            await promiseQueue.add(async () => {
                try {
                    const { paths, pathByTripId, warnings } = generatePathsForLine(
                        line as Line,
                        tripByGtfsLineId[gtfsLineId],
                        pathIdsByTripId,
                        importData
                    );
                    Object.assign(pathIdsByTripId, pathByTripId);
                    newPaths = newPaths.concat(paths);
                    allWarnings = allWarnings.concat(warnings);
                } catch (error) {
                    console.error(
                        `GTFS Path import: Error generating paths for line ${gtfsLineId}: ${error}${
                            (error as any).stack ? (error as any).stack : ''
                        }`
                    );
                    allWarnings.push({
                        text: GtfsMessages.PathGenerationErrorForLine,
                        params: { lineShortName: line.attributes.shortname || gtfsLineId }
                    });
                }
            });
        });

        // Run all the promises, no matter their result.
        // TODO: Wait for the promise queue to be completed and see if we can grab the results from the promises themselves
        await Promise.allSettled(pathsForLinePromises);
        await pathsDbQueries.createMultiple(
            newPaths.map((newPath) => {
                return newPath.attributes;
            })
        );

        return { status: 'success', warnings: allWarnings, pathIdsByTripId };
    } catch (error) {
        console.error(`GTFS Path import: Error importing paths: ${error}. Paths may not have been correctly imported`);
        return { status: 'failed', errors: [GtfsMessages.PathGenerationError] };
    }
};

type TripData = { trip: GtfsTypes.Trip; stopTimes: StopTime[] };
type PathGroup = {
    shapeId: string | undefined;
    nodeIds: string[];
    trips: TripData[];
};

const generatePathsForLine = (
    line: Line,
    tripsForLine: TripData[],
    pathIdByTripId: { [key: string]: string },
    importData: GtfsInternalData
): { paths: Path[]; warnings: TranslatableMessage[]; pathByTripId: { [key: string]: string } } => {
    let allWarnings: TranslatableMessage[] = [];
    const newPaths: Path[] = [];

    const pathGroups: PathGroup[] = []; // group trips by path signature (shapeId + nodeIds)
    const pathGroupIndex: Map<string, number> = new Map(); // signature -> index in pathGroups

    // group trips that share the same shape and ordered stops into a single path group,
    // so each unique combination of shapeId + nodeIds produces one path
    for (const tripData of tripsForLine) {
        const { trip, stopTimes } = tripData;

        if (pathIdByTripId[trip.trip_id]) {
            continue;
        }

        const nodeIds = stopTimes.map((stopTime) => importData.nodeIdsByStopGtfsId[stopTime.stop_id]);
        const shapeId = trip.shape_id;
        const signature = JSON.stringify({ shapeId, nodeIds });

        const existingIndex = pathGroupIndex.get(signature);
        if (existingIndex !== undefined) {
            pathGroups[existingIndex].trips.push(tripData);
        } else {
            pathGroupIndex.set(signature, pathGroups.length);
            pathGroups.push({ shapeId, nodeIds, trips: [tripData] });
        }
    }

    const pathByShapeId: { [key: string]: Path[] } = {};
    const pathsWithoutShape: Path[] = [];

    line.getPaths().forEach((path) => {
        const gtfsData = path.attributes.data.gtfs;
        if (gtfsData && gtfsData.shape_id) {
            const paths = pathByShapeId[gtfsData.shape_id] || [];
            paths.push(path);
            pathByShapeId[gtfsData.shape_id] = paths;
        } else {
            pathsWithoutShape.push(path);
        }
    });

    // generate or find paths for each group
    for (const group of pathGroups) {
        const { shapeId, nodeIds, trips } = group;
        const firstTrip = trips[0].trip;

        let existingPath: Path | undefined;
        if (shapeId) {
            // TODO: Could there really be multiple paths for a single shape with different stops?
            const pathsForShape = pathByShapeId[shapeId] || [];
            existingPath = pathsForShape.find((path) => _isEqual(path.attributes.nodes, nodeIds));
        } else {
            existingPath = pathsWithoutShape.find((path) => _isEqual(path.attributes.nodes, nodeIds));
        }

        if (existingPath) {
            for (const tripData of trips) {
                pathIdByTripId[tripData.trip.trip_id] = existingPath.getId();
            }
            continue;
        }

        const allStopTimes = trips.map((t) => t.stopTimes);

        if (shapeId) {
            const { newPath, warnings } = generatePathFromShape(
                line,
                firstTrip,
                allStopTimes,
                shapeId,
                nodeIds,
                importData
            );
            newPaths.push(newPath);
            const pathsForShape = pathByShapeId[shapeId] || [];
            pathsForShape.push(newPath);
            pathByShapeId[shapeId] = pathsForShape;
            for (const tripData of trips) {
                pathIdByTripId[tripData.trip.trip_id] = newPath.getId();
            }
            allWarnings = allWarnings.concat(warnings);
        } else {
            allWarnings.push({
                text: GtfsMessages.TripWithNoShape,
                params: { tripId: firstTrip.trip_id, lineShortName: line.attributes.shortname || firstTrip.route_id }
            });
            const { newPath, warnings } = generatePathWithoutShape(line, firstTrip, allStopTimes, nodeIds, importData);
            newPaths.push(newPath);
            pathsWithoutShape.push(newPath);
            for (const tripData of trips) {
                pathIdByTripId[tripData.trip.trip_id] = newPath.getId();
            }
            allWarnings = allWarnings.concat(warnings);
        }
    }

    return { paths: newPaths, pathByTripId: pathIdByTripId, warnings: allWarnings };
};

const generatePathFromShape = (
    line: Line,
    trip: GtfsTypes.Trip,
    allTripsStopTimes: StopTime[][],
    shapeGtfsId: string,
    nodeIds: string[],
    importData: GtfsInternalData
): { newPath: Path; warnings: TranslatableMessage[] } => {
    const gtfsDirectionId = trip.direction_id || 0;
    const pathName = trip.trip_headsign;
    const direction = gtfsDirectionId === 0 ? 'outbound' : 'inbound';

    const newPath = line.newPath({ direction, name: pathName });

    const coordinatesWithDistances = importData.shapeById[shapeGtfsId];
    // TODO Those 2 parameters were added to the call:  this.get('defaultLayoverRatioOverTotalTravelTime', null), this.get('defaultMinLayoverTimeSeconds', null));
    const warnings = generateGeographyAndSegmentsFromGtfs(
        newPath,
        coordinatesWithDistances,
        nodeIds,
        allTripsStopTimes,
        shapeGtfsId,
        importData.stopCoordinatesByStopId
    );
    newPath.convertAllCoordinatesToWaypoints(newPath.attributes.data.routingEngine !== 'engine'); // set all coordinates to waypoints if routingEngine is not engine

    return { newPath, warnings };
};

const generatePathWithoutShape = (
    line: Line,
    trip: GtfsTypes.Trip,
    allTripsStopTimes: StopTime[][],
    nodeIds: string[],
    importData: GtfsInternalData
): { newPath: Path; warnings: TranslatableMessage[] } => {
    const gtfsDirectionId = trip.direction_id || 0;
    const pathName = trip.trip_headsign;
    const direction = gtfsDirectionId === 0 ? 'outbound' : 'inbound';

    const newPath = line.newPath({ direction, name: pathName });

    // TODO Those 2 parameters were added to the call: this.get('defaultLayoverRatioOverTotalTravelTime', null), this.get('defaultMinLayoverTimeSeconds', null)). See if we can/need to configure them
    const warnings = generateGeographyAndSegmentsFromStopTimes(
        newPath,
        nodeIds,
        allTripsStopTimes,
        importData.stopCoordinatesByStopId
    );

    return { newPath, warnings };
};

export default {
    generateAndImportPaths
};
