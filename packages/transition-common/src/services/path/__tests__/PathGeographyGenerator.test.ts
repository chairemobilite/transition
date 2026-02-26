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
import { roundSecondsToNearestQuarter } from 'chaire-lib-common/lib/utils/DateTimeUtils';

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
    let expectedTotalTime = roundSecondsToNearestQuarter(expectedTravelTimes.reduce(sum, 0), 15, Math.ceil);
    let expectedTotalDistance = expectedDistances.reduce(sum, 0);
    let expectedNoDwellTime =roundSecondsToNearestQuarter(expectedNoDwellTimes.reduce(sum, 0), 15, Math.ceil);
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTimes[0],
        distanceMeters: expectedDistances[0]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, 120],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: roundSecondsToNearestQuarter(expectedNoDwellTime, 15, Math.ceil),
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
    expectedTotalTime = roundSecondsToNearestQuarter(expectedTravelTimes.reduce(sum, 0), 15, Math.ceil);
    expectedTotalDistance = expectedDistances.reduce(sum, 0);
    expectedNoDwellTime = roundSecondsToNearestQuarter(expectedNoDwellTimes.reduce(sum, 0) , 15, Math.ceil);
    expect(simplePath.attributes.data.segments).toEqual([{
        travelTimeSeconds: expectedTravelTimes[0],
        distanceMeters: expectedDistances[0]
    }]);

    expect(simplePath.attributes.data).toEqual(expect.objectContaining({
        dwellTimeSeconds: [0, 120],
        layoverTimeSeconds: LAYOVER_TIME,
        travelTimeWithoutDwellTimesSeconds: roundSecondsToNearestQuarter(expectedNoDwellTime, 15, Math.ceil),
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
        travelTimeWithoutDwellTimesSeconds: roundSecondsToNearestQuarter(expectedNoDwellTime, 15, Math.ceil),
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: roundSecondsToNearestQuarter(expectedDwellTime + expectedTotalTime, 15, Math.ceil),
        operatingTimeWithLayoverTimeSeconds: roundSecondsToNearestQuarter(expectedDwellTime + expectedTotalTime, 15, Math.ceil) + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: roundSecondsToNearestQuarter(expectedDwellTime + expectedTotalTime, 15, Math.ceil) + LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestQuarter(expectedNoDwellTime, 15, Math.ceil)),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestQuarter(expectedTotalTime + expectedDwellTime, 15, Math.ceil)),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestQuarter(expectedTotalTime + expectedDwellTime, 15, Math.ceil) + LAYOVER_TIME)
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
    const expectedNoDwellTime = roundSecondsToNearestQuarter(expectedNoDwellTimes.reduce(sum, 0), 15, Math.ceil);
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
        travelTimeWithoutDwellTimesSeconds:roundSecondsToNearestQuarter(expectedNoDwellTime, 15, Math.ceil),
        totalDistanceMeters: expectedTotalDistance,
        totalDwellTimeSeconds: expectedDwellTime,
        operatingTimeWithoutLayoverTimeSeconds: roundSecondsToNearestQuarter(expectedDwellTime + expectedTotalTime, 15, Math.ceil),
        operatingTimeWithLayoverTimeSeconds: roundSecondsToNearestQuarter(expectedDwellTime + expectedTotalTime, 15, Math.ceil) + LAYOVER_TIME,
        totalTravelTimeWithReturnBackSeconds: roundSecondsToNearestQuarter(expectedDwellTime + expectedTotalTime, 15, Math.ceil)+ LAYOVER_TIME,
        averageSpeedWithoutDwellTimesMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestQuarter(expectedNoDwellTime, 15, Math.ceil)),
        operatingSpeedMetersPerSecond: twoDecimals(expectedTotalDistance, roundSecondsToNearestQuarter(expectedTotalTime + expectedDwellTime, 15, Math.ceil)),
        operatingSpeedWithLayoverMetersPerSecond: twoDecimals(expectedTotalDistance,roundSecondsToNearestQuarter(expectedTotalTime + expectedDwellTime, 15, Math.ceil) + LAYOVER_TIME)
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

