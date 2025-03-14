/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { pathGeographyUtils as PathGeographyUtils, default as updateGeography, PathGeographyResults } from '../PathGeographyUtils';
import { TransitObjectStub, GenericCollectionStub } from '../../__tests__/TransitObjectStub';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { TestUtils, RoutingServiceManagerMock } from 'chaire-lib-common/lib/test';
import { kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';
jest.mock('../PathGeographyGenerator');

const defaultRoutingRadiusMeters = Preferences.current.transit.nodes.defaultRoutingRadiusMeters;
const defaultRunningSpeedMps = kphToMps(15);
const defaultWaypointRoutingRadiusMeters = 15;

const node1: any = TestUtils.makePoint([-73.745618, 45.368994], { routing_radius_meters: 50, id: "node1" }, { id: 1 });
const node2: any = TestUtils.makePoint([-73.742861, 45.361682], { routing_radius_meters: 100, id: "node2" }, { id: 2 });
const node3: any = TestUtils.makePoint([-73.738927, 45.361852], { routing_radius_meters: 10, id: "node3" }, { id: 3 });
const node4: any = TestUtils.makePoint([-73.731251, 45.368103], { routing_radius_meters: 50, id: "node4" }, { id: 4 });
const node5: any = TestUtils.makePoint([-73.734788, 45.372252], { id: "node5" }, { id: 5 });
const node6: any = TestUtils.makePoint([-73.749821, 45.373132], { id: "node6" }, { id: 6 });

const nodeCollection = [node1, node2, node3, node4, node5, node6];
const waypoint1: [number, number] = [-73.74382202603918, 45.36504595320852];
const waypoint2: [number, number] = [-73.74257193644237, 45.36355549004705];
const waypoint3: [number, number] = [-73.73639725146167, 45.363608721550406];
const waypoint4: [number, number] = [-73.73499563585311, 45.36717511817895];
const waypoint5: [number, number] = [-73.73067714451926, 45.37201866994127];

const line = new TransitObjectStub({
    id: "line1",
});
const collectionManager = { get: (_str) => _str === 'nodes' ? new GenericCollectionStub(nodeCollection) : new GenericCollectionStub([]) };

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
}

const path = new TransitPathStub({
    id: "path1",
    line_id: line.get('id'),
    nodes: [node1.properties.id, node2.properties.id, node3.properties.id, node4.properties.id, node5.properties.id, node6.properties.id],
    data: {
        nodeTypes: ["engine", "engine", "engine", "manual", "manual", "engine"],
        waypoints: [
            [waypoint1, waypoint2],
            [],
            [waypoint3, waypoint4],
            [waypoint5],
        ],
        waypointTypes: [
            ["engine", "engine"],
            [],
            ["manual", "manual"],
            ["manual"],
        ],
        routingEngine: 'engine',
        routingMode: 'driving',
    }
});

/* Test data:
const serviceLocator = { collectionManager: { get: (_str) => _str === 'lines' ? new GenericCollectionStub(lines) : new GenericCollectionStub(scenarios) } };
*/
test('Calculate bird distance duration', () => {
    // Point to self
    expect(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45, -73]), TestUtils.makePoint([45, -73]), defaultRunningSpeedMps)).toBe(0);
    // Make sure it does not return 0
    expect(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45, -75]), TestUtils.makePoint([45, -73]), defaultRunningSpeedMps)).toBeGreaterThan(0);
    // Should be equal to path from/to same points
    expect(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45, -75]), TestUtils.makePoint([45, -73]), defaultRunningSpeedMps)).toBe(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45, -73]), TestUtils.makePoint([45, -75]), defaultRunningSpeedMps));
    // Translate points to have doubles (same latitude)
    expect(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45.123456, -73.8642]), TestUtils.makePoint([45.123456, -75.8642]), defaultRunningSpeedMps)).toBe(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45, -75]), TestUtils.makePoint([45, -73]), defaultRunningSpeedMps));
    // Translate points to have doubles, but mixed (different latitude)
    expect(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45.123456, -73.8642]), TestUtils.makePoint([45, -75]), defaultRunningSpeedMps)).toBe(PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint([45, -73]), TestUtils.makePoint([43.876544, -74.1358]), defaultRunningSpeedMps) - 1150);
});

