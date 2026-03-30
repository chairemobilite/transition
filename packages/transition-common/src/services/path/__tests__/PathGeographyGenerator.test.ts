/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { TransitObjectStub, GenericCollectionStub } from '../../__tests__/TransitObjectStub';
import { generatePathGeographyFromRouting } from '../PathGeographyGenerator';
import { pathGeographyUtils as PathGeographyUtils } from '../PathGeographyUtils';
import { TestUtils } from 'chaire-lib-common/lib/test';
import { durationFromAccelerationDecelerationDistanceAndRunningSpeed } from 'chaire-lib-common/lib/utils/PhysicsUtils';

// Intentionally different from DEFAULT_DWELL_TIME to test that node-level overrides take precedence over the path default
const NODE4_DWELL_TIME = 120;

const node1: any = TestUtils.makePoint([-73.745618, 45.368994], { routing_radius_meters: 50, id: 'node1' }, { id: 1 });
const node2: any = TestUtils.makePoint([-73.742861, 45.361682], { routing_radius_meters: 100, id: 'node2' }, { id: 2 });
const node3: any = TestUtils.makePoint([-73.738927, 45.361852], { routing_radius_meters: 10, id: 'node3' }, { id: 3 });
const node4: any = TestUtils.makePoint([-73.731251, 45.368103], { routing_radius_meters: 50, id: 'node4', default_dwell_time_seconds: NODE4_DWELL_TIME }, { id: 4 });
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

    get collectionManager() {
        return this._collectionManager;
    }

    getLine(): TransitObjectStub | undefined {
        return this.get('line_id') === line.get('id') ? line : undefined;
    }

    getDwellTimeSecondsAtNode(nodeDwellTimeSeconds: number | undefined) : number {
        return nodeDwellTimeSeconds || DEFAULT_DWELL_TIME;
    }
}
const sum = (total: number, num: number) => { return total + num; };
const twoDecimals = (num: number, denum: number) => { return Math.round(num / denum * 100) / 100; };
const segmentDuration = (distanceMeters: number, routedDurationSeconds: number) =>
    durationFromAccelerationDecelerationDistanceAndRunningSpeed(DEFAULT_ACC_DEC, DEFAULT_ACC_DEC, distanceMeters, distanceMeters / routedDurationSeconds);

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
    let expectedTravelTimes = [segmentDuration(1000, 66.67)];
    let expectedDistances = [1000];
    const expectedDwellTime = NODE4_DWELL_TIME;
    let expectedTotalTime = expectedTravelTimes.reduce(sum, 0);
    let expectedTotalDistance = expectedDistances.reduce(sum, 0);
    let expectedNoDwellTime = expectedNoDwellTimes.reduce(sum, 0);
    let expectedOperatingTime = expectedTotalTime + expectedDwellTime;
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTimes[0],
        distanceMeters: expectedDistances[0]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, NODE4_DWELL_TIME],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: expectedNoDwellTime,
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: expectedOperatingTime,
        operatingTimeWithLayoverTimeSeconds: expectedOperatingTime + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: expectedOperatingTime + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, expectedNoDwellTime),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, expectedOperatingTime),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, expectedOperatingTime + LAYOVER_TIME)
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
    expectedTotalTime = expectedTravelTimes.reduce(sum, 0);
    expectedTotalDistance = expectedDistances.reduce(sum, 0);
    expectedNoDwellTime = expectedNoDwellTimes.reduce(sum, 0);
    expectedOperatingTime = expectedTotalTime + expectedDwellTime;
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTimes[0],
        distanceMeters: expectedDistances[0]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, NODE4_DWELL_TIME],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: expectedNoDwellTime,
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: expectedOperatingTime,
        operatingTimeWithLayoverTimeSeconds: expectedOperatingTime + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: expectedOperatingTime + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, expectedNoDwellTime),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, expectedOperatingTime),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, expectedOperatingTime + LAYOVER_TIME)
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
    const expectedTravelTime = [segmentDuration(1500, 100), segmentDuration(1000, 66.67)];
    const expectedDistances = [1500, 1000];
    const expectedDwellTime = NODE4_DWELL_TIME + 25;
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
        dwellTimeSeconds: [0, NODE4_DWELL_TIME, 25],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: expectedNoDwellTime,
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: expectedDwellTime + expectedTotalTime,
        operatingTimeWithLayoverTimeSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, expectedNoDwellTime),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, expectedTotalTime + expectedDwellTime),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, expectedTotalTime + expectedDwellTime + LAYOVER_TIME)
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
    // Use leg-level additions to match the floating point accumulation in the production code
    const expectedNoDwellTimes = [200, 100 + 66.67, 100];
    const expectedTravelTime = [segmentDuration(1500 + 1500, 100 + 150), segmentDuration(1500 + 1000, 150 + 66.67)];
    const expectedDistances = [1500 + 1500, 1500 + 1000];
    const expectedDwellTime = NODE4_DWELL_TIME + 25;
    const expectedTotalTime = expectedTravelTime.reduce(sum, 0);
    const expectedTotalDistance = expectedDistances.reduce(sum, 0);
    const expectedNoDwellTime = expectedNoDwellTimes.reduce(sum, 0);
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
        dwellTimeSeconds: [0, NODE4_DWELL_TIME, 25],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: expectedNoDwellTime,
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: expectedDwellTime + expectedTotalTime,
        operatingTimeWithLayoverTimeSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: expectedDwellTime + expectedTotalTime + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, expectedNoDwellTime),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, expectedTotalTime + expectedDwellTime),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, expectedTotalTime + expectedDwellTime + LAYOVER_TIME)
    }));
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

