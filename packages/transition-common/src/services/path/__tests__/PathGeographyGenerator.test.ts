/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitObjectStub, GenericCollectionStub } from '../../__tests__/TransitObjectStub';
import { generatePathGeographyFromRouting } from '../PathGeographyGenerator';
import { pathGeographyUtils as PathGeographyUtils } from '../PathGeographyUtils';
import { TestUtils } from 'chaire-lib-common/lib/test';
import { roundSecondsToNearestMinute } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import {
    durationFromAccelerationDecelerationDistanceAndRunningSpeed
} from 'chaire-lib-common/lib/utils/PhysicsUtils';

const node1: any = TestUtils.makePoint([-73.745618, 45.368994], { routing_radius_meters: 50, id: 'node1' }, { id: 1 });
const node2: any = TestUtils.makePoint([-73.742861, 45.361682], { routing_radius_meters: 100, id: 'node2' }, { id: 2 });
const node3: any = TestUtils.makePoint([-73.738927, 45.361852], { routing_radius_meters: 10, id: 'node3' }, { id: 3 });
const node4: any = TestUtils.makePoint([-73.731251, 45.368103], { routing_radius_meters: 50, id: 'node4', default_dwell_time_seconds: 120 }, { id: 4 });
const node5: any = TestUtils.makePoint([-73.734788, 45.372252], { id: 'node5' }, { id: 5 });
const node6: any = TestUtils.makePoint([-73.749821, 45.373132], { id: 'node6' }, { id: 6 });

const nodeCollection = [node1, node2, node3, node4, node5, node6];
const waypoint1: [number, number] = [-73.74382202603918, 45.36504595320852];
const waypoint2: [number, number] = [-73.74257193644237, 45.36355549004705];
const waypoint3: [number, number] = [-73.73639725146167, 45.363608721550406];
const waypoint4: [number, number] = [-73.73499563585311, 45.36717511817895];
const waypoint5: [number, number] = [-73.73067714451926, 45.37201866994127];

const line = new TransitObjectStub({
    id: 'line1',
});
const collectionManager = { get: (_str) => _str === 'nodes' ? new GenericCollectionStub(nodeCollection) : new GenericCollectionStub([]) };



const DEFAULT_ACC_DEC = 1;
const DEFAULT_SPEED = 36;
const DEFAULT_DWELL_TIME = 25;
const LAYOVER_TIME = 180;
const DEFAULT_MAX_SPEED = 110;

class TransitPathStub extends TransitObjectStub {

    static clone(obj: TransitPathStub): TransitPathStub {
        return new TransitPathStub(JSON.parse(JSON.stringify(obj.attributes)));
    }

    _collectionManager: any;

    constructor(attributes: any) {
        super(attributes);
        this._collectionManager = collectionManager;
    }

    getLine(): TransitObjectStub | undefined {
        return this.get('line_id') === line.get('id') ? line : undefined;
    }

    getMode(): string | undefined {
        const lineObj = this.getLine();
        return lineObj ? lineObj.get('mode') : this.get('mode');
    }

    getDwellTimeSecondsAtNode(nodeDwellTimeSeconds: number | undefined) : number {
        return nodeDwellTimeSeconds || DEFAULT_DWELL_TIME;
    }
}
const sum = (total: number, num: number) => { return total + num; };
const twoDecimals = (num: number, denum: number) => { return Math.round(num / denum * 100) / 100; };

