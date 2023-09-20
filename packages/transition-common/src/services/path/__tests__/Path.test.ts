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

import Path from '../Path';
import Node from '../../nodes/Node';
import NodeCollection from '../../nodes/NodeCollection';
import { getPathAttributesWithData } from './PathData.test';

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

Preferences.setAttributes(Object.assign({}, Preferences.getAttributes(), pathPreferences))

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
    is_frozen: false,
    data: {
        ...arbitraryData
    }
};

beforeEach(() => {
    EventManagerMock.mockClear();
})

test('New paths', function () {

    const path = new Path(pathAttributesFullData, true);
    expect(path.getAttributes()).toEqual(pathAttributesFullData);
    expect(path.isNew()).toBe(true);

});

test('New path default data', function () {
    const path = new Path(pathAttributesNoData, true);
    expect(path.getAttributes()).toEqual({
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

test('should validate', function () {
    const path1 = new Path(pathAttributesFullData, true);
    expect(path1.validate()).toBe(true);

    const path2 = new Path(pathAttributesNoData, true);
    expect(path2.validate()).toBe(false);

    const path3 = new Path(pathAttributesNoGeometry, true);
    expect(path3.validate()).toBe(false);

    const path4 = new Path(pathAttributesFullDataWithoutTravelTime, false);
    expect(path4.validate()).toBe(false);

});

test('should convert to string', function () {
    const path1a = new Path(pathAttributesFullData, true);
    expect(path1a.toString()).toBe(pathAttributesFullData.name);
    expect(path1a.toString(true)).toBe(`${pathAttributesFullData.name} ${pathAttributesFullData.id}`);
    path1a.set('name', undefined);
    expect(path1a.toString()).toBe('');
    expect(path1a.toString(true)).toBe(`${pathAttributesFullData.id}`);
});

test('should save and delete in memory', function () {
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
    expect(eventManager.emit).toHaveBeenCalledWith('transitPath.create', path.getAttributes(), expect.anything());

    // Update
    path.set('direction', 'loop');
    await path.save(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(2);
    expect(eventManager.emit).toHaveBeenCalledWith('transitPath.update', path.getId(), path.getAttributes(), expect.anything());
});

test('Delete path', async () => {
    EventManagerMock.emitResponseReturnOnce(Status.createOk({ id: pathAttributesFullData.id }));
    const path = new Path(pathAttributesFullData, false);
    await path.delete(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitPath.delete', path.getId(), undefined, expect.anything());
    expect(path.isDeleted()).toBe(true);
});

test('static methods should work', function () {
    expect(Path.getPluralName()).toBe('paths');
    expect(Path.getCapitalizedPluralName()).toBe('Paths');
    expect(Path.getDisplayName()).toBe('Path');
    const path = new Path(pathAttributesFullData, true);
    expect(path.getPluralName()).toBe('paths');
    expect(path.getCapitalizedPluralName()).toBe('Paths');
    expect(path.getDisplayName()).toBe('Path');
});

test('test get node distances from path with node routing radius and diff between distance and radius', function () {
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
    const { id, data, ...expected } = _cloneDeep(pathAttributesNoGeometry);
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
