/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TestUtils, RoutingServiceManagerMock } from 'chaire-lib-common/lib/test';
import { v4 as uuidV4 } from 'uuid';
import Node, { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import nodesDbQueries from '../../../models/db/transitNodes.db.queries';
import * as TransferableNodeUtils from '../TransferableNodeUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

jest.mock('../../../models/db/transitNodes.db.queries', () => {
    return {
        getNodesInBirdDistance: jest.fn()
    }
});
const mockedGetNodesInBirdDistance = nodesDbQueries.getNodesInBirdDistance as jest.MockedFunction<typeof nodesDbQueries.getNodesInBirdDistance>;

const mockTableFrom = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableFrom;
const mockTableTo = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableTo;
// Actual response does not matter for this test, just return 0s for every destination 
mockTableFrom.mockImplementation(async (params) => ({ query: '', durations: params.destinations.map(d => 0), distances: params.destinations.map(d => 0) }));

const commonProperties = {
    is_enabled: true,
    routing_radius_meters: 20,
    default_dwell_time_seconds: 20,
    is_frozen: false,
    data: { }
}

// 4 nodes: 1 reference node, 2 within 1km distance, one beyond

const referenceNode = {
    id: uuidV4(),
    integer_id: 1,
    name: 'Node1',
    geography: { type: 'Point' as const, coordinates: [-73.62508177757263, 45.53720431516967] as [number, number] },
    code: 'nodeCode',
    ...commonProperties
};

const nodeAttributesClose1 = {
    id: uuidV4(),
    integer_id: 2,
    name: 'Node2',
    geography: { type: 'Point' as const, coordinates: [-73.62407326698303, 45.53891770223567] as [number, number] },
    code: 'nodeCode2',
    ...commonProperties
};

const nodeAttributesClose2 = {
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

const referenceNodeGeojson = TestUtils.makePoint(referenceNode.geography.coordinates, referenceNode) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const nodeClose1Geojson = TestUtils.makePoint(nodeAttributesClose1.geography.coordinates, nodeAttributesClose1) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const nodeClose2Geojson = TestUtils.makePoint(nodeAttributesClose2.geography.coordinates, nodeAttributesClose2) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const nodeFarGeojson = TestUtils.makePoint(nodeAttributesFar.geography.coordinates, nodeAttributesFar) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;

let nodeCollection: NodeCollection;

beforeEach(() => {
    nodeCollection = new NodeCollection([referenceNodeGeojson, nodeClose1Geojson, nodeClose2Geojson, nodeFarGeojson], {});
    mockTableFrom.mockClear();
    mockTableTo.mockClear();
    mockedGetNodesInBirdDistance.mockClear();
});

describe('getNodesInBirdDistance', () => {
    test('no data', async () => {
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([]);
        const distance = 1000;
        const nodesInBirdDistance = await TransferableNodeUtils.getNodesInBirdDistance(referenceNode.id, distance);
        expect(nodesInBirdDistance).toEqual([]);
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(referenceNode.id, distance);
    });

    test('some nodes returned, not including requested one', async () => {
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([
            { id: nodeAttributesClose1.id, distance: 300 }, 
            { id: nodeAttributesClose2.id, distance: 700 }
        ]);
        const distance = 1000;
        const nodesInBirdDistance = await TransferableNodeUtils.getNodesInBirdDistance(referenceNode.id, distance);
        expect(nodesInBirdDistance).toEqual([
            { id: nodeAttributesClose1.id, distance: 300 }, 
            { id: nodeAttributesClose2.id, distance: 700 }
        ]);
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(referenceNode.id, distance);
    });

    test('some nodes returned, including requested one', async () => {
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([
            { id: nodeAttributesClose1.id, distance: 300 }, 
            { id: nodeAttributesClose2.id, distance: 700 }
        ]);
        const distance = 1000;
        const nodesInBirdDistance = await TransferableNodeUtils.getNodesInBirdDistance(referenceNode.id, distance);
        expect(nodesInBirdDistance).toEqual([
            { id: nodeAttributesClose1.id, distance: 300 }, 
            { id: nodeAttributesClose2.id, distance: 700 }
        ]);
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(referenceNode.id, distance);
    });
});

describe('getTransferableNodes', () => {

    let refNode: Node;
    const travelTimeSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
    const defaultSpeedMps = Preferences.get('defaultWalkingSpeedMetersPerSeconds')
    const distanceMeters = Math.ceil(defaultSpeedMps * travelTimeSeconds);

    beforeEach(() => {
        nodeCollection = new NodeCollection([referenceNodeGeojson, nodeClose1Geojson, nodeClose2Geojson, nodeFarGeojson], {});
        mockTableFrom.mockClear();
        mockedGetNodesInBirdDistance.mockClear();
        const refNodeGeo = nodeCollection.getById(referenceNode.id) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
        refNode = nodeCollection.newObject(refNodeGeo);
    });

    afterEach(() => {
        Preferences.set('transit.nodes.useBirdDistanceForTransferableNodes', false);
    });

    test('With some accessible nodes', async() => {
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([{ id: nodeAttributesClose1.id, distance: 100 }, { id: nodeAttributesClose2.id, distance: 500 }]);
        mockTableFrom.mockResolvedValueOnce({ query: '', durations: [150, 550], distances: [120, 512] });

        const transferableNodes = await TransferableNodeUtils.getTransferableNodes(refNode, nodeCollection);
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(refNode.getId(), distanceMeters);
        expect(mockTableFrom).toHaveBeenCalledWith({
            mode: 'walking',
            origin: refNode.toGeojson(),
            destinations: [nodeCollection.getById(nodeAttributesClose1.id), nodeCollection.getById(nodeAttributesClose2.id)]
        });
        expect(transferableNodes).toEqual({
            nodesIds: [refNode.getId(), nodeAttributesClose1.id, nodeAttributesClose2.id],
            walkingTravelTimesSeconds: [0, 150, 550],
            walkingDistancesMeters: [0, 120, 512]
        });
        
    });

    test('With some accessible nodes, but too far from network, or too long', async() => {
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([{ id: nodeAttributesClose1.id, distance: 100 }, { id: nodeAttributesClose2.id, distance: 500 }, { id: nodeAttributesFar.id, distance: 1000 }]);
        // Node2 gives too short distances
        mockTableFrom.mockResolvedValueOnce({ query: '', durations: [150, 120, travelTimeSeconds + 10], distances: [120, 100, 1100] });

        const transferableNodes = await TransferableNodeUtils.getTransferableNodes(refNode, nodeCollection);
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(refNode.getId(), distanceMeters);
        expect(mockTableFrom).toHaveBeenCalledWith({
            mode: 'walking',
            origin: refNode.toGeojson(),
            destinations: [nodeCollection.getById(nodeAttributesClose1.id), nodeCollection.getById(nodeAttributesClose2.id), nodeCollection.getById(nodeAttributesFar.id)]
        });
        expect(transferableNodes).toEqual({
            nodesIds: [refNode.getId(), nodeAttributesClose1.id],
            walkingTravelTimesSeconds: [0, 150],
            walkingDistancesMeters: [0, 120]
        });
        
    });

    test('No other node within distance', async() => {
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([]);
        const transferableNodes = await TransferableNodeUtils.getTransferableNodes(refNode, nodeCollection);
        expect(transferableNodes).toEqual({
            nodesIds: [refNode.getId()],
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        });
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(refNode.getId(), distanceMeters);
        expect(mockTableFrom).not.toHaveBeenCalled();
    });

    test('Requesting nodes by bird radius', async() => {
        Preferences.set('transit.nodes.useBirdDistanceForTransferableNodes', true);
        mockedGetNodesInBirdDistance.mockResolvedValueOnce([{ id: nodeAttributesClose1.id, distance: 100 }, { id: nodeAttributesClose2.id, distance: 500 }]);
        const transferableNodes = await TransferableNodeUtils.getTransferableNodes(refNode, nodeCollection);
        expect(transferableNodes).toEqual({
            nodesIds: [refNode.getId(), nodeAttributesClose1.id, nodeAttributesClose2.id],
            walkingTravelTimesSeconds: [0, 100 / defaultSpeedMps, 500 / defaultSpeedMps],
            walkingDistancesMeters: [0, 100, 500]
        });
        expect(mockedGetNodesInBirdDistance).toHaveBeenCalledWith(refNode.getId(), distanceMeters);
        expect(mockTableFrom).not.toHaveBeenCalled();
    });

    test('With error', async() => {
        // Let the database query throw an error
        mockedGetNodesInBirdDistance.mockRejectedValueOnce('database error');
        const transferableNodes = await TransferableNodeUtils.getTransferableNodes(refNode, nodeCollection);
        expect(transferableNodes).toEqual({
            nodesIds: [refNode.getId()],
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        });
        expect(mockTableFrom).not.toHaveBeenCalled();
    });

});

describe('getTransferableNodesWithAffected', () => {

    test('With transferable nodes', async() => {
        const node = nodeCollection.newObject(referenceNodeGeojson);
        const nodesInBirdRadius = [ 
            { id: nodeAttributesClose1.id, distance: 300 }, 
            { id: nodeAttributesClose2.id, distance: 700 }
        ];
        mockedGetNodesInBirdDistance.mockResolvedValueOnce(nodesInBirdRadius);
        mockTableFrom.mockResolvedValue({
            query: '',
            durations: [120, 240],
            distances: [400, 900]
        });
        // Make the 2 tables asymetric, to better see the results
        mockTableTo.mockResolvedValue({
            query: '',
            durations: [130, 300],
            distances: [410, 910]
        });
    
        const transferableNodes = await TransferableNodeUtils.getTransferableNodesWithAffected(node, nodeCollection, nodesInBirdRadius);
        expect(transferableNodes).toBeDefined();
        expect((transferableNodes as any).from).toEqual({
            nodesIds: [ referenceNodeGeojson.properties.id, nodeClose1Geojson.properties.id, nodeClose2Geojson.properties.id ],
            walkingDistancesMeters: [ 0, 400, 900 ],
            walkingTravelTimesSeconds: [0, 120, 240 ]
        });
    
        // Make sure the table from was called with the expected parameters
        expect(mockTableFrom).toHaveBeenCalledTimes(1);
        expect(mockTableFrom).toHaveBeenCalledWith({ mode: 'walking', origin: node.toGeojson(), destinations: [ nodeClose1Geojson, nodeClose2Geojson ] });

        // Make sure the table from was called with the expected parameters
        expect(mockTableTo).toHaveBeenCalledTimes(1);
        expect(mockTableTo).toHaveBeenCalledWith({ mode: 'walking', destination: node.toGeojson(), origins: [ nodeClose1Geojson, nodeClose2Geojson ] });
        expect((transferableNodes as any).to).toEqual({
            nodesIds: [ nodeClose1Geojson.properties.id, nodeClose2Geojson.properties.id ],
            walkingDistancesMeters: [ 410, 910 ],
            walkingTravelTimesSeconds: [130, 300 ]
        });
    });
    
    test('updateTransferableNodes without transferable nodes', async() => {
        const nodeFar = nodeCollection.newObject(nodeFarGeojson);
        const nodesInBirdRadius = [];
        mockedGetNodesInBirdDistance.mockResolvedValueOnce(nodesInBirdRadius);
    
        const transferableNodes = await TransferableNodeUtils.getTransferableNodesWithAffected(nodeFar, nodeCollection, nodesInBirdRadius);
        expect(transferableNodes).toBeDefined();
        expect((transferableNodes as any).from).toEqual({
            nodesIds: [ nodeFarGeojson.properties.id ],
            walkingDistancesMeters: [ 0 ],
            walkingTravelTimesSeconds: [0 ]
        });
        expect((transferableNodes as any).to).toEqual({
            nodesIds: [ ],
            walkingDistancesMeters: [ ],
            walkingTravelTimesSeconds: [ ]
        });
    
    });
});