test('Generate From Routing Total Calculations', async() => {
    /* Test path between 2 nodes with engine */
    let simplePath = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine'],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED
        }
    }) as any;

    // Prepare path mapping results
    const segmentOneRoutingResult = {
        tracepoints: [node1, node4],
        matchings:[
            {
                confidence: 99,
                distance: 1000,
                duration: 66.67,
                legs: [{
                    distance: 1000,
                    duration: 66.67,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] }
                    }]
                }]
            }
        ]
    };

    let nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(simplePath, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(simplePath, nodeGeojson, [segmentOneRoutingResult]);
    expect(simplePath.attributes.data.routingFailed).toBeFalsy();
    expect(simplePath.attributes.segments).toBeTruthy();
    expect(simplePath.attributes.segments.length).toEqual(1);
    expect(simplePath.attributes.segments).toEqual([0]);
    expect(simplePath.attributes.geography).toEqual({
        type: 'LineString' as const,
        coordinates: [node1.geometry.coordinates, node4.geometry.coordinates]
    });
    let expectedNoDwellTimes = [66.67];
    let expectedTravelTimes = [82];
    let expectedDistances = [1000];
    const expectedDwellTime = 120;
    let expectedTotalTime = roundSecondsToNearestMinute(expectedTravelTimes.reduce(sum, 0), Math.ceil);
    let expectedTotalDistance = expectedDistances.reduce(sum, 0);
    let expectedNoDwellTime =roundSecondsToNearestMinute(expectedNoDwellTimes.reduce(sum, 0), Math.ceil);
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTimes[0],
        distanceMeters: expectedDistances[0]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, 120],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: roundSecondsToNearestMinute(expectedNoDwellTime, Math.ceil),
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: expectedDwellTime + expectedTotalTime,
        operatingTimeWithLayoverTimeSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, expectedNoDwellTime),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, (expectedTotalTime + expectedDwellTime)),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, (expectedTotalTime + expectedDwellTime + LAYOVER_TIME))
    }));

    /* Test path between 2 nodes with engine custom type */
    simplePath = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id ],
        data: {
            nodeTypes: ['engine custom', 'engine custom'],
            routingEngine: 'engine custom',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED
        }
    }) as any;

    nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(simplePath, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(simplePath, nodeGeojson, [segmentOneRoutingResult]);
    expect(simplePath.attributes.data.routingFailed).toBeFalsy();
    expect(simplePath.attributes.segments).toBeTruthy();
    expect(simplePath.attributes.segments.length).toEqual(1);
    expect(simplePath.attributes.segments).toEqual([0]);
    expect(simplePath.attributes.geography).toEqual({
        type: 'LineString' as const,
        coordinates: [node1.geometry.coordinates, node4.geometry.coordinates]
    });
    expectedNoDwellTimes = [100];
    expectedTravelTimes = [110];
    expectedDistances = [1000];
    expectedTotalTime = roundSecondsToNearestMinute(expectedTravelTimes.reduce(sum, 0), Math.ceil);
    expectedTotalDistance = expectedDistances.reduce(sum, 0);
    expectedNoDwellTime = roundSecondsToNearestMinute(expectedNoDwellTimes.reduce(sum, 0) , Math.ceil);
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTimes[0],
        distanceMeters: expectedDistances[0]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, 120],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: roundSecondsToNearestMinute(expectedNoDwellTime, Math.ceil),
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: expectedDwellTime + expectedTotalTime,
        operatingTimeWithLayoverTimeSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, expectedNoDwellTime),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, (expectedTotalTime + expectedDwellTime)),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, (expectedTotalTime + expectedDwellTime + LAYOVER_TIME))
    }));
});