test('Generate From Routing with insert node at beginning', async() => {
    // Create a path with 2 nodes and existing segment data (simulating a path that already had geography)
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node2.properties.id, node1.properties.id, node4.properties.id ],
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
            // Old segment data from before the insert
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
            ],
            dwellTimeSeconds: [0, 120],
            _lastNodeChange: { type: 'insert' as const, index: 0 }
        }
    }) as any;

    const routingResult = {
        tracepoints: [node2, node1, node4],
        matchings: [{
            confidence: 99,
            distance: 2500,
            duration: 166.67,
            legs: [{
                distance: 1500,
                duration: 100,
                steps: [{
                    distance: 1500,
                    geometry: { type: 'LineString' as const,
                        coordinates: [node2.geometry.coordinates, node1.geometry.coordinates] }
                }]
            }, {
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

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    // First segment is new (insert at 0), second segment should keep old time
    expect(pathWithOldData.attributes.data.segments.length).toEqual(2);
    // Second segment (old segment 0) should keep its old travel time
    expect(pathWithOldData.attributes.data.segments[1].travelTimeSeconds).toEqual(115);
});

test('Generate From Routing with insert node in middle', async() => {
    // Path: node1 -> node2 (new) -> node4, inserting node2 at index 1
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node2.properties.id, node4.properties.id ],
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
            // Old: node1 -> node4 (1 segment)
            segments: [
                { travelTimeSeconds: 200, distanceMeters: 2500 },
            ],
            dwellTimeSeconds: [0, 120],
            _lastNodeChange: { type: 'insert' as const, index: 1 }
        }
    }) as any;

    const routingResult = {
        tracepoints: [node1, node2, node4],
        matchings: [{
            confidence: 99,
            distance: 2500,
            duration: 166.67,
            legs: [{
                distance: 1500,
                duration: 100,
                steps: [{
                    distance: 1500,
                    geometry: { type: 'LineString' as const,
                        coordinates: [node1.geometry.coordinates, node2.geometry.coordinates] }
                }]
            }, {
                distance: 1000,
                duration: 66.67,
                steps: [{
                    distance: 1000,
                    geometry: { type: 'LineString' as const,
                        coordinates: [node2.geometry.coordinates, node4.geometry.coordinates] }
                }]
            }]
        }]
    };

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(2);
    // Both segments are new (the old single segment was split), so times should be ratio-adjusted
    // With only one old segment, ratio = (200 - 120) / calculatedDuration for the old segment
    // But old segment maps to -1 for both new segments, so ratio has no data (stays 1)
    // New dwell times should be freshly computed
    expect(pathWithOldData.attributes.data.dwellTimeSeconds.length).toEqual(3);
    expect(pathWithOldData.attributes.data.dwellTimeSeconds[0]).toEqual(0);
});

test('Generate From Routing with remove node', async() => {
    // Simulating: had 3 nodes [node1, node2, node4], removed node2 (index 1)
    // Now path is [node1, node4] with 1 segment
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine'],
            waypoints: [[], []],
            waypointTypes: [[], []],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            // Old: 2 segments [node1->node2, node2->node4]
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
                { travelTimeSeconds: 82, distanceMeters: 1000 },
            ],
            dwellTimeSeconds: [0, 25, 120],
            _lastNodeChange: { type: 'remove' as const, index: 1 }
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

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(1);
    // Segment 0 maps to old index -1 (merged segment), so it's new and ratio-adjusted
    // Old segments 0 and 1 both exist, ratio is computed from segment 1 (old index 1, since remove at index 1 shifts)
    expect(pathWithOldData.attributes.data.dwellTimeSeconds).toEqual([0, 120]);
});

test('Generate From Routing with remove first node', async() => {
    // Had [node2, node1, node4], removed node2 at index 0
    // Now path is [node1, node4]
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine'],
            waypoints: [[], []],
            waypointTypes: [[], []],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            // Old: 2 segments
            segments: [
                { travelTimeSeconds: 100, distanceMeters: 1200 },
                { travelTimeSeconds: 82, distanceMeters: 1000 },
            ],
            dwellTimeSeconds: [0, 25, 120],
            _lastNodeChange: { type: 'remove' as const, index: 0 }
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

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(1);
    // Segment 0 maps to old index 1 (removedNodeIndex=0, so oldIndex = newIndex + 1 = 1)
    // Old segment 1 had travelTimeSeconds=82, so it should keep that
    expect(pathWithOldData.attributes.data.segments[0].travelTimeSeconds).toEqual(82);
});