test('Should path update', () => {

    const updateablePath = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [node1.properties.id, node2.properties.id, node3.properties.id, node4.properties.id, node5.properties.id, node6.properties.id],
        data: {}
    });

    /* Normal path, that should be updated */
    const pathToUpdate = TransitPathStub.clone(updateablePath);
    expect(PathGeographyUtils.shouldPathUpdate(pathToUpdate)).toBeTruthy();
    // Make sure the waypoints and waypointTypes have been udpated
    expect((pathToUpdate as any).attributes.data.waypoints).toBeTruthy();
    expect((pathToUpdate as any).attributes.data.waypoints.length).toEqual(updateablePath.get('nodes').length);
    expect((pathToUpdate as any).attributes.data.waypointTypes.length).toEqual(updateablePath.get('nodes').length);

    /* Path with waypoints that should be updated */
    const pathWithWaypoints = TransitPathStub.clone(path);
    expect(PathGeographyUtils.shouldPathUpdate(pathWithWaypoints)).toBeTruthy();
    // Make sure the waypoints and waypointTypes have been udpated
    expect((pathWithWaypoints as any).attributes.data.waypoints).toBeTruthy();
    expect((pathWithWaypoints as any).attributes.data.waypoints.length).toEqual(updateablePath.get('nodes').length);
    expect((pathWithWaypoints as any).attributes.data.waypointTypes.length).toEqual(updateablePath.get('nodes').length);

    /* The path has no nodes */
    expect(PathGeographyUtils.shouldPathUpdate(new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [],
        data: {}
    }))).toBeFalsy();

    /* The path has only one node */
    expect(PathGeographyUtils.shouldPathUpdate(new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [node1.properties.id],
        data: {}
    }))).toBeFalsy();

    /* The path has only one node, but some waypoints */
    expect(PathGeographyUtils.shouldPathUpdate(new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [node1.properties.id],
        data: {
            nodeType: ["engine"],
            waypoints: [
                [waypoint1, waypoint2]
            ],
            waypointTypes: [
                ["engine", "engine"]
            ]
        }
    }))).toBeTruthy();

    /* The line does not exist */
    const noLinePath = new TransitPathStub({
        id: "path1",
        line_id: "line2",
        nodes: [node1.properties.id, node2.properties.id, node3.properties.id],
        data: {}
    });
    expect(PathGeographyUtils.shouldPathUpdate(noLinePath)).toBeFalsy();

});