test('Generate From Routing Simple Use Cases', async() => {
    /* Test with a 3 segments path */
    const simplePath = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id, node6.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine', 'engine'],
            waypoints: [
                [],
                [],
                [],
            ],
            waypointTypes: [
                [],
                [],
                [],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED
        }
    }) as any;

    // Prepare path mapping results
    const segmentOneRoutingResult = {
        tracepoints: [node1, node4, node6],
        matchings:[
            {
                confidence: 99,
                distance: 2500,
                duration: 166.67,
                legs: [{
                    distance: 1500,
                    duration: 100,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node1.geometry.coordinates, waypoint1, node4.geometry.coordinates] }
                    }]
                }, {
                    distance: 1000,
                    duration: 66.67,
                    steps: [{
                        distance: 1000,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] }
                    }],
                }]
            }
        ]
    };

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(simplePath, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(simplePath, nodeGeojson, [segmentOneRoutingResult]);
    expect(simplePath.attributes.data.routingFailed).toBeFalsy();
    expect(simplePath.attributes.segments).toBeTruthy();
    expect(simplePath.attributes.segments.length).toEqual(2);
    expect(simplePath.attributes.segments).toEqual([0, 2]);
    expect(simplePath.attributes.geography).toEqual({
        type: 'LineString' as const,
        coordinates: [node1.geometry.coordinates, waypoint1, node4.geometry.coordinates, node6.geometry.coordinates]
    });
    const expectedNoDwellTimes = [100, 66.67];
    const expectedTravelTime = [115, 82];
    const expectedDistances = [1500, 1000];
    const expectedDwellTime = 145;
    const expectedTotalTime = expectedTravelTime.reduce(sum, 0);
    const expectedTotalDistance = expectedDistances.reduce(sum, 0);
    const expectedNoDwellTime = expectedNoDwellTimes.reduce(sum, 0);
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTime[0],
        distanceMeters: expectedDistances[0]
    }, {
        travelTimeSeconds: expectedTravelTime[1],
        distanceMeters: expectedDistances[1]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, 120, 25],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: roundSecondsToNearestMinute(expectedNoDwellTime, Math.ceil),
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: roundSecondsToNearestMinute(expectedDwellTime + expectedTotalTime, Math.ceil),
        operatingTimeWithLayoverTimeSeconds: roundSecondsToNearestMinute(expectedDwellTime + expectedTotalTime, Math.ceil) + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: roundSecondsToNearestMinute(expectedDwellTime + expectedTotalTime, Math.ceil) + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestMinute(expectedNoDwellTime, Math.ceil)),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestMinute(expectedTotalTime + expectedDwellTime, Math.ceil)),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestMinute(expectedTotalTime + expectedDwellTime, Math.ceil) + LAYOVER_TIME)
    }));
});

test('Generate From Routing', async() => {
    /* Test with a 3 segments path */
    const complexPath = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id, node6.properties.id ],
        data: {
            nodeTypes: ['engine', 'manual', 'engine'],
            waypoints: [
                [waypoint1],
                [waypoint3],
                [waypoint5],
            ],
            waypointTypes: [
                ['engine'],
                ['manual'],
                ['engine'],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED
        }
    }) as any;

    // Prepare path mapping results
    const segmentOneRoutingResult = {
        tracepoints: [node1, TestUtils.makePoint(waypoint1)],
        matchings:[
            {
                confidence: 99,
                distance: 1500,
                duration: 100,
                legs: [{
                    distance: 1500,
                    duration: 100,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node1.geometry.coordinates, waypoint1] }
                    }],
                }]
            }
        ]
    };
    const segmentTwoRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint1), node4, TestUtils.makePoint(waypoint3)],
        matchings:[
            {
                confidence: 99,
                distance: 3000,
                duration: 300,
                legs: [{
                    distance: 1500,
                    duration: 150,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint1, node4.geometry.coordinates] }
                    }],
                }, {
                    distance: 1500,
                    duration: 150,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node4.geometry.coordinates, waypoint3] }
                    }],
                }]
            }
        ]
    };
    const segmentThreeRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint3), node6, TestUtils.makePoint(waypoint5)],
        matchings:[
            {
                confidence: 99,
                distance: 2500,
                duration: 166.67,
                legs: [{
                    distance: 1000,
                    duration: 66.67,
                    steps: [{
                        distance: 1000,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint3, node6.geometry.coordinates] }
                    }],
                }, {
                    distance: 1500,
                    duration: 100,
                    steps: [{
                        distance: 1000,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node6.geometry.coordinates, waypoint2] }
                    },
                    {
                        distance: 250,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint2, waypoint4] }
                    },
                    {
                        distance: 250,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint4, waypoint5] }
                    }],
                }]
            }
        ]
    };
    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(complexPath, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(complexPath, nodeGeojson, [segmentOneRoutingResult, segmentTwoRoutingResult, segmentThreeRoutingResult]);
    expect(complexPath.attributes.data.routingFailed).toBeFalsy();
    expect(complexPath.attributes.segments).toBeTruthy();
    expect(complexPath.attributes.segments.length).toEqual(3);
    expect(complexPath.attributes.segments).toEqual([0, 2, 4]);
    const expectedNoDwellTimes = [200, 166.67, 100];
    const expectedTravelTime = [262, 229];
    const expectedDistances = [3000, 2500];
    const expectedDwellTime = 145;
    const expectedTotalTime = expectedTravelTime.reduce(sum, 0);
    const expectedTotalDistance = expectedDistances.reduce(sum, 0);
    const expectedNoDwellTime = roundSecondsToNearestMinute(expectedNoDwellTimes.reduce(sum, 0), Math.ceil);
    expect(complexPath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTime[0],
        distanceMeters: expectedDistances[0]
    }, {
        travelTimeSeconds: expectedTravelTime[1],
        distanceMeters: expectedDistances[1]
    }, {
        travelTimeSeconds: 100,
        distanceMeters: 1500
    }]);

    expect(complexPath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, 120, 25],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds:roundSecondsToNearestMinute(expectedNoDwellTime, Math.ceil),
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: roundSecondsToNearestMinute(expectedDwellTime + expectedTotalTime, Math.ceil),
        operatingTimeWithLayoverTimeSeconds: roundSecondsToNearestMinute(expectedDwellTime + expectedTotalTime, Math.ceil) + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: roundSecondsToNearestMinute(expectedDwellTime + expectedTotalTime, Math.ceil)+ LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestMinute(expectedNoDwellTime, Math.ceil)),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestMinute(expectedTotalTime + expectedDwellTime, Math.ceil)),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance,roundSecondsToNearestMinute(expectedTotalTime + expectedDwellTime, Math.ceil) + LAYOVER_TIME)
    }));
});

