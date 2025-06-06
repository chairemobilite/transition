/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import _omit from 'lodash/omit';
import { lineString as turfLineString } from '@turf/turf';
import each from 'jest-each';

import Path from '../Path';
import Node from '../../nodes/Node';
import NodeCollection from '../../nodes/NodeCollection';
import { getPathAttributesWithData } from './PathData.test';
import updatePathGeography from '../PathGeographyUtils'
import TrError from 'chaire-lib-common/lib/utils/TrError';

jest.mock('../PathGeographyUtils', () => jest.fn().mockImplementation(async (path) => {
        // Just do a line string with nodes and waypoints
        const coordinates: [number, number][] = [];
        const waypoints = path.attributes.data.waypoints || [];
        const segments: number[] = [];
        for (let i = 0; i < path.attributes.nodes.length; i++) {
            // Add the node, with arbitrary coordinates
            coordinates.push([-73 + (i * 0.001), 45 + (i * 0.001)]);
            segments.push(coordinates.length - 1);
            // Add the waypoints
            const currentWaypoints = waypoints[i] || [];
            currentWaypoints.forEach(waypoint => coordinates.push(waypoint));
        }
        const geography = coordinates.length > 1 ? turfLineString(coordinates) : undefined;
        path.attributes.geography = geography === undefined ? undefined : geography.geometry;
        path.attributes.segments = segments;
        return { path };
}));
const updateGeographyMock = updatePathGeography as jest.MockedFunction<typeof updatePathGeography>;

const eventManager = EventManagerMock.eventManagerMock;

const pathPreferences = {
    transit: {
        paths: {
            data: {
                defaultRoutingEngine: 'manual',
                defaultRoutingMode: 'bus_urban',
                defaultMinLayoverTimeSeconds: 145,
                defaultLayoverRatioOverTotalTravelTime: 0.2
            }
        },
        nodes: {
            defaultRoutingRadiusMeters: 23.4
        }
    }
};

Preferences.setAttributes(Object.assign({}, Preferences.attributes, pathPreferences));

const lineId = uuidV4();
const node1Id = uuidV4();
const node2Id = uuidV4();

const arbitraryData = {
    defaultLayoverRatioOverTotalTravelTime: 0.2,
    defaultMinLayoverTimeSeconds: 120,
    defaultRoutingEngine: 'engine',
    defaultRoutingMode: 'bus',
    defaultAcceleration: 1.1,
    defaultDeceleration: 1.1,
    defaultDwellTimeSeconds: 30,
    defaultRunningSpeedKmH: 50,
    maxRunningSpeedKmH: 100,
    routingMode: 'rail',
    routingEngine: 'engine',
    // The following properties contain array of data per node.
    nodeTypes: [],
    waypoints: [],
    waypointTypes: [],
    variables: {
        d_p: null,
        n_q_p: null,
        d_l_min: null,
        d_l_max: null,
        d_l_avg: null,
        d_l_med: null,
        T_o_p: null,
        n_s_p: null,
    },
    gtfs: {
        shape_id: 'SHAPE1'
    }
};

const pathAttributesFullData = getPathAttributesWithData(true, { lineId });
const pathAttributesFullDataWithoutTravelTime = getPathAttributesWithData(false, { lineId });

const pathAttributesNoData = {
    id: uuidV4(),
    name: 'PathFull',
    geography: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.0001, 45]] },
    direction: 'outbound',
    line_id: lineId,
    is_enabled: true,
    /** array of node ids in this path */
    nodes: [node1Id, node2Id],
    /** TODO what's the difference with nodes? */
    stops: [node1Id, node2Id],
    /** TODO document? */
    segments: [],
    mode: 'monorail',
    is_frozen: false
};