test("Prepare data", async () => {


    const compareNode = (preparedNode: any, expected: { coordinates: [number, number], isNode: boolean, type: string, radius: number, timestamp: number }) => {
        expect(preparedNode.geometry.coordinates).toEqual(expected.coordinates);
        expect(preparedNode.properties?.isNode).toEqual(expected.isNode);
        expect(preparedNode.properties?.type).toEqual(expected.type);
        expect(preparedNode.properties?.radius).toEqual(expected.radius);
        expect(preparedNode.properties?.timestamp).toEqual(expected.timestamp);
    };

    /* Simple 3 nodes path */
    const simplePath = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [
            node1.properties.id,
            node2.properties.id,
            node5.properties.id
        ],
        data: {}
    });

    const preparedNodes = PathGeographyUtils.prepareNodesAndWaypoints(simplePath, defaultRunningSpeedMps);
    expect(preparedNodes.features.length).toEqual(simplePath.get('nodes').length);

    // Verify prepared node 1
    let expectedCurrentTime = 0;
    compareNode(preparedNodes.features[0], {
        coordinates: node1.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: node1.properties.routing_radius_meters,
        timestamp: expectedCurrentTime
    });

    // Verify prepared node 2
    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node1, node2, 1));
    compareNode(preparedNodes.features[1], {
        coordinates: node2.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: node2.properties.routing_radius_meters,
        timestamp: expectedCurrentTime
    });

    // Verify prepared node 3
    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node2, node5, 1));
    compareNode(preparedNodes.features[2], {
        coordinates: node5.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: defaultRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    /* More complex path with waypoints */
    const complexPath = TransitPathStub.clone(path);
    const preparedNodesComplex = PathGeographyUtils.prepareNodesAndWaypoints(complexPath, defaultRunningSpeedMps);
    expect(preparedNodesComplex.features.length).toEqual(complexPath.get('nodes').length + 5);

    // Verify prepared node 1
    expectedCurrentTime = 0;
    compareNode(preparedNodesComplex.features[0], {
        coordinates: node1.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: node1.properties.routing_radius_meters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node1, TestUtils.makePoint(waypoint1), 1));
    compareNode(preparedNodesComplex.features[1], {
        coordinates: waypoint1,
        isNode: false, type: 'engine',
        radius: defaultWaypointRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint(waypoint1), TestUtils.makePoint(waypoint2), 1));
    compareNode(preparedNodesComplex.features[2], {
        coordinates: waypoint2,
        isNode: false, type: 'engine',
        radius: defaultWaypointRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint(waypoint2), node2, 1));
    compareNode(preparedNodesComplex.features[3], {
        coordinates: node2.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: node2.properties.routing_radius_meters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node2, node3, 1));
    compareNode(preparedNodesComplex.features[4], {
        coordinates: node3.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: node3.properties.routing_radius_meters ? node3.properties.routing_radius_meters : defaultRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node3, TestUtils.makePoint(waypoint3), 1));
    compareNode(preparedNodesComplex.features[5], {
        coordinates: waypoint3,
        isNode: false, type: 'manual',
        radius: defaultWaypointRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint(waypoint3), TestUtils.makePoint(waypoint4), 1));
    compareNode(preparedNodesComplex.features[6], {
        coordinates: waypoint4,
        isNode: false, type: 'manual',
        radius: defaultWaypointRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint(waypoint4), node4, 1));
    compareNode(preparedNodesComplex.features[7], {
        coordinates: node4.geometry.coordinates,
        isNode: true, type: 'manual',
        radius: node4.properties.routing_radius_meters ? node4.properties.routing_radius_meters : defaultRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node4, TestUtils.makePoint(waypoint5), 1));
    compareNode(preparedNodesComplex.features[8], {
        coordinates: waypoint5,
        isNode: false, type: 'manual',
        radius: defaultWaypointRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(TestUtils.makePoint(waypoint5), node5, 1));
    compareNode(preparedNodesComplex.features[9], {
        coordinates: node5.geometry.coordinates,
        isNode: true, type: 'manual',
        radius: node5.properties.routing_radius_meters ? node5.properties.routing_radius_meters : defaultRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });

    expectedCurrentTime += Math.max(
        500, PathGeographyUtils.calculateBirdDistanceDuration(node5, node6, 1));
    compareNode(preparedNodesComplex.features[10], {
        coordinates: node6.geometry.coordinates,
        isNode: true, type: 'engine',
        radius: node6.properties.routing_radius_meters ? node6.properties.routing_radius_meters : defaultRoutingRadiusMeters,
        timestamp: expectedCurrentTime
    });
});

test('Get Routing Segments', async () => {
    /* Simple 3 nodes path */
    const simplePath = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [
            node1.properties.id,
            node2.properties.id,
            node5.properties.id
        ],
        data: { routingEngine: 'engine', }
    });
    const preparedNodes = PathGeographyUtils.prepareNodesAndWaypoints(simplePath, defaultRunningSpeedMps);
    const oneSegment = PathGeographyUtils.getRoutingSegments(preparedNodes, simplePath.get('routingEngine'));
    expect(oneSegment.length).toEqual(1);
    let segment = oneSegment[0];
    expect(segment.routingType).toBe(simplePath.getData('routingEngine'));
    expect(segment.geojson.features.length).toBe(preparedNodes.features.length);
    expect(segment.geojson.features).toEqual(preparedNodes.features);

    /* Same simple path but with different routing mode */
    const simplePath2 = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [
            node1.properties.id,
            node2.properties.id,
            node5.properties.id
        ],
        data: { nodeTypes: ["engine", "engine", "engine"], routingEngine: 'manual' }
    });
    const preparedNodes2 = PathGeographyUtils.prepareNodesAndWaypoints(simplePath2, defaultRunningSpeedMps);
    const oneSegment2 = PathGeographyUtils.getRoutingSegments(preparedNodes2, simplePath2.getData('routingEngine'));
    expect(oneSegment2.length).toEqual(1);
    segment = oneSegment[0];
    expect(segment.routingType).toBe('engine');
    expect(segment.geojson.features.length).toBe(preparedNodes2.features.length);
    expect(segment.geojson.features).toEqual(preparedNodes2.features);

    /* More complex path with waypoints */
    const complexPath = TransitPathStub.clone(path);
    const preparedNodesComplex = PathGeographyUtils.prepareNodesAndWaypoints(complexPath, defaultRunningSpeedMps);
    const segments = PathGeographyUtils.getRoutingSegments(preparedNodesComplex, complexPath.get('routingEngine'));
    expect(segments.length).toEqual(3);

    segment = segments[0];
    let expectedFeatures = preparedNodesComplex.features.slice(0, 5);
    expect(segment.routingType).toBe(complexPath.getData('routingEngine'));
    expect(segment.geojson.features.length).toBe(expectedFeatures.length);
    expect(segment.geojson.features).toEqual(expectedFeatures);

    segment = segments[1];
    expectedFeatures = preparedNodesComplex.features.slice(4, 10);
    expect(segment.routingType).toBe('manual');
    expect(segment.geojson.features.length).toBe(expectedFeatures.length);
    expect(segment.geojson.features).toEqual(expectedFeatures);

    segment = segments[2];
    expectedFeatures = preparedNodesComplex.features.slice(9);
    expect(segment.routingType).toBe(complexPath.getData('routingEngine'));
    expect(segment.geojson.features.length).toBe(expectedFeatures.length);
    expect(segment.geojson.features).toEqual(expectedFeatures);
});