describe('Rail mode curve-aware vs standard calculation branching', () => {
    /**
     * For the curve-aware branch to be taken, ALL four conditions must hold:
     *   1. routingEngine === 'manual'
     *   2. isRailMode(pathMode)  — mode is rail, highSpeedRail, metro, tram, or tramTrain
     *   3. shouldUseCurveAnalysis(resolution) — geometry resolution is 'high'
     *   4. globalCoordinates.length >= 3
     *
     * Condition 3 means we need geometry with:
     *   - At least one waypoint between stations (not just station-to-station)
     *   - All deflection angles < 10° OR all point spacings < 50m
     *
     * We build a "smooth arc" of closely-spaced points between node1 and node4
     * where every intermediate deflection angle is small (< 10°) so the
     * geometry is classified as 'high' resolution.
     */

    // Build a smooth arc between node1 and node4 with ~20 intermediate points.
    // node1 = [-73.745618, 45.368994], node4 = [-73.731251, 45.368103]
    // We interpolate linearly (essentially a slight curve via latitude bulge)
    // so each deflection stays well under 10 degrees.
    const arcCoords: [number, number][] = (() => {
        const start = node1.geometry.coordinates as [number, number];
        const end = node4.geometry.coordinates as [number, number];
        const n = 20; // intermediate points
        const coords: [number, number][] = [start];
        for (let i = 1; i <= n; i++) {
            const t = i / (n + 1);
            const lng = start[0] + t * (end[0] - start[0]);
            // Add a small lateral bulge (sinusoidal) to create gentle curves
            const lat = start[1] + t * (end[1] - start[1]) + 0.0005 * Math.sin(Math.PI * t);
            coords.push([lng, lat]);
        }
        coords.push(end);
        return coords;
    })();

    // Total routing distance (arbitrary but consistent value for the leg)
    const totalLegDistance = 1500;
    const totalLegDuration = 100;

    /**
     * Build a routing result whose geometry step uses the full arc coords.
     * The routing result has a single matching with a single leg.
     */
    const makeArcRoutingResult = () => ({
        tracepoints: [node1, node4],
        matchings: [{
            confidence: 99,
            distance: totalLegDistance,
            duration: totalLegDuration,
            legs: [{
                distance: totalLegDistance,
                duration: totalLegDuration,
                steps: [{
                    distance: totalLegDistance,
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: arcCoords
                    }
                }]
            }]
        }]
    });

    /** Routing result with only 2 coordinates (straight line, no waypoints). */
    const makeStraightRoutingResult = () => ({
        tracepoints: [node1, node4],
        matchings: [{
            confidence: 99,
            distance: totalLegDistance,
            duration: totalLegDuration,
            legs: [{
                distance: totalLegDistance,
                duration: totalLegDuration,
                steps: [{
                    distance: totalLegDistance,
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: [
                            node1.geometry.coordinates,
                            node4.geometry.coordinates
                        ]
                    }
                }]
            }]
        }]
    });

    const makeLineWithMode = (mode: string) =>
        new TransitObjectStub({ id: 'line1', mode });

    const makePathStub = (lineObj: TransitObjectStub, routingEngine: string) => {
        const railCollectionManager = {
            get: (_str: string) =>
                _str === 'nodes'
                    ? new GenericCollectionStub(nodeCollection)
                    : new GenericCollectionStub([])
        };
        const pathStub = new TransitPathStub({
            id: 'pathRail1',
            line_id: lineObj.get('id'),
            nodes: [node1.properties.id, node4.properties.id],
            data: {
                nodeTypes: ['manual', 'manual'],
                routingEngine,
                routingMode: 'driving',
                defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
                defaultAcceleration: DEFAULT_ACC_DEC,
                defaultDeceleration: DEFAULT_ACC_DEC,
                defaultRunningSpeedKmH: DEFAULT_SPEED,
                maxRunningSpeedKmH: DEFAULT_MAX_SPEED
            }
        }) as any;
        pathStub._collectionManager = railCollectionManager;
        pathStub.getLine = () => lineObj;
        pathStub.getMode = () => lineObj.get('mode');
        return pathStub;
    };

    /**
     * Compute the standard (non-curve) travel time for a segment using
     * the same formula as PathGeographyGenerator's else branch:
     *   Math.ceil(durationFromAccelerationDecelerationDistanceAndRunningSpeed(...))
     */
    const computeStandardTravelTime = (distance: number, runningSpeedMps: number) => {
        return Math.ceil(
            durationFromAccelerationDecelerationDistanceAndRunningSpeed(
                DEFAULT_ACC_DEC,
                DEFAULT_ACC_DEC,
                distance,
                runningSpeedMps
            )
        );
    };

    // For non-engine routing, running speed = kphToMps(DEFAULT_SPEED)
    const defaultRunningSpeedMps = DEFAULT_SPEED / 3.6; // 10 m/s

    test.each([
        {
            desc: 'rail + manual + smooth arc → curve-aware branch (travel time differs from standard)',
            mode: 'rail',
            routingEngine: 'manual'
        },
        {
            desc: 'highSpeedRail + manual + smooth arc → curve-aware branch',
            mode: 'highSpeedRail',
            routingEngine: 'manual'
        },
        {
            desc: 'metro + manual + smooth arc → curve-aware branch',
            mode: 'metro',
            routingEngine: 'manual'
        },
        {
            desc: 'tram + manual + smooth arc → curve-aware branch',
            mode: 'tram',
            routingEngine: 'manual'
        }
    ])('$desc', ({ mode, routingEngine }) => {
        const railLine = makeLineWithMode(mode);
        const pathStub = makePathStub(railLine, routingEngine);
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathStub, defaultRunningSpeedMps);
        generatePathGeographyFromRouting(pathStub, nodeGeojson, [makeArcRoutingResult()]);

        expect(pathStub.attributes.data.routingFailed).toBeFalsy();
        expect(pathStub.attributes.segments.length).toEqual(1);
        // Should have all arc coordinates (22 = 20 intermediate + 2 endpoints)
        expect(pathStub.attributes.geography.coordinates.length).toEqual(arcCoords.length);

        const segData = pathStub.attributes.data.segments[0];
        expect(segData.distanceMeters).toEqual(totalLegDistance);
        expect(segData.travelTimeSeconds).toBeGreaterThan(0);

        // The curve-aware travel time should differ from the standard formula
        // because the curve analysis accounts for radius-based speed limits.
        const standardTime = computeStandardTravelTime(totalLegDistance, defaultRunningSpeedMps);
        expect(segData.travelTimeSeconds).not.toEqual(standardTime);
    });

    test.each([
        {
            desc: 'rail + engine → standard branch (OSRM speed used, no curves analysis)',
            mode: 'rail',
            routingEngine: 'engine'
        },
        {
            desc: 'tram + engine → standard branch (not manual routing)',
            mode: 'tram',
            routingEngine: 'engine'
        },
        {
            desc: 'tram + engineCustom → no curves analysis',
            mode: 'tram',
            routingEngine: 'engineCustom'
        }
    ])('$desc', ({ mode, routingEngine }) => {
        const railLine = makeLineWithMode(mode);
        const pathStub = makePathStub(railLine, routingEngine);
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathStub, defaultRunningSpeedMps);
        generatePathGeographyFromRouting(pathStub, nodeGeojson, [makeArcRoutingResult()]);

        expect(pathStub.attributes.data.routingFailed).toBeFalsy();
        expect(pathStub.attributes.segments.length).toEqual(1);

        const segData = pathStub.attributes.data.segments[0];
        expect(segData.travelTimeSeconds).toBeGreaterThan(0);

        // 'engine' derives running speed from OSRM (distance/duration = 15 m/s).
        // 'engineCustom' uses defaultRunningSpeedKmH (36 km/h = 10 m/s).
        // Neither triggers curve-aware analysis (only 'manual' does).
        const runningSpeedMps = routingEngine === 'engine'
            ? totalLegDistance / totalLegDuration
            : defaultRunningSpeedMps;
        const expectedTime = computeStandardTravelTime(totalLegDistance, runningSpeedMps);
        expect(segData.travelTimeSeconds).toEqual(expectedTime);
    });

    test.each([
        {
            desc: 'bus + manual → standard branch (not a rail mode)',
            mode: 'bus',
            routingEngine: 'manual'
        },
        {
            desc: 'monorail + manual → standard branch (not a rail mode)',
            mode: 'monorail',
            routingEngine: 'manual'
        }
    ])('$desc', ({ mode, routingEngine }) => {
        const busLine = makeLineWithMode(mode);
        const pathStub = makePathStub(busLine, routingEngine);
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathStub, defaultRunningSpeedMps);
        generatePathGeographyFromRouting(pathStub, nodeGeojson, [makeArcRoutingResult()]);

        expect(pathStub.attributes.data.routingFailed).toBeFalsy();
        expect(pathStub.attributes.segments.length).toEqual(1);

        const segData = pathStub.attributes.data.segments[0];
        // Non-rail mode: standard formula with defaultRunningSpeedKmH
        const expectedTime = computeStandardTravelTime(totalLegDistance, defaultRunningSpeedMps);
        expect(segData.travelTimeSeconds).toEqual(expectedTime);
    });

    test('rail + manual + only 2 coordinates → standard branch (geometry too sparse)', () => {
        const railLine = makeLineWithMode('rail');
        const pathStub = makePathStub(railLine, 'manual');
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathStub, defaultRunningSpeedMps);
        generatePathGeographyFromRouting(pathStub, nodeGeojson, [makeStraightRoutingResult()]);

        expect(pathStub.attributes.data.routingFailed).toBeFalsy();
        expect(pathStub.attributes.geography.coordinates.length).toEqual(2);

        const segData = pathStub.attributes.data.segments[0];
        // With only 2 coordinates the geometry resolution is 'almostStraight',
        // so the standard formula is used even for rail + non-engine.
        const expectedTime = computeStandardTravelTime(totalLegDistance, defaultRunningSpeedMps);
        expect(segData.travelTimeSeconds).toEqual(expectedTime);
    });

    test('same geometry: rail + manual (curve-aware) vs bus + manual (standard) produce different times', () => {
        // Rail path — should use curve-aware branch
        const railLine = makeLineWithMode('rail');
        const curvePath = makePathStub(railLine, 'manual');
        generatePathGeographyFromRouting(
            curvePath,
            PathGeographyUtils.prepareNodesAndWaypoints(curvePath, defaultRunningSpeedMps),
            [makeArcRoutingResult()]
        );

        // Bus path — should use standard branch
        const busLine = makeLineWithMode('bus');
        const stdPath = makePathStub(busLine, 'manual');
        generatePathGeographyFromRouting(
            stdPath,
            PathGeographyUtils.prepareNodesAndWaypoints(stdPath, defaultRunningSpeedMps),
            [makeArcRoutingResult()]
        );

        expect(curvePath.attributes.data.routingFailed).toBeFalsy();
        expect(stdPath.attributes.data.routingFailed).toBeFalsy();

        // Same distance
        expect(curvePath.attributes.data.segments[0].distanceMeters)
            .toEqual(stdPath.attributes.data.segments[0].distanceMeters);

        // Different travel times — curve-aware branch accounts for radius-based speed limits
        expect(curvePath.attributes.data.segments[0].travelTimeSeconds)
            .not.toEqual(stdPath.attributes.data.segments[0].travelTimeSeconds);
    });
});

