/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventManagerMock, TestUtils, RoutingServiceManagerMock } from 'chaire-lib-common/lib/test';
import events from 'events';
import { v4 as uuidV4 } from 'uuid';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { saveAndUpdateAllNodes } from '../NodeCollectionUtils';
import { objectToCache } from '../../../models/capnpCache/transitNodes.cache.queries';
import { getTransferableNodes } from '../TransferableNodeUtils';

jest.mock('../TransferableNodeUtils', () => ({
    getTransferableNodes: jest.fn()
}));
const mockGetTransferableNodes = getTransferableNodes as jest.MockedFunction<typeof getTransferableNodes>;

jest.mock('../../../models/capnpCache/transitNodes.cache.queries', () => {
    return {
        objectToCache: jest.fn()
    };
});
const mockedObjectToCache = objectToCache as jest.MockedFunction<typeof objectToCache>;

const eventEmitter = new events.EventEmitter();
const eventManager = EventManagerMock.eventManagerMock;
const mockTableFrom = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableFrom;
// Actual response does not matter for this test, just return 0s for every destination
mockTableFrom.mockImplementation(async (params) => ({ query: '', durations: params.destinations.map((d) => 0), distances: params.destinations.map((d) => 0) }));

const commonProperties = {
    is_enabled: true,
    routing_radius_meters: 20,
    default_dwell_time_seconds: 20,
    is_frozen: false,
    data: { }
};

// 4 nodes: 3 within 1km distance, one beyond

const nodeAttributesClose1 = {
    id: uuidV4(),
    integer_id: 1,
    name: 'Node1',
    geography: { type: 'Point' as const, coordinates: [-73.62508177757263, 45.53720431516967] as [number, number] },
    code: 'nodeCode',
    ...commonProperties
};

const nodeAttributesClose2 = {
    id: uuidV4(),
    integer_id: 2,
    name: 'Node2',
    geography: { type: 'Point' as const, coordinates: [-73.62407326698303, 45.53891770223567] as [number, number] },
    code: 'nodeCode2',
    ...commonProperties
};

const nodeAttributesClose3 = {
    id: uuidV4(),
    integer_id: 3,
    name: 'Node3',
    geography: { type: 'Point' as const, coordinates: [-73.62024307250977, 45.537828054224086] as [number, number] },
    code: 'nodeCode3',
    ...commonProperties
};

const nodeAttributesFar = {
    id: uuidV4(),
    integer_id: 4,
    name: 'Node4',
    geography: { type: 'Point' as const, coordinates: [-73.61251831054688, 45.52475063103143] as [number, number] },
    code: 'nodeCode4',
    ...commonProperties
};

const nodeClose1Geojson = TestUtils.makePoint(nodeAttributesClose1.geography.coordinates, nodeAttributesClose1) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const nodeClose2Geojson = TestUtils.makePoint(nodeAttributesClose2.geography.coordinates, nodeAttributesClose2) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const nodeClose3Geojson = TestUtils.makePoint(nodeAttributesClose3.geography.coordinates, nodeAttributesClose3) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const nodeFarGeojson = TestUtils.makePoint(nodeAttributesFar.geography.coordinates, nodeAttributesFar) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;

let nodeCollection: NodeCollection;

beforeEach(() => {
    nodeCollection = new NodeCollection([nodeClose1Geojson, nodeClose2Geojson, nodeClose3Geojson, nodeFarGeojson], {}, eventManager);
    mockTableFrom.mockClear();
    mockedObjectToCache.mockClear();
});

test('saveAndUpdateAllNodes without collection manager', async() => {
    // Mock the transferable nodes for each node
    const node1TransferableNodes = {
        nodesIds: [nodeAttributesClose1.id, nodeAttributesClose2.id, nodeAttributesClose3.id],
        walkingTravelTimesSeconds: [0, 150, 550],
        walkingDistancesMeters: [0, 120, 512]
    };
    const node2TransferableNodes = {
        nodesIds: [nodeAttributesClose2.id, nodeAttributesClose1.id, nodeAttributesClose3.id],
        walkingTravelTimesSeconds: [0, 150, 300],
        walkingDistancesMeters: [0, 120, 250]
    };
    const node3TransferableNodes = {
        nodesIds: [nodeAttributesClose3.id],
        walkingTravelTimesSeconds: [0],
        walkingDistancesMeters: [0]
    };
    const nodeFarTransferableNodes = {
        nodesIds: [nodeAttributesFar.id],
        walkingTravelTimesSeconds: [0],
        walkingDistancesMeters: [0]
    };
    mockGetTransferableNodes.mockImplementation(async (node, _) => node.getId() === nodeAttributesClose1.id ? node1TransferableNodes : node.getId() === nodeAttributesClose2.id ? node2TransferableNodes : node.getId() === nodeAttributesClose3.id ? node3TransferableNodes : nodeFarTransferableNodes);
    await saveAndUpdateAllNodes(nodeCollection, undefined, eventEmitter);

    // Make sure all save calls to object to cache were done correctly
    expect(mockedObjectToCache).toHaveBeenCalledTimes(4);
    // Make sure nodes have been updated
    const savedObject1 = mockedObjectToCache.mock.calls[0][0];
    const savedObject2 = mockedObjectToCache.mock.calls[1][0];
    const savedObject3 = mockedObjectToCache.mock.calls[2][0];
    const savedObject4 = mockedObjectToCache.mock.calls[3][0];
    // Validate transferable node data was successfully saved
    expect(savedObject1.getId()).toEqual(nodeAttributesClose1.id);
    expect(savedObject1.getData('transferableNodes')).toEqual(node1TransferableNodes);
    expect(savedObject2.getId()).toEqual(nodeAttributesClose2.id);
    expect(savedObject2.getData('transferableNodes')).toEqual(node2TransferableNodes);
    expect(savedObject3.getId()).toEqual(nodeAttributesClose3.id);
    expect(savedObject3.getData('transferableNodes')).toEqual(node3TransferableNodes);
    expect(savedObject4.getId()).toEqual(nodeAttributesFar.id);
    expect(savedObject4.getData('transferableNodes')).toEqual(nodeFarTransferableNodes);
});