describe('Node insert and remove operations', () => {
    // Initial path: [node1, node2, node4, node6] with 3 segments
    // Dwell times: node4 = 120s (custom), all others = 25s (default)
    const computeExpectedRatio = (unchangedSegments: { previousTime: number; distance: number; routedDuration: number }[]) => {
        let ratioCumulated = 0;
        for (const seg of unchangedSegments) {
            ratioCumulated += seg.previousTime / segmentDuration(seg.distance, seg.routedDuration);
        }
        return ratioCumulated / unchangedSegments.length;
    };

    const initialPathData: any = {
        id: 'path1',
        line_id: line.get('id'),
        nodes: [node1.properties.id, node2.properties.id, node4.properties.id, node6.properties.id],
        data: {
            nodeTypes: ['engine', 'engine', 'engine', 'engine'],
            waypoints: [[], [], [], []],
            waypointTypes: [[], [], [], []],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
                { travelTimeSeconds: 82, distanceMeters: 1000 },
                { travelTimeSeconds: 95, distanceMeters: 1200 },
            ],
            dwellTimeSeconds: [0, DEFAULT_DWELL_TIME, NODE4_DWELL_TIME, DEFAULT_DWELL_TIME],
        }
    };

    test('insert node at beginning', async () => {
        // Previous: [node1, node2, node4, node6] (3 segs), inserting node3 at index 0
        // Current: [node3, node1, node2, node4, node6] (4 segs)
        const pathData = _cloneDeep(initialPathData);
        pathData.nodes = [node3.properties.id, node1.properties.id, node2.properties.id, node4.properties.id, node6.properties.id];
        pathData.data.nodeTypes = ['engine', 'engine', 'engine', 'engine', 'engine'];
        pathData.data.waypoints = [[], [], [], [], []];
        pathData.data.waypointTypes = [[], [], [], [], []];

        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node3, node1, node2, node4, node6],
            matchings: [{
                confidence: 99, distance: 4500, duration: 300,
                legs: [
                    { distance: 800, duration: 53.34, steps: [{ distance: 800, geometry: { type: 'LineString' as const, coordinates: [node3.geometry.coordinates, node1.geometry.coordinates] } }] },
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] } }] },
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'insert', index: 0 } });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(4);
        // Seg 0 is new (insert at 0), seg 1-3 map to previous 0-2
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialPathData.data.segments[0].travelTimeSeconds);
        expect(path.attributes.data.segments[2].travelTimeSeconds).toEqual(initialPathData.data.segments[1].travelTimeSeconds);
        expect(path.attributes.data.segments[3].travelTimeSeconds).toEqual(initialPathData.data.segments[2].travelTimeSeconds);
        // New segment 0: physics duration scaled by ratio from unchanged segments
        const initialSegments = initialPathData.data.segments;
        const legsAfterInsert = routingResult.matchings[0].legs;
        const ratio = computeExpectedRatio([
            { previousTime: initialSegments[0].travelTimeSeconds, distance: legsAfterInsert[1].distance, routedDuration: legsAfterInsert[1].duration },
            { previousTime: initialSegments[1].travelTimeSeconds, distance: legsAfterInsert[2].distance, routedDuration: legsAfterInsert[2].duration },
            { previousTime: initialSegments[2].travelTimeSeconds, distance: legsAfterInsert[3].distance, routedDuration: legsAfterInsert[3].duration },
        ]);
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(
            segmentDuration(legsAfterInsert[0].distance, legsAfterInsert[0].duration) * ratio
        );
    });

    test('insert node in middle', async () => {
        // Previous: [node1, node2, node4, node6] (3 segs), inserting node3 at index 2
        // Current: [node1, node2, node3, node4, node6] (4 segs)
        const pathData = _cloneDeep(initialPathData);
        pathData.nodes = [node1.properties.id, node2.properties.id, node3.properties.id, node4.properties.id, node6.properties.id];
        pathData.data.nodeTypes = ['engine', 'engine', 'engine', 'engine', 'engine'];
        pathData.data.waypoints = [[], [], [], [], []];
        pathData.data.waypointTypes = [[], [], [], [], []];

        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node1, node2, node3, node4, node6],
            matchings: [{
                confidence: 99, distance: 3700, duration: 246.68,
                legs: [
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] } }] },
                    { distance: 600, duration: 40, steps: [{ distance: 600, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node3.geometry.coordinates] } }] },
                    { distance: 400, duration: 26.67, steps: [{ distance: 400, geometry: { type: 'LineString' as const, coordinates: [node3.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'insert', index: 2 } });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(4);
        // Seg 0 maps to previous 0, seg 1-2 are new (split), seg 3 maps to previous 2
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(initialPathData.data.segments[0].travelTimeSeconds);
        expect(path.attributes.data.segments[3].travelTimeSeconds).toEqual(initialPathData.data.segments[2].travelTimeSeconds);
        // New segments 1 and 2: physics duration scaled by ratio from unchanged segments 0 and 3
        const initialSegments = initialPathData.data.segments;
        const legsAfterInsert = routingResult.matchings[0].legs;
        const ratio = computeExpectedRatio([
            { previousTime: initialSegments[0].travelTimeSeconds, distance: legsAfterInsert[0].distance, routedDuration: legsAfterInsert[0].duration },
            { previousTime: initialSegments[2].travelTimeSeconds, distance: legsAfterInsert[3].distance, routedDuration: legsAfterInsert[3].duration },
        ]);
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(
            segmentDuration(legsAfterInsert[1].distance, legsAfterInsert[1].duration) * ratio
        );
        expect(path.attributes.data.segments[2].travelTimeSeconds).toEqual(
            segmentDuration(legsAfterInsert[2].distance, legsAfterInsert[2].duration) * ratio
        );
    });

    test('insert node at end', async () => {
        // Previous: [node1, node2, node4, node6] (3 segs), inserting node3 at end (index 4)
        // Current: [node1, node2, node4, node6, node3] (4 segs)
        const pathData = _cloneDeep(initialPathData);
        pathData.nodes = [node1.properties.id, node2.properties.id, node4.properties.id, node6.properties.id, node3.properties.id];
        pathData.data.nodeTypes = ['engine', 'engine', 'engine', 'engine', 'engine'];
        pathData.data.waypoints = [[], [], [], [], []];
        pathData.data.waypointTypes = [[], [], [], [], []];

        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node1, node2, node4, node6, node3],
            matchings: [{
                confidence: 99, distance: 4500, duration: 300.01,
                legs: [
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] } }] },
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                    { distance: 800, duration: 53.34, steps: [{ distance: 800, geometry: { type: 'LineString' as const, coordinates: [node6.geometry.coordinates, node3.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'insert', index: 4 } });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(4);
        // Seg 0-2 map to previous 0-2, seg 3 is new
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(initialPathData.data.segments[0].travelTimeSeconds);
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialPathData.data.segments[1].travelTimeSeconds);
        expect(path.attributes.data.segments[2].travelTimeSeconds).toEqual(initialPathData.data.segments[2].travelTimeSeconds);
        // New segment 3: physics duration scaled by ratio from unchanged segments 0-2
        const initialSegments = initialPathData.data.segments;
        const legsAfterInsert = routingResult.matchings[0].legs;
        const ratio = computeExpectedRatio([
            { previousTime: initialSegments[0].travelTimeSeconds, distance: legsAfterInsert[0].distance, routedDuration: legsAfterInsert[0].duration },
            { previousTime: initialSegments[1].travelTimeSeconds, distance: legsAfterInsert[1].distance, routedDuration: legsAfterInsert[1].duration },
            { previousTime: initialSegments[2].travelTimeSeconds, distance: legsAfterInsert[2].distance, routedDuration: legsAfterInsert[2].duration },
        ]);
        expect(path.attributes.data.segments[3].travelTimeSeconds).toEqual(
            segmentDuration(legsAfterInsert[3].distance, legsAfterInsert[3].duration) * ratio
        );
    });

    test('remove first node', async () => {
        // Previous: [node1, node2, node4, node6] (3 segs), removed node1 at index 0
        // Current: [node2, node4, node6] (2 segs)
        const pathData = _cloneDeep(initialPathData);
        pathData.nodes = [node2.properties.id, node4.properties.id, node6.properties.id];
        pathData.data.nodeTypes = ['engine', 'engine', 'engine'];
        pathData.data.waypoints = [[], [], []];
        pathData.data.waypointTypes = [[], [], []];

        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node2, node4, node6],
            matchings: [{
                confidence: 99, distance: 2200, duration: 146.67,
                legs: [
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'remove', index: 0 } });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(2);
        // Seg 0 maps to previous 1, seg 1 maps to previous 2
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(initialPathData.data.segments[1].travelTimeSeconds);
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialPathData.data.segments[2].travelTimeSeconds);
    });

    test('remove middle node', async () => {
        // Previous: [node1, node2, node4, node6] (3 segs), removed node2 at index 1
        // Current: [node1, node4, node6] (2 segs)
        const pathData = _cloneDeep(initialPathData);
        pathData.nodes = [node1.properties.id, node4.properties.id, node6.properties.id];
        pathData.data.nodeTypes = ['engine', 'engine', 'engine'];
        pathData.data.waypoints = [[], [], []];
        pathData.data.waypointTypes = [[], [], []];

        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node1, node4, node6],
            matchings: [{
                confidence: 99, distance: 2700, duration: 180,
                legs: [
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'remove', index: 1 } });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(2);
        // Seg 0 maps to -1 (merged), seg 1 maps to previous 2
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialPathData.data.segments[2].travelTimeSeconds);
        // New segment 0 (merged): physics duration scaled by ratio from unchanged segment 1
        const initialSegments = initialPathData.data.segments;
        const legsAfterRemove = routingResult.matchings[0].legs;
        const ratio = computeExpectedRatio([
            { previousTime: initialSegments[2].travelTimeSeconds, distance: legsAfterRemove[1].distance, routedDuration: legsAfterRemove[1].duration },
        ]);
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(
            segmentDuration(legsAfterRemove[0].distance, legsAfterRemove[0].duration) * ratio
        );
    });

    test('remove last node', async () => {
        // Previous: [node1, node2, node4, node6] (3 segs), removed node6 at index 3
        // Current: [node1, node2, node4] (2 segs)
        const pathData = _cloneDeep(initialPathData);
        pathData.nodes = [node1.properties.id, node2.properties.id, node4.properties.id];
        pathData.data.nodeTypes = ['engine', 'engine', 'engine'];
        pathData.data.waypoints = [[], [], []];
        pathData.data.waypointTypes = [[], [], []];

        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node1, node2, node4],
            matchings: [{
                confidence: 99, distance: 2500, duration: 166.67,
                legs: [
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] } }] },
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'remove', index: 3 } });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(2);
        // Seg 0 maps to previous 0, seg 1 maps to previous 1 (both unchanged)
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(initialPathData.data.segments[0].travelTimeSeconds);
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialPathData.data.segments[1].travelTimeSeconds);
    });

    test('forceRecalculate ignores previous times and recalculates all segments from OSRM', async () => {
        // Same path, same nodes, no changes — but forceRecalculate is true
        const pathData = _cloneDeep(initialPathData);
        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node1, node2, node4, node6],
            matchings: [{
                confidence: 99, distance: 3700, duration: 246.67,
                legs: [
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] } }] },
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { forceRecalculate: true });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(3);
        // All segments recalculated from OSRM — none preserve previous times
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(segmentDuration(1500, 100));
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(segmentDuration(1000, 66.67));
        expect(path.attributes.data.segments[2].travelTimeSeconds).toEqual(segmentDuration(1200, 80));
    });

    test('forceRecalculate uses node dwell times even when previous dwell was zero with short travel time', async () => {
        // Previous: GTFS data with dwell=0 and short travel time that would normally trigger hasBakedInDwell
        const pathData = _cloneDeep(initialPathData);
        pathData.data.dwellTimeSeconds = [0, 0, 0, 0];
        pathData.data.segments[1].travelTimeSeconds = 30; // short time: 30 - 120 (node4 dwell) < 15
        const path = new TransitPathStub(pathData) as any;
        const routingResult = {
            tracepoints: [node1, node2, node4, node6],
            matchings: [{
                confidence: 99, distance: 3700, duration: 246.67,
                legs: [
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] } }] },
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1200, duration: 80, steps: [{ distance: 1200, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { forceRecalculate: true });

        // With forceRecalculate, hasBakedInDwell is skipped — dwell times come from node defaults
        expect(path.attributes.data.dwellTimeSeconds[0]).toEqual(0); // first segment always 0
        expect(path.attributes.data.dwellTimeSeconds[1]).toEqual(DEFAULT_DWELL_TIME); // node2 default
        expect(path.attributes.data.dwellTimeSeconds[2]).toEqual(NODE4_DWELL_TIME); // node4 custom 120
    });
});