test('Generate From Routing With Errors', async() => {
    /* Test with a 3 segments path */
    const complexPath = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id, node6.properties.id ],
        data: {
            nodeTypes: ['engine', 'manual', 'engine'],
            waypoints: [
                [waypoint1],
                [waypoint3],
                [waypoint5],
            ],
            waypointTypes: [
                ['engine'],
                ['manual'],
                ['engine'],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
        }
    }) as any;

    // Prepare path mapping results
    const segmentOneRoutingResult = {
        tracepoints: [node1, TestUtils.makePoint(waypoint1)],
        matchings:[
            {
                confidence: 99,
                distance: 1500,
                duration: 200,
                legs: [{
                    distance: 1500,
                    duration: 200,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node1.geometry.coordinates, waypoint1] }
                    }],
                }]
            }
        ]
    };
    const segmentTwoRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint1), node4, TestUtils.makePoint(waypoint3)],
        matchings:[
            {
                confidence: 99,
                distance: 3000,
                duration: 400,
                legs: [{
                    distance: 1500,
                    duration: 200,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint1, node4.geometry.coordinates] }
                    }],
                }, {
                    distance: 1500,
                    duration: 200,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node4.geometry.coordinates, waypoint3] }
                    }],
                }]
            }
        ]
    };
    const segmentThreeRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint3), null, TestUtils.makePoint(waypoint5)],
        matchings:[
            {
                confidence: 99,
                distance: 2500,
                duration: 300,
                legs: [{
                    distance: 2500,
                    duration: 300,
                    steps: [{
                        distance: 2500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint3, waypoint5] }
                    }],
                }]
            }
        ]
    };
    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(complexPath, DEFAULT_SPEED/3.6);
    let exception: any = false;
    try {
        generatePathGeographyFromRouting(complexPath, nodeGeojson, [segmentOneRoutingResult, segmentTwoRoutingResult, segmentThreeRoutingResult]);
    } catch (error) {
        exception = error;
    }
    expect(exception).toBeTruthy();
    expect(complexPath.attributes.data.routingFailed).toBeTruthy();
    expect(complexPath.attributes.data.geographyErrors).toBeTruthy();
    expect(complexPath.attributes.data.geographyErrors.nodes.length).toEqual(1);
    expect(complexPath.attributes.data.geographyErrors.nodes[0].geometry.coordinates).toEqual(node6.geometry.coordinates);
    expect(complexPath.attributes.data.geographyErrors.waypoints.length).toEqual(0);
    expect(complexPath.attributes.segments).toBeFalsy();
});