test('Generate From Routing with insert node at end', async() => {
    // Had [node1, node4], inserting node6 at the end (index 2)
    // Now path is [node1, node4, node6]
    const pathWithOldData = new TransitPathStub({
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
            // Old: 1 segment [node1->node4]
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
            ],
            dwellTimeSeconds: [0, 120],
            _lastNodeChange: { type: 'insert' as const, index: 2 }
        }
    }) as any;

    const routingResult = {
        tracepoints: [node1, node4, node6],
        matchings: [{
            confidence: 99,
            distance: 2500,
            duration: 166.67,
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
            }]
        }]
    };

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(2);
    // First segment (old index 0) should keep old time
    expect(pathWithOldData.attributes.data.segments[0].travelTimeSeconds).toEqual(115);
    // Second segment is new (inserted at end)
    expect(pathWithOldData.attributes.data.dwellTimeSeconds.length).toEqual(3);
    expect(pathWithOldData.attributes.data.dwellTimeSeconds[0]).toEqual(0);
});

test('Generate From Routing with remove last node', async() => {
    // Had [node1, node4, node6], removed node6 at index 2
    // Now path is [node1, node4]
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine'],
            waypoints: [[], []],
            waypointTypes: [[], []],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            // Old: 2 segments [node1->node4, node4->node6]
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
                { travelTimeSeconds: 82, distanceMeters: 1000 },
            ],
            dwellTimeSeconds: [0, 120, 25],
            _lastNodeChange: { type: 'remove' as const, index: 2 }
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

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(1);
    // Segment 0 maps to old index 0 (removed index 2, so segment 0 is unchanged)
    expect(pathWithOldData.attributes.data.segments[0].travelTimeSeconds).toEqual(115);
    expect(pathWithOldData.attributes.data.dwellTimeSeconds).toEqual([0, 120]);
});

test('Generate From Routing with old dwell time zero adjusts ratio', async() => {
    // Test the dwell time adjustment: old dwell time is 0, so ratio subtracts new dwell time
    const pathWithOldData = new TransitPathStub({
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
            // Old data with dwell time = 0 (e.g. from GTFS where dwell was baked into travel time)
            segments: [
                { travelTimeSeconds: 200, distanceMeters: 1500 },
                { travelTimeSeconds: 150, distanceMeters: 1000 },
            ],
            dwellTimeSeconds: [0, 0, 0],
            _lastNodeChange: { type: 'insert' as const, index: 2 }
        }
    }) as any;

    const routingResult = {
        tracepoints: [node1, node4, node6],
        matchings: [{
            confidence: 99,
            distance: 2500,
            duration: 166.67,
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
            }]
        }]
    };

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(2);
    // Old dwell time was 0, so previousTime - dwellTimeSeconds is used for ratio
    // Segment 0: old index 0, oldDwellTime=0 → ratio uses (200 - 120) / calculatedDuration
    // The stored time should be previousTime - newDwellTime = 200 - 120 = 80
    expect(pathWithOldData.attributes.data.segments[0].travelTimeSeconds).toEqual(Math.ceil(200 - 120));
    // New dwell times should be fresh (not restored from old 0s)
    expect(pathWithOldData.attributes.data.dwellTimeSeconds[1]).toEqual(120); // node4 has default_dwell_time_seconds: 120
});