describe('Dwell time adjustment on preserved segments', () => {
    // Node dwell times: node1=25 (default), node4=120 (custom), node6=25 (default), node3=25 (default)
    // Insert at end keeps all original segments unchanged, so dwell adjustment is testable on seg 1.
    // Path after insert: [node1, node4, node6, node3] (3 segments)
    // Seg 0 → prev 0 (first segment, dwell always 0), seg 1 → prev 1 (node4, dwell=120), seg 2 is new
    const routingResult = {
        tracepoints: [node1, node4, node6, node3],
        matchings: [{
            confidence: 99,
            distance: 3500,
            duration: 233.34,
            legs: [
                { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] } }] },
                { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                { distance: 800, duration: 53.34, steps: [{ distance: 800, geometry: { type: 'LineString' as const, coordinates: [node6.geometry.coordinates, node3.geometry.coordinates] } }] },
            ]
        }]
    };

    const makePathAndGenerate = (previousTravelTimes: number[], previousDwellTimes: number[]) => {
        const path = new TransitPathStub({
            id: 'path1',
            line_id: line.get('id'),
            nodes: [node1.properties.id, node4.properties.id, node6.properties.id, node3.properties.id],
            data: {
                nodeTypes: ['engine', 'engine', 'engine', 'engine'],
                waypoints: [[], [], [], []],
                waypointTypes: [[], [], [], []],
                routingEngine: 'engine',
                routingMode: 'driving',
                defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
                defaultAcceleration: DEFAULT_ACC_DEC,
                defaultDeceleration: DEFAULT_ACC_DEC,
                defaultRunningSpeedKmH: DEFAULT_SPEED,
                maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
                segments: [
                    { travelTimeSeconds: previousTravelTimes[0], distanceMeters: 1500 },
                    { travelTimeSeconds: previousTravelTimes[1], distanceMeters: 1000 },
                ],
                dwellTimeSeconds: previousDwellTimes,
            }
        }) as any;
        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        //Insert node at end of path
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastNodeChange: { type: 'insert', index: 3 } });
        return path;
    };

    test('first segment always has dwell time zero', () => {
        const path = makePathAndGenerate([200, 150], [0, 0, 0]);

        // First segment departure is the path start — dwell is always 0 (layover is separate)
        expect(path.attributes.data.dwellTimeSeconds[0]).toEqual(0);
    });

    test('subtracts dwell from travel time when previous dwell was zero', () => {
        const path = makePathAndGenerate([200, 150], [0, 0, 0]);

        // node4 dwell (120) subtracted from preserved travel time: 150 - 120 = 30
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(150 - NODE4_DWELL_TIME);
        expect(path.attributes.data.dwellTimeSeconds[1]).toEqual(NODE4_DWELL_TIME);
    });

    test('preserves travel time when previous dwell was non-zero', () => {
        const path = makePathAndGenerate([200, 150], [0, NODE4_DWELL_TIME, DEFAULT_DWELL_TIME]);

        // No subtraction — previous dwell was already separate
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(150);
        expect(path.attributes.data.dwellTimeSeconds[1]).toEqual(NODE4_DWELL_TIME);
    });

    test('keeps dwell at zero when subtraction would drop below minimum travel time', () => {
        // previousTime=130, node4 dwell=120 → 130-120=10 < 15 → dwell stays 0
        const path = makePathAndGenerate([200, 130], [0, 0, 0]);

        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(130);
        expect(path.attributes.data.dwellTimeSeconds[1]).toEqual(0);
    });

    test('no subtraction on old first segment after insert at beginning', () => {
        // Previous: [node1, node4, node6] with dwell=[0, 0, 0]
        // Insert node3 at index 0 → [node3, node1, node4, node6]
        // Seg 1 maps to prev 0 (old first segment). Previous dwell was 0 because it was path start,
        // not baked-in GTFS — so no subtraction should happen.
        const path = new TransitPathStub({
            id: 'path1',
            line_id: line.get('id'),
            nodes: [node3.properties.id, node1.properties.id, node4.properties.id, node6.properties.id],
            data: {
                nodeTypes: ['engine', 'engine', 'engine', 'engine'],
                waypoints: [[], [], [], []],
                waypointTypes: [[], [], [], []],
                routingEngine: 'engine',
                routingMode: 'driving',
                defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
                defaultAcceleration: DEFAULT_ACC_DEC,
                defaultDeceleration: DEFAULT_ACC_DEC,
                defaultRunningSpeedKmH: DEFAULT_SPEED,
                maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
                segments: [
                    { travelTimeSeconds: 200, distanceMeters: 1500 },
                    { travelTimeSeconds: 150, distanceMeters: 1000 },
                ],
                dwellTimeSeconds: [0, 0, 0],
            }
        }) as any;

        const insertRoutingResult = {
            tracepoints: [node3, node1, node4, node6],
            matchings: [{
                confidence: 99,
                distance: 3300,
                duration: 220.01,
                legs: [
                    { distance: 800, duration: 53.34, steps: [{ distance: 800, geometry: { type: 'LineString' as const, coordinates: [node3.geometry.coordinates, node1.geometry.coordinates] } }] },
                    { distance: 1500, duration: 100, steps: [{ distance: 1500, geometry: { type: 'LineString' as const, coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] } }] },
                    { distance: 1000, duration: 66.67, steps: [{ distance: 1000, geometry: { type: 'LineString' as const, coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] } }] },
                ]
            }]
        };

        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED / 3.6);
        //Insert node at start of path
        generatePathGeographyFromRouting(path, nodeGeojson, [insertRoutingResult], { lastNodeChange: { type: 'insert', index: 0 } });

        // Seg 1 (old first segment): travel time preserved without subtraction
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(200);
        expect(path.attributes.data.dwellTimeSeconds[1]).toEqual(DEFAULT_DWELL_TIME);
    });
});

