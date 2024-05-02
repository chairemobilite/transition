/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { TestUtils, RoutingServiceManagerMock } from 'chaire-lib-common/lib/test';
import TransitNode, { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import { v4 as uuidV4 } from 'uuid';
import * as TransferableNodeUtils from '../TransferableNodeUtils';
import * as NodeCollectionUtils from '../NodeCollectionUtils';
import transitNodesDbQueries from '../../../models/db/transitNodes.db.queries';
import transferableNodesDbQueries from '../../../models/db/transitNodeTransferable.db.queries';
import { objectToCache } from '../../../models/capnpCache/transitNodes.cache.queries';
import { saveNode } from '../TransitNode';

const mockTableFrom = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableFrom;
const mockTableTo = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableTo;

jest.mock('../../../models/db/transitNodes.db.queries', () => ({
    exists: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockImplementation((id) => id),
    create: jest.fn().mockImplementation(attribs => attribs.id ? attribs.id : uuidV4()),
    geojsonCollection: jest.fn()
}));
const mockNodeExists = transitNodesDbQueries.exists as jest.MockedFunction<typeof transitNodesDbQueries.exists>;
const mockNodeUpdate = transitNodesDbQueries.update as jest.MockedFunction<typeof transitNodesDbQueries.update>;
const mockNodeCreate = transitNodesDbQueries.create as jest.MockedFunction<typeof transitNodesDbQueries.create>;
const mockNodeCollection = transitNodesDbQueries.geojsonCollection as jest.MockedFunction<typeof transitNodesDbQueries.geojsonCollection>;

jest.mock('../../../models/db/transitNodeTransferable.db.queries', () => ({
    getToNode: jest.fn().mockResolvedValue([]),
    saveForNode: jest.fn(),
    getFromNode: jest.fn().mockImplementation(nodeId => ({
        nodesIds: [nodeId],
        walkingTravelTimesSeconds: [0],
        walkingDistancesMeters: [0]
    }))
}));
const mockGetToNode = transferableNodesDbQueries.getToNode as jest.MockedFunction<typeof transferableNodesDbQueries.getToNode>;
const mockGetForNode = transferableNodesDbQueries.getFromNode as jest.MockedFunction<typeof transferableNodesDbQueries.getFromNode>;
const mockSaveForNode = transferableNodesDbQueries.saveForNode as jest.MockedFunction<typeof transferableNodesDbQueries.saveForNode>;

jest.mock('../TransferableNodeUtils', () => ({
    getTransferableNodesWithAffected: jest.fn(),
    getDefaultTransferableNodeDistance: jest.fn().mockReturnValue(1000)
}));
const mockGetTNodeWithAffected = TransferableNodeUtils.getTransferableNodesWithAffected as jest.MockedFunction<typeof TransferableNodeUtils.getTransferableNodesWithAffected>;

jest.mock('../NodeCollectionUtils', () => ({
    getNodesInBirdDistance: jest.fn().mockResolvedValue([]),
}));
const mockGetNodesInBirdDistance = NodeCollectionUtils.getNodesInBirdDistance as jest.MockedFunction<typeof NodeCollectionUtils.getNodesInBirdDistance>;

jest.mock('../../../models/capnpCache/transitNodes.cache.queries', () => ({
    objectToCache: jest.fn()
}));
const mockObjectToCache = objectToCache as jest.MockedFunction<typeof objectToCache>;


const commonProperties = {
    is_enabled: true,
    routing_radius_meters: 20,
    default_dwell_time_seconds: 20,
    is_frozen: false,
    data: { }
}

// 4 nodes: 3 within 1km distance, one beyond

const nodeAttributes1 = {
    id: uuidV4(),
    integer_id: 1,
    name: 'Node1',
    geography: { type: 'Point' as const, coordinates: [-73.625081, 45.5372043] as [number, number] },
    code: 'nodeCode',
    ...commonProperties
};

const nodeAttributes2 = {
    id: uuidV4(),
    integer_id: 2,
    name: 'Node2',
    geography: { type: 'Point' as const, coordinates: [-73.62407, 45.53891] as [number, number] },
    code: 'nodeCode2',
    ...commonProperties
};

const nodeAttributes3 = {
    id: uuidV4(),
    integer_id: 3,
    name: 'Node3',
    geography: { type: 'Point' as const, coordinates: [-73.62024, 45.53782] as [number, number] },
    code: 'nodeCode3',
    ...commonProperties
};

const nodeAttributes4 = {
    id: uuidV4(),
    integer_id: 4,
    name: 'Node4',
    geography: { type: 'Point' as const, coordinates: [-73.61251, 45.52475] as [number, number] },
    code: 'nodeCode4',
    ...commonProperties
};

const node1Geojson = TestUtils.makePoint(nodeAttributes1.geography.coordinates, nodeAttributes1) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const node2Geojson = TestUtils.makePoint(nodeAttributes2.geography.coordinates, nodeAttributes2) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const node3Geojson = TestUtils.makePoint(nodeAttributes3.geography.coordinates, nodeAttributes3) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const node4Geojson = TestUtils.makePoint(nodeAttributes4.geography.coordinates, nodeAttributes4) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
mockNodeCollection.mockImplementation(async (params) => ({
    type: 'FeatureCollection',
    features: params?.nodeIds ? params.nodeIds.map(nid => nid === nodeAttributes1.id ? node1Geojson : nid === nodeAttributes2.id ? node2Geojson : nid === nodeAttributes3.id ? node3Geojson : node4Geojson) : []
}));

beforeEach(() => {
    mockTableFrom.mockClear();
    mockTableTo.mockClear();
    mockGetNodesInBirdDistance.mockClear();
    mockGetForNode.mockClear();
    mockObjectToCache.mockClear();
    mockNodeCollection.mockClear();
    mockSaveForNode.mockClear();
    mockNodeCreate.mockClear();
    mockNodeUpdate.mockClear();
});

describe('save node', () => {

    test('updated node, no geography changed', async () => {
        // Prepare test data
        const testNode = new TransitNode(_cloneDeep(nodeAttributes1), false);
        testNode.setData('transferableNodes', {
            nodesIds: [nodeAttributes1.id],
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        });

        // Call the save method
        const nbNodeAffected = await saveNode(nodeAttributes1, false);

        // Test the calls and save calls
        expect(nbNodeAffected).toEqual(1);
        expect(mockNodeUpdate).toHaveBeenCalledTimes(1);
        expect(mockNodeUpdate).toHaveBeenCalledWith(nodeAttributes1.id, nodeAttributes1);
        expect(mockNodeCreate).not.toHaveBeenCalled();
        expect(mockGetForNode).toHaveBeenCalledTimes(1);
        expect(mockGetForNode).toHaveBeenCalledWith(nodeAttributes1.id);
        expect(mockNodeCollection).toHaveBeenCalledTimes(1);
        expect(mockNodeCollection).toHaveBeenCalledWith({ nodeIds: [nodeAttributes1.id]});
        expect(mockObjectToCache).toHaveBeenCalledTimes(1);
        expect(mockObjectToCache.mock.calls[0][0].attributes).toEqual(testNode.attributes);
    });

    test('new node, geography changed', async () => {
        // Prepare the test data
        // new geography
        mockNodeExists.mockResolvedValueOnce(false);
        const transferableNodes = {
            nodesIds: [nodeAttributes1.id, nodeAttributes2.id, nodeAttributes3.id],
            walkingTravelTimesSeconds: [0, 200, 400],
            walkingDistancesMeters: [0, 250, 450]
        }
        const transferableNodesTo = {
            nodesIds: [nodeAttributes2.id, nodeAttributes3.id],
            walkingTravelTimesSeconds: [210, 410],
            walkingDistancesMeters: [260, 460]
        };
        const testNode = new TransitNode(_cloneDeep(nodeAttributes1), false);
        mockGetForNode.mockResolvedValueOnce(transferableNodes);
        mockGetForNode.mockResolvedValue({
            nodesIds: [nodeAttributes2.id],
            walkingTravelTimesSeconds: [210],
            walkingDistancesMeters: [260]
        });
        mockGetForNode.mockResolvedValue({
            nodesIds: [nodeAttributes3.id],
            walkingTravelTimesSeconds: [410],
            walkingDistancesMeters: [460]
        });

        // Has transferable nodes
        testNode.setData('transferableNodes', transferableNodes);
        // New node, so no nodes transferred to it
        mockGetToNode.mockResolvedValueOnce([]);
        mockGetNodesInBirdDistance.mockResolvedValueOnce([{ id: nodeAttributes2.id, distance: 225 }, { id: nodeAttributes3.id, distance: 425 }])
        mockGetTNodeWithAffected.mockResolvedValueOnce({ from: transferableNodes, to: transferableNodesTo})

        // Call the save method
        const nbNodeAffected = await saveNode(nodeAttributes1, true);

        // Test the calls to update transferable nodes
        expect(nbNodeAffected).toEqual(3);
        expect(mockNodeCreate).toHaveBeenCalledTimes(1);
        expect(mockNodeCreate).toHaveBeenCalledWith(nodeAttributes1);
        expect(mockNodeUpdate).not.toHaveBeenCalled();
        expect(mockSaveForNode).toHaveBeenCalledTimes(1);
        expect(mockSaveForNode).toHaveBeenCalledWith(nodeAttributes1.id, transferableNodes, transferableNodesTo);
        expect(mockGetNodesInBirdDistance).toHaveBeenCalledWith(nodeAttributes1.id, 1000);

        // Calls for saving the object
        expect(mockGetForNode).toHaveBeenCalledTimes(3);
        expect(mockGetForNode).toHaveBeenCalledWith(nodeAttributes1.id);
        expect(mockNodeCollection).toHaveBeenCalledTimes(2);
        expect(mockNodeCollection).toHaveBeenCalledWith({ nodeIds: [nodeAttributes1.id, nodeAttributes2.id, nodeAttributes3.id]});
        expect(mockObjectToCache).toHaveBeenCalledTimes(3);
        expect(mockObjectToCache.mock.calls[0][0].attributes).toEqual(testNode.attributes);
    });

    test('updated node, geography changed, no previous transferable nodes', async () => {
        
        // Prepare the test data
        // new geography
        const transferableNodes = {
            nodesIds: [nodeAttributes1.id, nodeAttributes2.id, nodeAttributes3.id],
            walkingTravelTimesSeconds: [0, 200, 400],
            walkingDistancesMeters: [0, 250, 450]
        }
        const transferableNodesTo = {
            nodesIds: [nodeAttributes2.id, nodeAttributes3.id],
            walkingTravelTimesSeconds: [210, 410],
            walkingDistancesMeters: [260, 460]
        };
        const testNode = new TransitNode(_cloneDeep(nodeAttributes1), false);
        mockGetForNode.mockResolvedValueOnce(transferableNodes);
        mockGetForNode.mockResolvedValue({
            nodesIds: [nodeAttributes2.id],
            walkingTravelTimesSeconds: [210],
            walkingDistancesMeters: [260]
        });
        mockGetForNode.mockResolvedValue({
            nodesIds: [nodeAttributes3.id, nodeAttributes4.id],
            walkingTravelTimesSeconds: [410, 510],
            walkingDistancesMeters: [460, 560]
        });

        // Has transferable nodes
        testNode.setData('transferableNodes', transferableNodes);
        // The node had no previous transferable nodes
        mockGetToNode.mockResolvedValueOnce([]);
        mockGetNodesInBirdDistance.mockResolvedValueOnce([{ id: nodeAttributes2.id, distance: 225 }, { id: nodeAttributes3.id, distance: 425 }])
        mockGetTNodeWithAffected.mockResolvedValueOnce({ from: transferableNodes, to: transferableNodesTo})

        // Call the save method
        const nbNodeAffected = await saveNode(nodeAttributes1, true);

        // Test the calls to update transferable nodes
        expect(nbNodeAffected).toEqual(3);
        expect(mockNodeUpdate).toHaveBeenCalledTimes(1);
        expect(mockNodeUpdate).toHaveBeenCalledWith(nodeAttributes1.id, nodeAttributes1);
        expect(mockNodeCreate).not.toHaveBeenCalled();
        expect(mockSaveForNode).toHaveBeenCalledTimes(1);
        expect(mockSaveForNode).toHaveBeenCalledWith(nodeAttributes1.id, transferableNodes, transferableNodesTo);
        expect(mockGetNodesInBirdDistance).toHaveBeenCalledWith(nodeAttributes1.id, 1000);

        // Calls for saving the object
        expect(mockGetForNode).toHaveBeenCalledTimes(3);
        expect(mockGetForNode).toHaveBeenCalledWith(nodeAttributes1.id);
        expect(mockNodeCollection).toHaveBeenCalledTimes(2);
        expect(mockNodeCollection).toHaveBeenCalledWith({ nodeIds: [nodeAttributes1.id, nodeAttributes2.id, nodeAttributes3.id]});
        expect(mockObjectToCache).toHaveBeenCalledTimes(3);
        expect(mockObjectToCache.mock.calls[0][0].attributes).toEqual(testNode.attributes);
    });

    test('updated node, geography changed, with previous transferable nodes', async () => {
        // Prepare the test data
        // new geography
        const transferableNodes = {
            nodesIds: [nodeAttributes1.id, nodeAttributes2.id, nodeAttributes3.id],
            walkingTravelTimesSeconds: [0, 200, 400],
            walkingDistancesMeters: [0, 250, 450]
        }
        const transferableNodesTo = {
            nodesIds: [nodeAttributes2.id, nodeAttributes3.id],
            walkingTravelTimesSeconds: [210, 410],
            walkingDistancesMeters: [260, 460]
        };
        const testNode = new TransitNode(_cloneDeep(nodeAttributes1), false);
        mockGetForNode.mockResolvedValueOnce(transferableNodes);
        mockGetForNode.mockResolvedValue({
            nodesIds: [nodeAttributes2.id],
            walkingTravelTimesSeconds: [210],
            walkingDistancesMeters: [260]
        });
        mockGetForNode.mockResolvedValue({
            nodesIds: [nodeAttributes3.id, nodeAttributes4.id],
            walkingTravelTimesSeconds: [410, 510],
            walkingDistancesMeters: [460, 560]
        });

        // Has transferable nodes
        testNode.setData('transferableNodes', transferableNodes);
        // The node had no some transferable nodes, one of which is still transferable, the other not
        mockGetToNode.mockResolvedValueOnce([nodeAttributes4.id, nodeAttributes2.id]);
        mockGetNodesInBirdDistance.mockResolvedValueOnce([{ id: nodeAttributes2.id, distance: 225 }, { id: nodeAttributes3.id, distance: 425 }])
        mockGetTNodeWithAffected.mockResolvedValueOnce({ from: transferableNodes, to: transferableNodesTo})

        // Call the save method
        const nbNodeAffected = await saveNode(nodeAttributes1, true);

        // Test the calls to update transferable nodes
        expect(nbNodeAffected).toEqual(4);
        expect(mockNodeUpdate).toHaveBeenCalledTimes(1);
        expect(mockNodeUpdate).toHaveBeenCalledWith(nodeAttributes1.id, nodeAttributes1);
        expect(mockNodeCreate).not.toHaveBeenCalled();
        expect(mockSaveForNode).toHaveBeenCalledTimes(1);
        expect(mockSaveForNode).toHaveBeenCalledWith(nodeAttributes1.id, transferableNodes, transferableNodesTo);
        expect(mockGetNodesInBirdDistance).toHaveBeenCalledWith(nodeAttributes1.id, 1000);

        // Calls for saving the object
        expect(mockGetForNode).toHaveBeenCalledTimes(4);
        expect(mockGetForNode).toHaveBeenCalledWith(nodeAttributes1.id);
        expect(mockNodeCollection).toHaveBeenCalledTimes(2);
        expect(mockNodeCollection).toHaveBeenCalledWith({ nodeIds: [nodeAttributes1.id, nodeAttributes4.id, nodeAttributes2.id, nodeAttributes3.id]});
        expect(mockObjectToCache).toHaveBeenCalledTimes(4);
        expect(mockObjectToCache.mock.calls[0][0].attributes).toEqual(testNode.attributes);
    }); 
});