test('Generate From Routing with waypoint change recalculates affected segment only', async() => {
    // Path: node1 -> node4 -> node6 with existing segment data
    // A waypoint was moved on segment 0 (between node1 and node4), so segment 0 should be
    // recalculated using the ratio, while segment 1 keeps its old time.
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id, node6.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine', 'engine'],
            waypoints: [[waypoint1], [], []],
            waypointTypes: [['engine'], [], []],
            routingEngine: 'engine',
            routingMode: 'driving',
            defaultDwellTimeSeconds: DEFAULT_DWELL_TIME,
            defaultAcceleration: DEFAULT_ACC_DEC,
            defaultDeceleration: DEFAULT_ACC_DEC,
            defaultRunningSpeedKmH: DEFAULT_SPEED,
            maxRunningSpeedKmH: DEFAULT_MAX_SPEED,
            // Old segment data before the waypoint was moved
            segments: [
                { travelTimeSeconds: 115, distanceMeters: 1500 },
                { travelTimeSeconds: 82, distanceMeters: 1000 },
            ],
            dwellTimeSeconds: [0, 120, 25],
            _lastWaypointChangedSegmentIndex: 0
        }
    }) as any;

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

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(2);
    // Segment 1 (unchanged) should keep its old travel time
    expect(pathWithOldData.attributes.data.segments[1].travelTimeSeconds).toEqual(82);
    // Segment 0 (changed by waypoint) should NOT keep old time — it should be recalculated with ratio
    expect(pathWithOldData.attributes.data.segments[0].travelTimeSeconds).not.toEqual(115);
    // The ratio comes from segment 1: ratio = 82 / calculatedDuration_of_segment1
    // Segment 0 time = calculatedDuration_of_segment0 * ratio
    expect(pathWithOldData.attributes.data.segments[0].distanceMeters).toEqual(2000);
    // _lastWaypointChangedSegmentIndex should be cleaned up
    expect(pathWithOldData.attributes.data._lastWaypointChangedSegmentIndex).toBeUndefined();
});

test('Generate From Routing with waypoint change on last segment', async() => {
    // Path: node1 -> node4 -> node6, waypoint moved on segment 1 (between node4 and node6)
    const pathWithOldData = new TransitPathStub({
        id: 'path1',
        line_id: line.get('id'),
        nodes: [ node1.properties.id, node4.properties.id, node6.properties.id ],
        data: {
            nodeTypes: ['engine', 'engine', 'engine'],
            waypoints: [[], [waypoint3], []],
            waypointTypes: [[], ['engine'], []],
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
            ],
            dwellTimeSeconds: [0, 120, 25],
            _lastWaypointChangedSegmentIndex: 1
        }
    }) as any;

    const routingResult = {
        tracepoints: [node1, node4, TestUtils.makePoint(waypoint3), node6],
        matchings: [{
            confidence: 99,
            distance: 3200,
            duration: 213.34,
            legs: [{
                distance: 1500,
                duration: 100,
                steps: [{
                    distance: 1500,
                    geometry: { type: 'LineString' as const,
                        coordinates: [node1.geometry.coordinates, node4.geometry.coordinates] }
                }]
            }, {
                distance: 900,
                duration: 60,
                steps: [{
                    distance: 900,
                    geometry: { type: 'LineString' as const,
                        coordinates: [node4.geometry.coordinates, waypoint3] }
                }]
            }, {
                distance: 800,
                duration: 53.34,
                steps: [{
                    distance: 800,
                    geometry: { type: 'LineString' as const,
                        coordinates: [waypoint3, node6.geometry.coordinates] }
                }]
            }]
        }]
    };

    const nodeGeojson = PathGeographyUtils.prepareNodesAndWaypoints(pathWithOldData, DEFAULT_SPEED/3.6);
    generatePathGeographyFromRouting(pathWithOldData, nodeGeojson, [routingResult]);

    expect(pathWithOldData.attributes.data.routingFailed).toBeFalsy();
    expect(pathWithOldData.attributes.data.segments.length).toEqual(2);
    // Segment 0 (unchanged) should keep its old travel time
    expect(pathWithOldData.attributes.data.segments[0].travelTimeSeconds).toEqual(115);
    // Segment 1 (changed by waypoint) should be recalculated
    expect(pathWithOldData.attributes.data.segments[1].travelTimeSeconds).not.toEqual(82);
    expect(pathWithOldData.attributes.data.segments[1].distanceMeters).toEqual(1700);
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