const pathAttributesNoGeometry = {
    id: uuidV4(),
    name: 'PathFull',
    direction: 'outbound',
    line_id: lineId,
    is_enabled: true,
    /** array of node ids in this path */
    nodes: [],
    /** TODO what's the difference with nodes? */
    stops: null,
    /** TODO document? */
    segments: [],
    mode: 'monorail',
    integer_id: 3,
    is_frozen: false,
    data: {
        ...arbitraryData
    }
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('New paths', () => {

    const path = new Path(pathAttributesFullData, true);
    expect(path.attributes).toEqual(pathAttributesFullData);
    expect(path.isNew()).toBe(true);

});

test('New path default data', () => {
    const path = new Path(pathAttributesNoData, true);
    expect(path.attributes).toEqual({
        ...pathAttributesNoData,
        data: {
            waypoints: [],
            waypointTypes: [],
            nodeTypes: ['engine', 'engine'],
            ...pathPreferences.transit.paths.data,
            routingMode: 'monorail',
            routingEngine: 'manual',
            defaultRunningSpeedKmH: 75,
            maxRunningSpeedKmH: 120,
            defaultAcceleration: 0.8,
            defaultDeceleration: 0.8,
            defaultDwellTimeSeconds: 20,
            variables: {
                d_p: null,
                n_q_p: 2,
                d_l_min: null,
                d_l_max: null,
                d_l_avg: null,
                d_l_med: null,
                T_o_p: undefined,
                n_s_p: 2,
            }
        }
    });
    expect(path.isNew()).toBe(true);

});

test('should validate', () => {
    const path1 = new Path(pathAttributesFullData, true);
    expect(path1.validate()).toBe(true);

    const path2 = new Path(pathAttributesNoData, true);
    expect(path2.validate()).toBe(false);

    const path3 = new Path(pathAttributesNoGeometry, true);
    expect(path3.validate()).toBe(false);

    const path4 = new Path(pathAttributesFullDataWithoutTravelTime, false);
    expect(path4.validate()).toBe(false);

});

test('should convert to string', () => {
    const path1a = new Path(pathAttributesFullData, true);
    expect(path1a.toString()).toBe(pathAttributesFullData.name);
    expect(path1a.toString(true)).toBe(`${pathAttributesFullData.name} ${pathAttributesFullData.id}`);
    path1a.set('name', undefined);
    expect(path1a.toString()).toBe('');
    expect(path1a.toString(true)).toBe(`${pathAttributesFullData.id}`);
});

test('should save and delete in memory', () => {
    const path = new Path(pathAttributesFullData, true);
    expect(path.isNew()).toBe(true);
    expect(path.isDeleted()).toBe(false);
    path.saveInMemory();
    expect(path.isNew()).toBe(false);
    path.deleteInMemory();
    expect(path.isDeleted()).toBe(true);
});

test('Save path', async () => {
    const path = new Path(pathAttributesFullData, true);
    path.startEditing();
    await path.save(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitPath.create', path.attributes, expect.anything());

    // Update
    path.set('direction', 'loop');
    await path.save(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(2);
    expect(eventManager.emit).toHaveBeenCalledWith('transitPath.update', path.getId(), path.attributes, expect.anything());
});

test('Delete path', async () => {
    EventManagerMock.emitResponseReturnOnce(Status.createOk({ id: pathAttributesFullData.id }));
    const path = new Path(pathAttributesFullData, false);
    await path.delete(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitPath.delete', path.getId(), undefined, expect.anything());
    expect(path.isDeleted()).toBe(true);
});

test('static methods should work', () => {
    expect(Path.getPluralName()).toBe('paths');
    expect(Path.getCapitalizedPluralName()).toBe('Paths');
    expect(Path.getDisplayName()).toBe('Path');
    const path = new Path(pathAttributesFullData, true);
    expect(path.getPluralName()).toBe('paths');
    expect(path.getCapitalizedPluralName()).toBe('Paths');
    expect(path.getDisplayName()).toBe('Path');
});

test('test get node distances from path with node routing radius and diff between distance and radius', () => {
    const nodeIds = [uuidV4(), uuidV4(), uuidV4(), uuidV4()];
    const nodes = [
        (new Node({ id: nodeIds[0], geography: { type: 'Point', coordinates: [0.0, 0.0] }, routing_radius_meters: 4.3 }, false)).toGeojson(),
        (new Node({ id: nodeIds[1], geography: { type: 'Point', coordinates: [0.00001, 0] }, routing_radius_meters: 20 }, false)).toGeojson(),
        (new Node({ id: nodeIds[2], geography: { type: 'Point', coordinates: [0.000077, 0.00002] }, routing_radius_meters: 2 }, false)).toGeojson(),
        (new Node({ id: nodeIds[3], geography: { type: 'Point', coordinates: [0, 0.000083] } }, false)).toGeojson()
    ];
    const segments = [0, 3, 5];
    const geography = {
        type: 'LineString',
        coordinates: [[0, 0], [0, 0.00001], [0, 0.00003], [0, 0.00004], [0, 0.00005], [0.00002, 0.00005], [0.00004, 0.00005], [0.00005, 0.00005]]
    };
    const nodeCollection = new NodeCollection(nodes, {}, undefined);
    const path = new Path({ nodes: nodeIds, geography, segments }, false, undefined);
    expect(path.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([
        {
            nodeId: nodeIds[0],
            distanceMeters: 0,
            routingRadiusMeters: 4.3
        },
        {
            nodeId: nodeIds[1],
            distanceMeters: 4.584690608518845,
            routingRadiusMeters: 20
        },
        {
            nodeId: nodeIds[2],
            distanceMeters: 7.162378865077197,
            routingRadiusMeters: 2
        },
        {
            nodeId: nodeIds[3],
            distanceMeters: 6.661504133506074,
            routingRadiusMeters: pathPreferences.transit.nodes.defaultRoutingRadiusMeters
        }
    ]);

    expect(path.getDistancesForNodeIdsWithRoutingRadiusTooSmallForPathShape(nodeCollection)).toEqual({ [nodeIds[0]]: 0, [nodeIds[2]]: 7.162378865077197 });

    const pathWithoutNodes = new Path({ nodes: [], geography, segments }, false, undefined);
    const pathWithoutSegments = new Path({ nodes: nodeIds, geography, segments: [] }, false, undefined);
    const pathWithoutWrongSegments = new Path({ nodes: nodeIds, geography, segments: [0, 2] }, false, undefined);
    const pathWithoutGeography = new Path({ nodes: nodeIds, geography: null, segments }, false, undefined);
    const pathWithoutCoordinates = new Path({ nodes: nodeIds, geography: { type: 'LineString', coordinates: [] }, segments }, false, undefined);
    const pathWithMissingCoordinates = new Path({ nodes: nodeIds, geography: { type: 'LineString', coordinates: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] }, segments }, false, undefined);

    expect(pathWithoutNodes.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([]);
    expect(pathWithoutSegments.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([]);
    expect(pathWithoutWrongSegments.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([]);
    expect(pathWithoutGeography.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([]);
    expect(pathWithoutCoordinates.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([]);
    expect(pathWithMissingCoordinates.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection)).toEqual([]);

});

test('getClonedAttributes', () => {
    const path = new Path(pathAttributesNoGeometry, true);

    // Delete specifics
    const clonedAttributes = path.getClonedAttributes();
    const { id, data, integer_id, ...expected } = _cloneDeep(pathAttributesNoGeometry);
    (expected as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes).toEqual(expected);

    // Complete copy
    const clonedAttributes2 = path.getClonedAttributes(false);
    const { data: data2, ...expectedWithSpecifics } = _cloneDeep(pathAttributesNoGeometry);
    (expectedWithSpecifics as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes2).toEqual(expectedWithSpecifics);

    // With second object
    const path2 = new Path(pathAttributesNoData, true);

    // Delete specifics
    const clonedAttributes3 = path2.getClonedAttributes();
    const expected2 = _omit(path2.attributes, 'id');
    expect(clonedAttributes3).toEqual(expected2);

    // Complete copy
    const clonedAttributes4 = path2.getClonedAttributes(false);
    expect(clonedAttributes4).toEqual(path2.attributes);
});

describe('getDwellTimeSecondsAtNode', () => {
    let instance: Path;
    let mockPreferencesGet: jest.Mock;

    beforeEach(() => {
        instance = new Path({}, false, undefined);
        mockPreferencesGet = jest.fn();

        // Mock the getData and Preferences.get methods
        Preferences.get = mockPreferencesGet;
    });

    it('should return the node dwell time when provided and valid', () => {
        mockPreferencesGet.mockReturnValueOnce(20); // Default general dwell time
        instance.attributes.data.ignoreNodesDefaultDwellTimeSeconds = false;
        expect(instance.getDwellTimeSecondsAtNode(30)).toBe(30);
    });

    it('should return the default general dwell time when node dwell time is undefined', () => {
        instance.attributes.data.ignoreNodesDefaultDwellTimeSeconds = false;
        mockPreferencesGet.mockReturnValueOnce(20); // Default general dwell time
        expect(instance.getDwellTimeSecondsAtNode(undefined)).toBe(20);
    });

    it('should return the path dwell time when ignoreNodesDefaultDwellTimeSecond is true', () => {
        instance.attributes.data.ignoreNodesDefaultDwellTimeSeconds = true;
        instance.attributes.data.defaultDwellTimeSeconds = 15;
        expect(instance.getDwellTimeSecondsAtNode(20)).toBe(15);
    });

    it('should return the maximum between node dwell time and path dwell time', () => {
        instance.attributes.data.ignoreNodesDefaultDwellTimeSeconds = false;
        instance.attributes.data.defaultDwellTimeSeconds = 15;
        expect(instance.getDwellTimeSecondsAtNode(20)).toBe(20); // Node dwell time is higher
    });

    it('should handle negative node dwell time by using the default', () => {
        instance.attributes.data.ignoreNodesDefaultDwellTimeSeconds = false;
        instance.attributes.data.defaultDwellTimeSeconds = 15;
        mockPreferencesGet.mockReturnValueOnce(20); // Default general dwell time
        expect(instance.getDwellTimeSecondsAtNode(-5)).toBe(20);
    });

    it('should ceil the final result', () => {
        instance.attributes.data.ignoreNodesDefaultDwellTimeSeconds = false;
        instance.attributes.data.defaultDwellTimeSeconds = 15.3;
        expect(instance.getDwellTimeSecondsAtNode(15.7)).toBe(16);
    });
});

type NodeAndWaypointData = {
    nodes?: string[];
    nodeTypes?: string[];
    waypoints?: [number, number][][];
    waypointTypes?: string[][];
    calculateGeography?: boolean; // Set to false to simulate a path with errors
};
const newWaypoint: [number, number] = [-72.5, 45.5];

describe('Insert waypoints', () => {
    each([
        ['In empty path', { }, { calculateGeography: false }, undefined, undefined],
        ['At the end of a one node path', { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }, { waypoints: [[newWaypoint]], waypointTypes: [['manual']], calculateGeography: true }, undefined, undefined],
        ['At the end of a multiple node path', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { waypoints: [[], [newWaypoint]], waypointTypes: [[], ['manual']], calculateGeography: true }, undefined, undefined],
        ['At the end of a multiple node and waypoints path', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05]] ], waypointTypes: [[], ['manual']] }, { waypoints: [[], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05], newWaypoint]], waypointTypes: [[], ['manual', 'manual']], calculateGeography: true }, undefined, undefined],
        ['Insert after a node, without waypoints', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { waypoints: [[newWaypoint], []], waypointTypes: [['manual'], []], calculateGeography: true }, 0, undefined],
        ['Insert after a node, at the end of other waypoints', { nodes: [node1Id, node2Id, uuidV4()], nodeTypes: ['manual', 'manual'], waypoints: [[], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05]], [] ], waypointTypes: [[], ['manual'], []] }, { waypoints: [[], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05], newWaypoint], []], waypointTypes: [[], ['manual', 'manual'], []], calculateGeography: true }, 1, undefined],
        ['Insert after a node, in the middle of waypoints', { nodes: [node1Id, node2Id, uuidV4()], nodeTypes: ['manual', 'manual'], waypoints: [[[newWaypoint[0] - 0.04, newWaypoint[1] - 0.04]], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05], [newWaypoint[0] + 0.03, newWaypoint[1] + 0.05]], [] ], waypointTypes: [['manual'], ['manual', 'manual'], []] }, { waypoints: [[[newWaypoint[0] - 0.04, newWaypoint[1] - 0.04]], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05], newWaypoint, [newWaypoint[0] + 0.03, newWaypoint[1] + 0.05]], []], waypointTypes: [['manual'], ['manual', 'manual', 'manual'], []], calculateGeography: true }, 1, 1],
        ['Find insert location along the path', { nodes: [node1Id, node2Id, uuidV4()], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[[newWaypoint[0] + 0.04, newWaypoint[1] - 0.04]], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05], [newWaypoint[0] + 0.05, newWaypoint[1] + 0.05]], [] ], waypointTypes: [['manual'], ['manual', 'manual'], []] }, { waypoints: [[[newWaypoint[0] + 0.04, newWaypoint[1] - 0.04]], [[newWaypoint[0] - 0.05, newWaypoint[1] - 0.05], newWaypoint, [newWaypoint[0] + 0.05, newWaypoint[1] + 0.05]], []], waypointTypes: [['manual'], ['manual', 'manual', 'manual'], []], calculateGeography: true }, undefined, undefined],
    ]).test('%s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData, insertAfterNodeIdx: number | undefined, insertAfterWaypointIdx: number | undefined) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Add waypoint
        const response = await path.insertWaypoint(newWaypoint, 'manual', insertAfterNodeIdx, insertAfterWaypointIdx);
        expect(response.path).toEqual(path);

        // Validate the data
        expect(path.attributes.nodes).toEqual(expected.nodes || preData.nodes || []);
        expect(path.attributes.data.nodeTypes).toEqual(expected.nodeTypes || preData.nodeTypes || []);
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });
});

