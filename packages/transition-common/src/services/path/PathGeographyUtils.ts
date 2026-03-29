/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _get from 'lodash/get';
import * as turf from '@turf/turf';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { Feature, FeatureCollection, Point } from 'geojson';
import { MapMatchingResults, RoutingService } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import { generatePathGeographyFromRouting, calculateSegmentDuration } from './PathGeographyGenerator';
import type { SegmentChangeInfo } from './PathTypes';
import { kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';

/*
DEFAULT_MIN_MATCHING_TIMESTAMP is the minimum interval between timestamps for the matching routing (using OSRM).
This seems to be the minimum value for which we can match correctly with long segments between nodes.
TODO: analyze OSRM matching algorithm to find a better value or make sure it never fails for our usage
DEFAULT_ROUTING_SPEED_MPS is another arbitrary speed for matching which makes it not fail. Needs investigation.
*/
const DEFAULT_MIN_MATCHING_TIMESTAMP = 500; // can be overriden by data.minMatchingTimestamp, in seconds
const DEFAULT_ROUTING_SPEED_MPS = 20;
const DEFAULT_WAYPOINT_RADIUS_METERS = 15;
/** Start and end indices into the prepared points array, used to extract a subset of nodes/waypoints for routing */
type FeatureIndexRange = { start: number; end: number };

/** Distance in meters and duration in seconds for a routing leg */
type RoutingLegTimeAndDistance = { distanceMeters: number; durationSeconds: number };

export interface PathGeographyResults {
    direct: MapMatchingResults;
    points: FeatureCollection<Point>;
    segmentResults: MapMatchingResults[];
}

class PathGeographyUtils {
    calculateBirdDistanceDuration = (
        from: Feature<Point>,
        to: Feature<Point>,
        defaultRunningSpeedMps: number
    ): number => {
        const lineWithPrevious = turf.lineString([from.geometry.coordinates, to.geometry.coordinates]);
        const lineWithPreviousLength = turf.length(lineWithPrevious, { units: 'meters' });
        // Using a default speed of 15 km/h seems just fine with map matching (faster speeds makes osrm fails to find some routes):
        return Math.ceil(lineWithPreviousLength / Math.max(defaultRunningSpeedMps, kphToMps(15)));
    };

    initializePointGeojsonCollection = (): FeatureCollection<Point> => {
        return { type: 'FeatureCollection', features: [] };
    };

    prepareNodesAndWaypoints = (
        path: any,
        defaultRunningSpeedMps: number,
        routingEngine = 'engine'
    ): FeatureCollection<Point> => {
        const nodeIds = path.get('nodes', []);
        const nodeTypes = path.getData('nodeTypes', []);
        const waypoints = path.getData('waypoints', []);
        const waypointTypes = path.getData('waypointTypes', []);

        // prepare matching query:
        const nodesAndWaypointsGeojsons: FeatureCollection<Point> = this.initializePointGeojsonCollection();
        const defaultRoutingRadiusMeters = Preferences.current.transit.nodes.defaultRoutingRadiusMeters;

        // if activated: force temporary increase the nodes routing radius for this path calculation if the existing shape is not passing through it at some nodes:
        // TODO: test this
        const distancesForNodeIdsWithRoutingRadiusTooSmallForPathShape =
            routingEngine === 'engine' &&
            (path.getData('from_gtfs', false) || path.getData('increaseRoutingRadiiToIncludeExistingPathShape', false))
                ? path.getDistancesForNodeIdsWithRoutingRadiusTooSmallForPathShape()
                : [];
        let currentTime = 0;
        // increment each node coordinates and radii (radiuses):
        nodeIds.forEach((nodeId, nodeIndex) => {
            // Copy the node
            const nodeGeojson = _cloneDeep(path._collectionManager.get('nodes').getById(nodeId)) as Feature<Point>;
            const nodeProperties = nodeGeojson.properties || {};
            nodeGeojson.properties = nodeProperties;
            nodeProperties.isNode = true;
            // Some other type like manual may have been specified
            nodeProperties.type = nodeTypes[nodeIndex] || routingEngine;
            const nodeRoutingRadius = _get(nodeGeojson, 'properties.routing_radius_meters', defaultRoutingRadiusMeters);
            nodeProperties.radius = Math.min(
                200,
                distancesForNodeIdsWithRoutingRadiusTooSmallForPathShape[nodeId]
                    ? distancesForNodeIdsWithRoutingRadiusTooSmallForPathShape[nodeId] + 5 // add a 5m buffer to make sure we have enough margin for map matching
                    : nodeRoutingRadius
            );
            // Calculate approximate timestamp to reach this point
            // timestamps are a bit arbitrary since we do not match a real GPS trace.
            if (nodeIndex !== 0) {
                currentTime += Math.max(
                    path.getData('minMatchingTimestamp', DEFAULT_MIN_MATCHING_TIMESTAMP),
                    this.calculateBirdDistanceDuration(
                        nodesAndWaypointsGeojsons.features[nodesAndWaypointsGeojsons.features.length - 1],
                        nodeGeojson,
                        DEFAULT_ROUTING_SPEED_MPS
                    )
                );
            }
            nodeProperties.timestamp = currentTime;
            nodesAndWaypointsGeojsons.features.push(nodeGeojson);

            // get waypoints between this node and next:
            if (waypoints[nodeIndex]) {
                waypoints[nodeIndex].forEach((waypoint, waypointIndex) => {
                    const waypointFeature = turf.point(waypoint, {
                        isNode: false,
                        type: waypointTypes[nodeIndex][waypointIndex],
                        radius: DEFAULT_WAYPOINT_RADIUS_METERS
                    } as { [name: string]: any });
                    currentTime += Math.max(
                        path.getData('minMatchingTimestamp', DEFAULT_MIN_MATCHING_TIMESTAMP),
                        this.calculateBirdDistanceDuration(
                            nodesAndWaypointsGeojsons.features[nodesAndWaypointsGeojsons.features.length - 1],
                            waypointFeature,
                            DEFAULT_ROUTING_SPEED_MPS
                        )
                    );
                    waypointFeature.properties = waypointFeature.properties || {};
                    waypointFeature.properties.timestamp = currentTime;
                    nodesAndWaypointsGeojsons.features.push(waypointFeature);
                });
            }
        });
        return nodesAndWaypointsGeojsons;
    };

    shouldPathUpdate = (path: any): boolean => {
        const nodeIds = path.get('nodes', []);
        const waypoints = path.getData('waypoints', []);
        const waypointTypes = path.getData('waypointTypes', []);

        for (let i = 0, count = nodeIds.length; i < count; i++) {
            if (!waypoints[i]) {
                waypoints[i] = [];
            }
            if (!waypointTypes[i]) {
                waypointTypes[i] = [];
            }
        }

        path.attributes.data.waypoints = waypoints;
        path.attributes.data.waypointTypes = waypointTypes;

        // There is less than 1 node and no waypoints, empty the path
        if (nodeIds.length < 2 && (!waypoints[0] || waypoints[0].length === 0)) {
            return false;
        }

        const line = path.getLine();

        // Can't update geography if there's no line or no node
        return line && path._collectionManager.get('nodes');
    };

    getRoutingSegments = (
        nodesAndWaypointsGeojsons: FeatureCollection<Point>,
        routingEngine: string
    ): { routingType: string; geojson: FeatureCollection<Point> }[] => {
        const routingSegments: { routingType: string; geojson: FeatureCollection<Point> }[] = [];
        let routingSegmentGeojson: FeatureCollection<Point> = this.initializePointGeojsonCollection();
        let lastRoutingType = routingEngine;

        nodesAndWaypointsGeojsons.features.forEach((geojson, _geojsonIndex) => {
            const nodeRoutingType = routingEngine === 'manual' ? 'manual' : geojson.properties?.type || lastRoutingType;

            if (nodeRoutingType !== lastRoutingType && routingSegmentGeojson.features.length > 0) {
                // Save current segment and create a new one, adding the last point from previous segment
                const lastGeojson = routingSegmentGeojson.features[routingSegmentGeojson.features.length - 1];
                routingSegments.push({ routingType: lastRoutingType, geojson: routingSegmentGeojson });
                routingSegmentGeojson = this.initializePointGeojsonCollection();
                routingSegmentGeojson.features.push(lastGeojson);
            }
            routingSegmentGeojson.features.push(geojson);
            lastRoutingType = nodeRoutingType;
        });

        if (routingSegmentGeojson.features.length > 0) {
            routingSegments.push({ routingType: lastRoutingType, geojson: routingSegmentGeojson });
        }

        return routingSegments;
    };

    routeSegments = async (
        routingSegments: { routingType: string; geojson: FeatureCollection<Point> }[],
        routingMode: RoutingMode,
        defaultRunningSpeedMps: number
    ): Promise<MapMatchingResults[]> => {
        const matchings: MapMatchingResults[] = [];

        await Promise.allSettled(
            routingSegments.map(async (routingSegment, routingSegmentIndex) => {
                try {
                    const routingService = routingServiceManager.getRoutingServiceForEngine(routingSegment.routingType);
                    const routingResult = await routingService.mapMatch({
                        mode: routingMode,
                        points: routingSegment.geojson,
                        defaultRunningSpeed: defaultRunningSpeedMps
                    });
                    matchings[routingSegmentIndex] = routingResult;
                } catch (error) {
                    console.error('error routing segment %d: %s', routingSegmentIndex, error);
                    matchings[routingSegmentIndex] = {
                        tracepoints: routingSegment.geojson.features.map(() => null),
                        matchings: []
                    };
                }
                return matchings[routingSegmentIndex];
            })
        );
        return matchings;
    };

    getTerminalGeojson = (nodesAndWaypointsGeojsons: FeatureCollection<Point>): FeatureCollection<Point> => {
        return {
            type: 'FeatureCollection',
            features: [
                nodesAndWaypointsGeojsons.features[0],
                nodesAndWaypointsGeojsons.features[nodesAndWaypointsGeojsons.features.length - 1]
            ]
        };
    };

    getErrorsForDirectPath(nodesAndWaypointsGeojsons: FeatureCollection<Point>, error: { [key: string]: any } = {}) {
        const nodesWithErrors: Feature[] = [];
        const waypointsWithErrors: Feature[] = [];
        const firstPoint = nodesAndWaypointsGeojsons.features[0];
        if (firstPoint.properties?.isNode) {
            nodesWithErrors.push(firstPoint);
        } else {
            waypointsWithErrors.push(firstPoint);
        }
        const lastPoint = nodesAndWaypointsGeojsons.features[nodesAndWaypointsGeojsons.features.length - 1];
        if (lastPoint.properties?.isNode) {
            nodesWithErrors.push(lastPoint);
        } else {
            waypointsWithErrors.push(lastPoint);
        }
        const pointErrors: { nodes: Feature[]; waypoints: Feature[]; error?: string } = {
            nodes: nodesWithErrors,
            waypoints: waypointsWithErrors
        };
        if (error.error) {
            pointErrors.error = error.error;
        }
        return pointErrors;
    }

    private async getDirectPath(
        routingService: RoutingService,
        routingMode: RoutingMode,
        defaultRunningSpeedMps: number,
        nodesAndWaypointsGeojsons: FeatureCollection<Point>
    ) {
        try {
            const terminals = this.getTerminalGeojson(nodesAndWaypointsGeojsons);
            const shouldUseManual =
                terminals.features.find((feature) => feature.properties?.type === 'manual') !== undefined;
            const directPathRoutingService = shouldUseManual
                ? routingServiceManager.getRoutingServiceForEngine('manual')
                : routingService;
            const directPath = await directPathRoutingService.mapMatch({
                mode: routingMode,
                defaultRunningSpeed: defaultRunningSpeedMps,
                points: terminals
            });
            return directPath;
        } catch (error) {
            // TODO Why is the error type an object? Investigate if we can have something more generic (or not)
            throw this.getErrorsForDirectPath(nodesAndWaypointsGeojsons, error as any);
        }
    }

    /**
     * Find the feature indices in the prepared points array that correspond to a range of node indices.
     * The prepared points array contains both nodes and waypoints — this maps node indices
     * to their positions in that array.
     *
     * @param points - The prepared points collection (nodes + waypoints)
     * @param fromNodeIndex - The starting node index (inclusive)
     * @param toNodeIndex - The ending node index (inclusive)
     * @returns The start/end feature indices, or null if either node index is out of bounds
     */
    private getFeatureIndexRangeForNodes = (
        points: FeatureCollection<Point>,
        fromNodeIndex: number,
        toNodeIndex: number
    ): FeatureIndexRange | null => {
        let start = -1;
        let end = -1;
        let nodeCount = 0;
        for (let i = 0; i < points.features.length; i++) {
            if (points.features[i].properties?.isNode) {
                if (nodeCount === fromNodeIndex) start = i;
                if (nodeCount === toNodeIndex) {
                    end = i;
                    break;
                }
                nodeCount++;
            }
        }
        return start !== -1 && end !== -1 ? { start, end } : null;
    };

    /**
     * Extract flat list of legs from routing results.
     * @returns The legs array, or null if any routing result has no matchings
     */
    private extractLegsFromResults = (segmentResults: MapMatchingResults[]): RoutingLegTimeAndDistance[] | null => {
        const legs: RoutingLegTimeAndDistance[] = [];
        for (const result of segmentResults) {
            if (!result.matchings || result.matchings.length === 0) return null;
            for (const leg of result.matchings[0].legs) {
                legs.push({ distanceMeters: leg.distance, durationSeconds: leg.duration });
            }
        }
        return legs;
    };

    /**
     * Aggregate routing legs into node-to-node segments and compute physics-based travel times.
     * Legs between waypoints are combined until the next node is reached.
     *
     * @param path - The path object (provides accel/decel config)
     * @param legs - Flat list of routing legs
     * @param points - The points used for routing (to identify node boundaries)
     * @param segmentCount - Expected number of node-to-node segments
     * @returns Array of physics-based travel times per segment, or null if leg count doesn't match
     */
    private computeSegmentTimesFromLegs = (
        path: any,
        legs: RoutingLegTimeAndDistance[],
        points: FeatureCollection<Point>,
        segmentCount: number
    ): number[] | null => {
        const osrmTimes: number[] = [];
        let i = 0;

        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
            let segmentDistanceMeters = 0;
            let segmentDurationSeconds = 0;

            // Accumulate legs until we reach the next node
            while (i < legs.length) {
                segmentDistanceMeters += Math.ceil(legs[i].distanceMeters);
                segmentDurationSeconds += legs[i].durationSeconds;
                i++;
                if (i >= points.features.length - 1 || points.features[i].properties?.isNode) {
                    break;
                }
            }

            const duration = calculateSegmentDuration(path, segmentDistanceMeters, segmentDurationSeconds);
            osrmTimes.push(duration.calculatedSegmentDurationSeconds);
        }

        return osrmTimes.length === segmentCount ? osrmTimes : null;
    };

    /**
     * Calculate OSRM-based segment travel times for a checkpoint span on a path.
     * Routes the subset of nodes from fromNodeIndex to toNodeIndex through OSRM
     * and applies the physics model (accel/decel). Returns raw OSRM times without scaling.
     *
     * @param path - The path object
     * @param fromNodeIndex - Start node index (inclusive)
     * @param toNodeIndex - End node index (inclusive)
     * @returns Array of OSRM travel times per segment in the span, or null if routing fails
     */
    public calculateSegmentTimesForCheckpoint = async (
        path: any,
        fromNodeIndex: number,
        toNodeIndex: number
    ): Promise<number[] | null> => {
        const defaultRunningSpeedKmH = path.getData('defaultRunningSpeedKmH') as number;
        const defaultRunningSpeedMps = kphToMps(defaultRunningSpeedKmH);
        const routingEngine = path.getData('routingEngine') as string;
        const routingMode = path.getData('routingMode') as RoutingMode;

        const fullPathPoints = this.prepareNodesAndWaypoints(path, defaultRunningSpeedMps, routingEngine);
        const featureRange = this.getFeatureIndexRangeForNodes(fullPathPoints, fromNodeIndex, toNodeIndex);
        if (!featureRange) return null;

        const checkpointPoints: FeatureCollection<Point> = {
            type: 'FeatureCollection',
            features: fullPathPoints.features.slice(featureRange.start, featureRange.end + 1)
        };

        const routingSegments = this.getRoutingSegments(checkpointPoints, routingEngine);
        const segmentResults = await this.routeSegments(routingSegments, routingMode, defaultRunningSpeedMps);

        const legs = this.extractLegsFromResults(segmentResults);
        if (!legs) return null;

        const segmentCount = toNodeIndex - fromNodeIndex;
        return this.computeSegmentTimesFromLegs(path, legs, checkpointPoints, segmentCount);
    };

    /**
     * Scale an array of OSRM segment times so the total matches a target checkpoint time,
     * adjusting the last segment for rounding errors.
     *
     * @param timeSegmentCheckpointSeconds - The OSRM times per segment
     * @param targetTotalTimeSeconds - The desired total time for the checkpoint
     * @returns Scaled times that sum exactly to targetTotalTimeSeconds, or null if total is 0
     */
    public scaleTimesToTarget = (
        timeSegmentCheckpointSeconds: number[],
        targetTotalTimeSeconds: number
    ): number[] | null => {
        const totalOsrmTimeCheckpoint = timeSegmentCheckpointSeconds.reduce((sum, t) => sum + t, 0);
        if (totalOsrmTimeCheckpoint === 0) return null;

        const ratio = targetTotalTimeSeconds / totalOsrmTimeCheckpoint;
        const scaledTimes = timeSegmentCheckpointSeconds.map((t) => Math.round(t * ratio)); // round to nearest second

        // Math.round on each segment can cause the sum to be off by 1-2 seconds,
        // so we adjust the last segment to ensure the total matches the target exactly
        const scaledTotal = scaledTimes.reduce((sum, v) => sum + v, 0);
        if (scaledTotal !== targetTotalTimeSeconds && scaledTimes.length > 0) {
            scaledTimes[scaledTimes.length - 1] += targetTotalTimeSeconds - scaledTotal;
        }

        return scaledTimes;
    };

    public getPathGeography = async (path: any): Promise<PathGeographyResults | false> => {
        if (!this.shouldPathUpdate(path)) {
            return false;
        }

        const routingEngine = path.getData('routingEngine');
        const routingMode = path.getData('routingMode');
        const routingService = routingServiceManager.getRoutingServiceForEngine(routingEngine);
        const defaultRunningSpeedMps = kphToMps(path.getData('defaultRunningSpeedKmH', 15));

        /*if (!routingMode || !routingEngine)
        {
            path.attributes.data.geographyErrors = { error: 'transit:transitPath:errors:routingModeNecessary'};
        }*/
        const nodesAndWaypointsGeojsons = this.prepareNodesAndWaypoints(path, defaultRunningSpeedMps, routingEngine);

        try {
            // The direct path serves as the base to compare with the route
            const directPath = await this.getDirectPath(
                routingService,
                routingMode,
                defaultRunningSpeedMps,
                nodesAndWaypointsGeojsons
            );
            const routingSegments = this.getRoutingSegments(nodesAndWaypointsGeojsons, routingEngine);
            const routingResults = await this.routeSegments(routingSegments, routingMode, defaultRunningSpeedMps);

            return { direct: directPath, points: nodesAndWaypointsGeojsons, segmentResults: routingResults };
        } catch (error) {
            if ((error as any).nodes) {
                path.attributes.data.routingFailed = true;
                path.attributes.data.geographyErrors = error;
            }
            return false;
        }
    };
}