describe('Waypoint change operations', () => {
    // Shared initial state: node1 -> node4 -> node6, 2 segments with previous travel times
    const initialWaypointPathData: any = {
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id, node6.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine', 'engine'],
            waypoints: [[], [], []],
            waypointTypes: [[], [], []],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            // Previous segment data before the waypoint was moved
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
                { travelTimeSeconds: 82, distanceMeters: 1000 },
            ],
            dwellTimeSeconds: [0, NODE4_DWELL_TIME, 25],
        }
    };

    test('recalculates affected segment only', async() => {
        // Path: node1 -> node4 -> node6 with existing segment data
        // A waypoint was moved on segment 0 (between node1 and node4), so segment 0 should be
        // recalculated using the ratio, while segment 1 keeps its previous time.
        const pathData = _cloneDeep(initialWaypointPathData);
        pathData.data.waypoints = [[waypoint1], [], []];
        pathData.data.waypointTypes = [['engine'], [], []];

        const path = new TransitPathStub(pathData) as any;

        // After moving the waypoint, segment 0 now has a longer route (2000m via waypoint)
        // but segment 1 is unchanged
        const routingResult = {
            tracepoints: [node1, TestUtils.makePoint(waypoint1), node4, node6],
            matchings: [{
                confidence: 99,
                distance: 3000,
                duration: 233.34,
                legs: [{
                    distance: 1200,
                    duration: 80,
                    steps: [{
                        distance: 1200,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node1.geometry.coordinates, waypoint1] }
                    }]
                }, {
                    distance: 800,
                    duration: 53.34,
                    steps: [{
                        distance: 800,
                        geometry: { type: 'LineString' as const,
                            coordinates: [waypoint1, node4.geometry.coordinates] }
                    }]
                }, {
                    distance: 1000,
                    duration: 66.67,
                    steps: [{
                        distance: 1000,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] }
                    }]
                }]
            }]
        };

        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED/3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastWaypointChangedSegmentIndex: 0 });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        expect(path.attributes.data.segments.length).toEqual(2);
        // Segment 1 (unchanged) should keep its previous travel time
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialWaypointPathData.data.segments[1].travelTimeSeconds);
        // Segment 0 (changed by waypoint): recalculated with ratio from unchanged segment 1
        expect(path.attributes.data.segments[0].distanceMeters).toEqual(2000);
        const legs = routingResult.matchings[0].legs;
        const initialSegments = initialWaypointPathData.data.segments;
        // Ratio from unchanged segment 1 (single leg 2)
        const ratio = initialSegments[1].travelTimeSeconds / segmentDuration(legs[2].distance, legs[2].duration);
        // Changed segment 0: legs 0+1 combined
        const changedSegDistance = Math.ceil(legs[0].distance) + Math.ceil(legs[1].distance);
        const changedSegDuration = legs[0].duration + legs[1].duration;
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(segmentDuration(changedSegDistance, changedSegDuration) * ratio);
    });

    test('waypoint after last node has no effect on segment times', async() => {
        // Waypoint added after node6 (trailing) — no real segment is affected
        const pathData = _cloneDeep(initialWaypointPathData);
        pathData.data.waypoints = [[], [], [waypoint3]];
        pathData.data.waypointTypes = [[], [], ['engine']];

        const path = new TransitPathStub(pathData) as any;

        const routingResult = {
            tracepoints: [node1, node4, node6, TestUtils.makePoint(waypoint3)],
            matchings: [{
                confidence: 99,
                distance: 3300,
                duration: 220.01,
                legs: [{
                    distance: 1500,
                    duration: 100,
                    steps: [{
                        distance: 1500,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] }
                    }]
                }, {
                    distance: 1000,
                    duration: 66.67,
                    steps: [{
                        distance: 1000,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node4.geometry.coordinates, node6.geometry.coordinates] }
                    }]
                }, {
                    distance: 800,
                    duration: 53.34,
                    steps: [{
                        distance: 800,
                        geometry: { type: 'LineString' as const,
                            coordinates: [node6.geometry.coordinates, waypoint3] }
                    }]
                }]
            }]
        };

        const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(path, DEFAULT_SPEED/3.6);
        generatePathGeographyFromRouting(path, nodeGeojson, [routingResult], { lastWaypointChangedSegmentIndex: 2 });

        expect(path.attributes.data.routingFailed).toBeFalsy();
        // 3 segments: 2 real + 1 trailing (waypoint after last node is stored for geometry)
        expect(path.attributes.data.segments.length).toEqual(3);
        // Both real segments unchanged — trailing waypoint has no effect
        expect(path.attributes.data.segments[0].travelTimeSeconds).toEqual(initialWaypointPathData.data.segments[0].travelTimeSeconds);
        expect(path.attributes.data.segments[1].travelTimeSeconds).toEqual(initialWaypointPathData.data.segments[1].travelTimeSeconds);
    });
});

test('Generate From Routing with custom layover minutes', async() => {
    const pathWithLayover = new TransitPathStub({
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
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            customLayoverMinutes: 5
        }
    }) as any;

    const routingResult = {
        tracepoints: [node1, node4],
        matchings: [{
            confidence: 99,
            distance: 1000,
            duration: 66.67,
            legs: [{
                distance: 1000,
                duration: 66.67,
                steps: [{
                    distance: 1000,
                    geometry: { type: 'LineString' as const,
                        coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] }
                }]
            }]
        }]
    };

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithLayover, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithLayover, nodeGeojson, [routingResult]);

    expect(pathWithLayover.attributes.data.routingFailed).toBeFalsy();
    // Custom layover = 5 minutes = 300 seconds
    expect(pathWithLayover.attributes.data.layoverTimeSeconds).toEqual(300);
});