const modifiedWaypoint: [number, number] = [-72.4, 45.4];
describe('Update waypoints', () => {
    each([
        ['No geography, unexisting waypoint', { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]], calculateGeography: false }, { calculateGeography: false }, 0, 0],
        ['No geography, with existing waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint], []], waypointTypes: [['manual'], []], calculateGeography: false }, { waypoints: [[modifiedWaypoint], []], calculateGeography: true }, 0, 0],
        ['Modify existing waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint, [newWaypoint[0] + 0.00001, newWaypoint[1] - 0.001]], []], waypointTypes: [['manual', 'manual'], []] }, { waypoints: [[newWaypoint, modifiedWaypoint], []], calculateGeography: true }, 0, 1],
        ['Existing node, unexisting waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint, [newWaypoint[0] + 0.00001, newWaypoint[1] - 0.001]], []], waypointTypes: [['manual'], []] }, { calculateGeography: false }, 0, 4],
        ['Unexisting node and waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint], []], waypointTypes: [['manual'], []] }, { calculateGeography: false }, 2, 2],
    ]).test('%s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData, insertAfterNodeIdx: number, insertAfterWaypointIdx: number) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Update waypoint
        const response = await path.updateWaypoint(modifiedWaypoint, undefined, insertAfterNodeIdx, insertAfterWaypointIdx);
        expect(response.path).toEqual(path);

        // Validate the expected data
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });

    test('Change waypoint type', async () => {
        // Prepare test data

        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = [node1Id, node2Id];
        path.attributes.data.nodeTypes = ['manual', 'manual'];
        path.attributes.data.waypoints = [[newWaypoint], []];
        path.attributes.data.waypointTypes = [['manual'], []];
        updatePathGeography(path);
        updateGeographyMock.mockClear();

        // Update waypoint
        const response = await path.updateWaypoint(modifiedWaypoint, 'engine', 0, 0);
        expect(response.path).toEqual(path);

        // Validate the expected data
        expect(path.attributes.data.waypoints).toEqual([[modifiedWaypoint], []]);
        expect(path.attributes.data.waypointTypes).toEqual([['engine'], []]);
        expect(updateGeographyMock).toHaveBeenCalledTimes(1);
    });
});

describe('Remove waypoints', () => {
    each([
        ['No geography, unexisting waypoint', { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]], calculateGeography: false }, { calculateGeography: false}, 0, 0],
        ['No geography, with existing waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint], []], waypointTypes: [['manual'], []], calculateGeography: false }, { waypoints: [[], []], waypointTypes: [[], []], calculateGeography: true }, 0, 0],
        ['Existing waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint, [newWaypoint[0] + 0.00001, newWaypoint[1] - 0.001], [newWaypoint[0] + 0.01, newWaypoint[1] - 0.01] ], []], waypointTypes: [['manual', 'manual', 'manual'], []] }, { waypoints: [[newWaypoint, [newWaypoint[0] + 0.01, newWaypoint[1] - 0.01]], []], waypointTypes: [['manual', 'manual'], []], calculateGeography: true }, 0, 1],
        ['Existing node, unexisting waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint, [newWaypoint[0] + 0.00001, newWaypoint[1] - 0.001]], []], waypointTypes: [['manual'], []] }, { calculateGeography: false }, 0, 4],
        ['Unexisting node and waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint], []], waypointTypes: [['manual'], []] }, {calculateGeography: false }, 2, 2],
    ]).test('%s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData, insertAfterNodeIdx: number, insertAfterWaypointIdx: number) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Remove waypoint
        const response = await path.removeWaypoint(insertAfterNodeIdx, insertAfterWaypointIdx);
        expect(response.path).toEqual(path);

        // Validate the expected data
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });
});

const replacingNodeId = uuidV4();
describe('Replace waypoint by node id', () => {
    each([
        ['Existing waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint, [newWaypoint[0] + 0.00001, newWaypoint[1] - 0.001], [newWaypoint[0] + 0.01, newWaypoint[1] - 0.01] ], []], waypointTypes: [['manual', 'manual', 'manual'], []] }, { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'engine', 'manual'], waypoints: [[newWaypoint], [[newWaypoint[0] + 0.01, newWaypoint[1] - 0.01]], []], waypointTypes: [['manual'], ['manual'], []] }, 0, 1],
        ['Existing node, unexisting waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint, [newWaypoint[0] + 0.00001, newWaypoint[1] - 0.001]], []], waypointTypes: [['manual'], []] }, { calculateGeography: false }, 0, 4],
        ['Unexisting node and waypoint', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[newWaypoint], []], waypointTypes: [['manual'], []] }, { calculateGeography: false }, 2, 2],
    ]).test('%s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData, insertAfterNodeIdx: number, insertAfterWaypointIdx: number) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Replace waypoint by node
        const response = await path.replaceWaypointByNodeId(replacingNodeId, insertAfterNodeIdx, insertAfterWaypointIdx, 'engine');
        expect(response.path).toEqual(path);

        // Validate the expected data
        expect(path.attributes.nodes).toEqual(expected.nodes || preData.nodes || []);
        expect(path.attributes.data.nodeTypes).toEqual(expected.nodeTypes || preData.nodeTypes || []);
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });
});

describe('Insert node ID', () => {
    each([
        ['In empty path', { }, { nodes: [replacingNodeId], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]], calculateGeography: true }, undefined],
        ['At the end of a one node path', { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }, { nodes: [node1Id, replacingNodeId], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []], calculateGeography: true }, undefined],
        ['At the end of a multiple node path', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { nodes: [node1Id, node2Id, replacingNodeId], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []], calculateGeography: true }, undefined],
        ['At the end of a multiple node and waypoints path', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [newWaypoint] ], waypointTypes: [[], ['manual']] }, { nodes: [node1Id, node2Id, replacingNodeId], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [newWaypoint], []], waypointTypes: [[], ['manual'], []], calculateGeography: true }, undefined],
        ['Insert at the beginning', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { nodes: [replacingNodeId, node1Id, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []], calculateGeography: true }, 0],
        ['Insert after a node, without waypoints', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []], calculateGeography: true }, 1],
        ['Insert after a node, with waypoints', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [newWaypoint] ], waypointTypes: [[], ['manual']] }, { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], [newWaypoint]], waypointTypes: [[], [], ['manual']], calculateGeography: true }, 1],
        ['Insert identical node', { nodes: [replacingNodeId, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [newWaypoint] ], waypointTypes: [[], ['manual']] }, { calculateGeography: true }, 1],
    ]).test('%s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData, insertIndex: number | undefined) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Insert node ID
        const response = await path.insertNodeId(replacingNodeId, insertIndex === undefined ? null : insertIndex, 'manual');
        expect(response.path).toEqual(path);

        // Validate the data
        expect(path.attributes.nodes).toEqual(expected.nodes || preData.nodes || []);
        expect(path.attributes.data.nodeTypes).toEqual(expected.nodeTypes || preData.nodeTypes || []);
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });
});