export const pathGeographyUtils = new PathGeographyUtils();

const updateGeography = async (path: any, changesInfo?: SegmentChangeInfo): Promise<{ path: any }> => {
    // TODO: Make the geography errors part of the path, when refactoring the class
    delete path.attributes.data.geographyErrors;

    path.attributes.data.routingFailed = false;
    const geographyResults = await pathGeographyUtils.getPathGeography(path);
    if (!geographyResults) {
        // TODO Move emptyGeography to PathGeographyGenerator.ts
        path.emptyGeography();
        path.validate();
        path.refreshStats();
        return { path };
    }
    const { direct, points, segmentResults } = geographyResults;

    // Process the direct path result and update the base distances/times
    if (direct.matchings.length === 0 && direct.tracepoints.some((tp) => tp === null)) {
        // Error getting the direct point, one of the terminal points is not defined
        path.attributes.data.routingFailed = true;
        path.attributes.data.geographyErrors = pathGeographyUtils.getErrorsForDirectPath(points);
        return { path };
    } else {
        path.attributes.data.directRouteBetweenTerminalsTravelTimeSeconds = Math.ceil(
            direct.matchings[0].legs[0].duration
        );
        path.attributes.data.directRouteBetweenTerminalsDistanceMeters = Math.ceil(
            direct.matchings[0].legs[0].distance
        );
    }

    try {
        generatePathGeographyFromRouting(path, points, segmentResults, changesInfo);
        path.validate();
        path.refreshStats();
        return { path };
    } catch (error) {
        console.log(error);
        path.emptyGeography();
        path.validate();
        path.refreshStats();
        return { path };
    }
};

export default updateGeography;