test('Route Segments', async () => {
    const mockRouteEngine = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').mapMatch
    const mockRouteManual = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('manual').mapMatch;

    /* Simple 3 nodes path */
    const simpleRoutingResult = {
        tracepoints: [node1, node2, node5],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentOne = {
        routingType: 'engine',
        geojson: {
            type: 'FeatureCollection' as const,
            features: [node1, node2, node5]
        }
    };
    mockRouteEngine.mockResolvedValueOnce(simpleRoutingResult);
    let results = await PathGeographyUtils.routeSegments([segmentOne], 'driving', defaultRunningSpeedMps);
    expect(results.length).toEqual(1);
    expect(results[0]).toEqual(simpleRoutingResult);
    expect(mockRouteEngine).toHaveBeenCalledTimes(1);
    expect(mockRouteManual).toHaveBeenCalledTimes(0);

    /* More complex path with waypoints */
    mockRouteEngine.mockClear();
    mockRouteManual.mockClear();
    const manualRoutingResult = {
        tracepoints: [node5, TestUtils.makePoint(waypoint1)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentTwo = {
        routingType: 'manual',
        geojson: {
            type: 'FeatureCollection' as const,
            features: [node5, TestUtils.makePoint(waypoint1)]
        }
    };
    const engineRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint1), node6],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentThree = {
        routingType: 'engine',
        geojson: {
            type: 'FeatureCollection' as const,
            features: [TestUtils.makePoint(waypoint1), node6]
        }
    };
    mockRouteManual.mockResolvedValueOnce(manualRoutingResult);
    mockRouteEngine.mockResolvedValueOnce(simpleRoutingResult).mockResolvedValueOnce(engineRoutingResult);
    results = await PathGeographyUtils.routeSegments([segmentOne, segmentTwo, segmentThree], 'driving', defaultRunningSpeedMps);
    expect(results.length).toEqual(3);
    expect(mockRouteEngine).toHaveBeenCalledTimes(2);
    expect(mockRouteManual).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(simpleRoutingResult);
    expect(results[1]).toEqual(manualRoutingResult);
    expect(results[2]).toEqual(engineRoutingResult);

    /* Test a failed routing with the 3-segments path */
    mockRouteEngine.mockClear();
    mockRouteManual.mockClear();
    mockRouteManual.mockResolvedValueOnce(manualRoutingResult);
    mockRouteEngine.mockRejectedValueOnce('Mock error with routing').mockResolvedValueOnce(engineRoutingResult);
    results = await PathGeographyUtils.routeSegments([segmentOne, segmentTwo, segmentThree], 'driving', defaultRunningSpeedMps);
    expect(results.length).toEqual(3);
    expect(mockRouteEngine).toHaveBeenCalledTimes(2);
    expect(mockRouteManual).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({ tracepoints: [null, null, null], matchings: [] });
    expect(results[1]).toEqual(manualRoutingResult);
    expect(results[2]).toEqual(engineRoutingResult);
});

test('Get Path Geography', async () => {
    // Prepare data and mock functions
    const mockRouteEngine = jest.fn();
    const mockRouteManual = jest.fn().mockImplementation(() => console.log("something"));
    // Mock routing services functions
    routingServiceManager.getRoutingServiceForEngine('engine').mapMatch = mockRouteEngine;
    routingServiceManager.getRoutingServiceForEngine('manual').mapMatch = mockRouteManual;

    /* Test with a 3 segments path */
    const complexPath = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [node1.properties.id, node4.properties.id, node6.properties.id],
        data: {
            nodeTypes: ["engine", "manual", "engine"],
            waypoints: [
                [waypoint1],
                [waypoint3],
                [waypoint5],
            ],
            waypointTypes: [
                ["engine"],
                ["manual"],
                ["engine"],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
        }
    }) as any;

    // Prepare path mapping results
    const terminalsRoutingResult = {
        tracepoints: [node1, TestUtils.makePoint(waypoint5)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentOneRoutingResult = {
        tracepoints: [node1, TestUtils.makePoint(waypoint1)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentTwoRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint1), node6, TestUtils.makePoint(waypoint3)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentThreeRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint3), node2, TestUtils.makePoint(waypoint5)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    mockRouteEngine
        .mockReturnValueOnce(terminalsRoutingResult)
        .mockReturnValueOnce(segmentOneRoutingResult)
        .mockReturnValueOnce(segmentThreeRoutingResult);
    mockRouteManual.mockReturnValue(segmentTwoRoutingResult);

    const results = await PathGeographyUtils.getPathGeography(complexPath) as PathGeographyResults;
    expect(results).toBeTruthy();
    expect(results.direct).toEqual(terminalsRoutingResult);
    expect(results.segmentResults).toEqual([segmentOneRoutingResult, segmentTwoRoutingResult, segmentThreeRoutingResult]);

    expect(mockRouteEngine).toHaveBeenNthCalledWith(1, expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...node1, properties: expect.objectContaining(node1.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint5), properties: expect.objectContaining({}) })
            ]
        }
    }));
    expect(mockRouteEngine).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...node1, properties: expect.objectContaining(node1.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint1), properties: expect.objectContaining({}) })
            ]
        }
    }));

    expect(mockRouteEngine).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...TestUtils.makePoint(waypoint3), properties: expect.objectContaining({}) }),
                expect.objectContaining({ ...node6, properties: expect.objectContaining(node6.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint5), properties: expect.objectContaining({}) })
            ]
        }
    }));

    expect(mockRouteManual).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...TestUtils.makePoint(waypoint1), properties: expect.objectContaining({}) }),
                expect.objectContaining({ ...node4, properties: expect.objectContaining(node4.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint3), properties: expect.objectContaining({}) })
            ]
        }
    }));

    /* Test with a 3 segments path */
    const pathWithNoLine = new TransitPathStub({
        id: "path1",
        line_id: "not a line",
        nodes: [node1.properties.id, node4.properties.id, node6.properties.id],
        data: {
            nodeTypes: ["engine", "manual", "engine"],
            waypoints: [
                [waypoint1],
                [waypoint3],
                [waypoint5],
            ],
            waypointTypes: [
                ["engine"],
                ["manual"],
                ["engine"],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
        }
    }) as any;
    expect(await PathGeographyUtils.getPathGeography(pathWithNoLine)).toBeFalsy();
});