describe('Remove node', () => {
    each([
        ['In empty path', { }, { calculateGeography: false }],
        ['Single node of a path', { nodes: [replacingNodeId], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }, { nodes: [], nodeTypes: [], waypoints: [], waypointTypes: [] }],
        ['Last node of the path', { nodes: [node1Id, replacingNodeId], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }],
        ['Node in the middle of a path, with waypoints after', { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], [newWaypoint] ], waypointTypes: [[], [], ['manual']] }, { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [newWaypoint]], waypointTypes: [[], ['manual']]}],
        ['Node in the middle of a path, with waypoints before, on and after the node, waypoints are deleted', { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[[newWaypoint[0] + 0.01, newWaypoint[1] + 0.01]], [newWaypoint], [[newWaypoint[0] + 0.02, newWaypoint[1] + 0.02]] ], waypointTypes: [['manual'], ['manual'], ['manual']] }, { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [[newWaypoint[0] + 0.02, newWaypoint[1] + 0.02]]], waypointTypes: [[], ['manual']] }],
        ['Node that is duplicated in the path, not deleted', { nodes: [replacingNodeId, node1Id, replacingNodeId], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []] }, { calculateGeography: false }],
        ['Node between 2 duplicated nodes', { nodes: [node1Id, replacingNodeId, node1Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []] }, { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] } ],
        ['Node not part of the path', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { calculateGeography: false }],
    ]).test('By ID: %s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Remove node ID
        const response = await path.removeNodeId(replacingNodeId);
        expect(response.path).toEqual(path);

        // Validate the data
        expect(path.attributes.nodes).toEqual(expected.nodes || preData.nodes || []);
        expect(path.attributes.data.nodeTypes).toEqual(expected.nodeTypes || preData.nodeTypes || []);
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });

    each([
        ['In empty path, unexisting index', { }, { calculateGeography: false }, 2],
        ['Single node of a path', { nodes: [replacingNodeId], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }, { nodes: [], nodeTypes: [], waypoints: [], waypointTypes: [] }, 0],
        ['Last node of the path', { nodes: [node1Id, replacingNodeId], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }, 1],
        ['Node in the middle of a path, with waypoints after', { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], [newWaypoint] ], waypointTypes: [[], [], ['manual']] }, { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [newWaypoint]], waypointTypes: [[], ['manual']]}, 1],
        ['Node in the middle of a path, with waypoints before, on and after the node, waypoints are deleted', { nodes: [node1Id, replacingNodeId, node2Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[[newWaypoint[0] + 0.01, newWaypoint[1] + 0.01]], [newWaypoint], [[newWaypoint[0] + 0.02, newWaypoint[1] + 0.02]] ], waypointTypes: [['manual'], ['manual'], ['manual']] }, { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], [[newWaypoint[0] + 0.02, newWaypoint[1] + 0.02]]], waypointTypes: [[], ['manual']] }, 1],
        ['Node that is duplicated in the path', { nodes: [replacingNodeId, node1Id, replacingNodeId], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []] }, { nodes: [node1Id, replacingNodeId], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, 0],
        ['Node between 2 duplicated nodes', { nodes: [node1Id, replacingNodeId, node1Id], nodeTypes: ['manual', 'manual', 'manual'], waypoints: [[], [], []], waypointTypes: [[], [], []] }, { nodes: [node1Id], nodeTypes: ['manual'], waypoints: [[]], waypointTypes: [[]] }, 1 ],
        ['Unexisting index', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { calculateGeography: false }, 3],
        ['Unexisting index, index is length', { nodes: [node1Id, node2Id], nodeTypes: ['manual', 'manual'], waypoints: [[], []], waypointTypes: [[], []] }, { calculateGeography: false }, 2],
    ]).test('By index: %s', async (_title, preData: NodeAndWaypointData, expected: NodeAndWaypointData, removeIndex: number) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.nodes = _cloneDeep(preData.nodes || []);
        path.attributes.data.nodeTypes = _cloneDeep(preData.nodeTypes || []);
        path.attributes.data.waypoints = _cloneDeep(preData.waypoints || []);
        path.attributes.data.waypointTypes = _cloneDeep(preData.waypointTypes || []);
        if (preData.calculateGeography !== false) {
            updatePathGeography(path);
        }
        updateGeographyMock.mockClear();

        // Remove node
        const response = await path.removeNode(removeIndex);
        expect(response.path).toEqual(path);

        // Validate the data
        expect(path.attributes.nodes).toEqual(expected.nodes || preData.nodes || []);
        expect(path.attributes.data.nodeTypes).toEqual(expected.nodeTypes || preData.nodeTypes || []);
        expect(path.attributes.data.waypoints).toEqual(expected.waypoints || preData.waypoints || []);
        expect(path.attributes.data.waypointTypes).toEqual(expected.waypointTypes || preData.waypointTypes || []);
        expect(updateGeographyMock).toHaveBeenCalledTimes(expected.calculateGeography !== false ? 1 : 0);
    });
});

describe('Segment geojson', () => {
    type SegmentTestData = {
        geography?: GeoJSON.LineString;
        segments?: number[];
    };

    const basePoint = [-73, 45];

    each([
        ['Empty geography', { }, 'PathNoGeography', 0, 1],
        ['Path with geography, valid segment', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 3 ] }, {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001]]
            }, 0, 2],
        ['Path with geography, identical start/end', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 3 ] }, 'PathInvalidSegmentIndex', 2, 2],
        ['Path with geography, start index too high', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 3 ] }, 'PathInvalidSegmentIndex', 5, 6],
        ['Path with geography, end index too high', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 3 ] }, {
                type: 'LineString',
                coordinates: [[basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            }, 1, 5],
        ['Path with geography, start higher than end', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 3 ] }, 'PathInvalidSegmentIndex', 2, 0],
        ['Path with geography, start is the end, on a node', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 4 ] }, {
                type: 'LineString',
                coordinates: [[basePoint[0] - 0.0004, basePoint[1]], [basePoint[0] - 0.0004, basePoint[1]]]
            }, 2, 3],
        ['Path with geography, start is the end, with waypoints', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 3 ] }, {
                type: 'LineString',
                coordinates: [[basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            }, 2, 3],
        ['Path with geography, invalid segment data', {
            geography: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]]
            },
            segments: [ 0, 2, 10 ] }, 'PathInvalidSegmentIndex', 2, 3],
    ]).test('Segment geojson: %s', (_title, preData: SegmentTestData, expected: GeoJSON.LineString | string, startIndex: number, endIndex: number) => {
        // Prepare test data
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.geography = preData.geography === undefined ? undefined as any: _cloneDeep(preData.geography);
        path.attributes.segments = _cloneDeep(preData.segments || []);

        // get segment geojson
        let error: unknown | undefined = undefined;
        let segmentGeojson: GeoJSON.Feature<GeoJSON.LineString> | undefined = undefined;
        try {
            segmentGeojson = path.segmentGeojson(startIndex, endIndex);
        } catch (err) {
            error = err;
        }

        // Compare with the expected data
        if (typeof expected === 'string') {
            expect(error).toBeDefined();
            expect((error as TrError).getCode()).toEqual(expected)
        } else {
            expect(error).toBeUndefined();
            expect(segmentGeojson).toEqual({
                type: 'Feature',
                id: path.attributes.integer_id,
                properties: {
                },
                geometry: expected
            });
        }
    });

    test('With additional properties', () => {
        const path = new Path(_cloneDeep(pathAttributesNoGeometry), true);
        path.attributes.geography = { 
            type: 'LineString', 
            coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]], [basePoint[0] - 0.0003, basePoint[1] + 0.0001], [basePoint[0] - 0.0004, basePoint[1]]] 
        }
        path.attributes.segments = [ 0, 2, 3 ];

        // get segment geojson
        const additionalProperties = {
            test: 'abc',
            foo: 23
        }
        const segmentGeojson = path.segmentGeojson(0, 1, additionalProperties);

        // Compare with the expected data
        expect(segmentGeojson).toEqual({
            type: 'Feature',
            id: path.attributes.integer_id,
            properties: {
                ...additionalProperties
            },
            geometry: {
                type: 'LineString',
                coordinates: [basePoint, [basePoint[0] - 0.0001, basePoint[1] + 0.0001], [basePoint[0] - 0.0002, basePoint[1]]]
            }
        });
    });
});