test('Update Geography', async () => {
    // Prepare data and mock functions
    const mockRouteEngine = jest.fn();
    const mockRouteManual = jest.fn().mockImplementation(() => console.log("something"));
    // Mock routing services functions
    routingServiceManager.getRoutingServiceForEngine('engine').mapMatch = mockRouteEngine;
    routingServiceManager.getRoutingServiceForEngine('manual').mapMatch = mockRouteManual;

    /* Test with a 3 segments path */
    const complexPath = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [node1.properties.id, node4.properties.id, node6.properties.id],
        data: {
            nodeTypes: ["engine", "manual", "engine"],
            waypoints: [
                [waypoint1],
                [waypoint3],
                [waypoint5],
            ],
            waypointTypes: [
                ["engine"],
                ["manual"],
                ["engine"],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
        }
    }) as any;

    // Prepare path mapping results
    const terminalsRoutingResult = {
        tracepoints: [node1, TestUtils.makePoint(waypoint5)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [{ distance: 1000, duration: 66.67 }]
            }
        ]
    };
    const segmentOneRoutingResult = {
        tracepoints: [node1, TestUtils.makePoint(waypoint1)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentTwoRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint1), node6, TestUtils.makePoint(waypoint3)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    const segmentThreeRoutingResult = {
        tracepoints: [TestUtils.makePoint(waypoint3), node2, TestUtils.makePoint(waypoint5)],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    mockRouteEngine
        .mockReturnValueOnce(terminalsRoutingResult)
        .mockReturnValueOnce(segmentOneRoutingResult)
        .mockReturnValueOnce(segmentThreeRoutingResult);
    mockRouteManual.mockReturnValue(segmentTwoRoutingResult);
    complexPath.refreshStats = jest.fn();
    complexPath.validate = jest.fn();
    complexPath.emptyGeography = jest.fn();

    await updateGeography(complexPath);
    expect(complexPath.refreshStats).toHaveBeenCalledTimes(1);
    expect(complexPath.validate).toHaveBeenCalledTimes(1);
    expect(complexPath.emptyGeography).toHaveBeenCalledTimes(0);

    expect(mockRouteEngine).toHaveBeenNthCalledWith(1, expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...node1, properties: expect.objectContaining(node1.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint5), properties: expect.objectContaining({}) })
            ]
        }
    }));
    expect(mockRouteEngine).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...node1, properties: expect.objectContaining(node1.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint1), properties: expect.objectContaining({}) })
            ]
        }
    }));

    expect(mockRouteEngine).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...TestUtils.makePoint(waypoint3), properties: expect.objectContaining({}) }),
                expect.objectContaining({ ...node6, properties: expect.objectContaining(node6.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint5), properties: expect.objectContaining({}) })
            ]
        }
    }));

    expect(mockRouteManual).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...TestUtils.makePoint(waypoint1), properties: expect.objectContaining({}) }),
                expect.objectContaining({ ...node4, properties: expect.objectContaining(node4.properties) }),
                expect.objectContaining({ ...TestUtils.makePoint(waypoint3), properties: expect.objectContaining({}) })
            ]
        }
    }));

    /* Test with a 3 segments path */
    const pathWithNoLine = new TransitPathStub({
        id: "path1",
        line_id: "not a line",
        nodes: [node1.properties.id, node4.properties.id, node6.properties.id],
        data: {
            nodeTypes: ["engine", "manual", "engine"],
            waypoints: [
                [waypoint1],
                [waypoint3],
                [waypoint5],
            ],
            waypointTypes: [
                ["engine"],
                ["manual"],
                ["engine"],
            ],
            routingEngine: 'engine',
            routingMode: 'driving',
        }
    }) as any;
    pathWithNoLine.refreshStats = jest.fn();
    pathWithNoLine.validate = jest.fn();
    pathWithNoLine.generateGeographyAndSegmentsFromRouting = jest.fn();
    pathWithNoLine.emptyGeography = jest.fn();
    await updateGeography(pathWithNoLine);
    expect(pathWithNoLine.refreshStats).toHaveBeenCalledTimes(1);
    expect(pathWithNoLine.validate).toHaveBeenCalledTimes(1);
    expect(pathWithNoLine.emptyGeography).toHaveBeenCalledTimes(1);
});

test('Update Geography with manual routing type for terminal nodes', async () => {
    // Prepare data and mock functions
    const mockRouteEngine = jest.fn();
    const mockRouteManual = jest.fn();
    // Mock routing services functions
    routingServiceManager.getRoutingServiceForEngine('engine').mapMatch = mockRouteEngine;
    routingServiceManager.getRoutingServiceForEngine('manual').mapMatch = mockRouteManual;

    /* Test with a path where one of the terminal nodes has a 'manual' routing type */
    const pathWithManualTerminal = new TransitPathStub({
        id: "path1",
        line_id: line.get('id'),
        nodes: [node1.properties.id, node3.properties.id, node4.properties.id],
        data: {
            nodeTypes: ["engine", "engine", "manual"],
            waypoints: [],
            waypointTypes: [],
            routingEngine: 'engine',
            routingMode: 'driving',
        }
    }) as any;

    // Prepare path mapping results
    const terminalsRoutingResult = {
        tracepoints: [node1, node4],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [{ distance: 1000, duration: 66.67 }]
            }
        ]
    };
    const segmentRoutingResult = {
        tracepoints: [node1, node3],
        matchings: [
            {
                confidence: 99,
                distance: 50,
                duration: 360,
                legs: [/* data not important at this stage */]
            }
        ]
    };
    mockRouteManual.mockReturnValue(terminalsRoutingResult);
    mockRouteEngine.mockReturnValue(segmentRoutingResult);
    pathWithManualTerminal.refreshStats = jest.fn();
    pathWithManualTerminal.validate = jest.fn();
    pathWithManualTerminal.emptyGeography = jest.fn();

    await updateGeography(pathWithManualTerminal);
    expect(pathWithManualTerminal.refreshStats).toHaveBeenCalledTimes(1);
    expect(pathWithManualTerminal.validate).toHaveBeenCalledTimes(1);
    expect(pathWithManualTerminal.emptyGeography).toHaveBeenCalledTimes(0);

    expect(mockRouteManual).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...node1, properties: expect.objectContaining(node1.properties) }),
                expect.objectContaining({ ...node4, properties: expect.objectContaining(node4.properties) })
            ]
        }
    }));
    expect(mockRouteEngine).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'driving',
        points: {
            type: 'FeatureCollection' as const,
            features: [
                expect.objectContaining({ ...node1, properties: expect.objectContaining(node1.properties) }),
                expect.objectContaining({ ...node3, properties: expect.objectContaining(node3.properties) })
            ]
        }
    }));
});