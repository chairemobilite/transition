/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventManagerMock, TestUtils, RoutingServiceManagerMock } from 'chaire-lib-common/lib/test';
import events from 'events';
import { v4 as uuidV4 } from 'uuid';
import { NodeAttributes } from '../Node';
import NodeCollection from '../NodeCollection';
import NodeGeographyUtils from '../NodeGeographyUtils';

const eventEmitter = new events.EventEmitter();
const eventManager = EventManagerMock.eventManagerMock;
const mockTableFrom = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableFrom;

const commonProperties = {
    is_enabled: true,
    routing_radius_meters: 20,
    default_dwell_time_seconds: 20,
    is_frozen: false,
    data: { }
}

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
})

test('nodesInWalkingTravelTimeRadiusSeconds with transferable nodes', async() => {
    const nodeOrig = Object.assign({}, nodeClose1Geojson);
    const node = nodeCollection.newObject(nodeClose1Geojson);
    mockTableFrom.mockResolvedValue({
        query: '',
        durations: [120, 240],
        distances: [200, 400]
    });

    let nodesInRoutedRadius = await NodeGeographyUtils.nodesInWalkingTravelTimeRadiusSeconds(node, nodeCollection, 300);
    // Make sure the object was not changed
    expect(node).toEqual(nodeCollection.newObject(nodeOrig));
    expect(nodesInRoutedRadius).toEqual({
        nodesIds: [ nodeClose1Geojson.properties.id, nodeClose2Geojson.properties.id, nodeClose3Geojson.properties.id ],
        walkingDistancesMeters: [ 0, 200, 400 ],
        walkingTravelTimesSeconds: [0, 120, 240 ]
    });

    // Make sure the table from was called with the expected parameters
    expect(mockTableFrom).toHaveBeenCalledTimes(1);
    expect(mockTableFrom).toHaveBeenCalledWith({ mode: 'walking', origin: node.toGeojson(), destinations: [ nodeClose2Geojson, nodeClose3Geojson ] });
    
    // Make a second call, but with a shorter travel time
    nodesInRoutedRadius = await NodeGeographyUtils.nodesInWalkingTravelTimeRadiusSeconds(node, nodeCollection, 150);
    // Make sure the object was not changed
    expect(node).toEqual(nodeCollection.newObject(nodeOrig));
    expect(nodesInRoutedRadius).toEqual({
        nodesIds: [ nodeClose1Geojson.properties.id, nodeClose2Geojson.properties.id ],
        walkingDistancesMeters: [ 0, 200 ],
        walkingTravelTimesSeconds: [0, 120 ]
    });

});

test('nodesInWalkingTravelTimeRadiusSeconds without transferable node', async() => {
    // Call for a node that has no node in the distance
    const nodeFar = nodeCollection.newObject(nodeFarGeojson);
    const nodesInRoutedRadius = await NodeGeographyUtils.nodesInWalkingTravelTimeRadiusSeconds(nodeFar, nodeCollection, 150);
    // Make sure the object was not changed
    expect(nodesInRoutedRadius).toEqual({
        nodesIds: [ nodeFarGeojson.properties.id ],
        walkingDistancesMeters: [ 0 ],
        walkingTravelTimesSeconds: [0 ]
    });
    expect(mockTableFrom).not.toHaveBeenCalled();
});

test('updateTransferableNodes with transferable nodes', async() => {
    const node = nodeCollection.newObject(nodeClose1Geojson);
    mockTableFrom.mockResolvedValue({
        query: '',
        durations: [120, 240],
        distances: [200, 400]
    });

    await NodeGeographyUtils.updateTransferableNodes(node, nodeCollection);
    expect(node.getAttributes().data.transferableNodes).toEqual({
        nodesIds: [ nodeClose1Geojson.properties.id, nodeClose2Geojson.properties.id, nodeClose3Geojson.properties.id ],
        walkingDistancesMeters: [ 0, 200, 400 ],
        walkingTravelTimesSeconds: [0, 120, 240 ]
    });

    // Make sure the table from was called with the expected parameters
    expect(mockTableFrom).toHaveBeenCalledTimes(1);
    expect(mockTableFrom).toHaveBeenCalledWith({ mode: 'walking', origin: node.toGeojson(), destinations: [ nodeClose2Geojson, nodeClose3Geojson ] });

});

test('updateTransferableNodes without transferable nodes', async() => {
    const nodeFar = nodeCollection.newObject(nodeFarGeojson);

    await NodeGeographyUtils.updateTransferableNodes(nodeFar, nodeCollection);
    expect(nodeFar.getAttributes().data.transferableNodes).toEqual({
        nodesIds: [ nodeFarGeojson.properties.id ],
        walkingDistancesMeters: [ 0 ],
        walkingTravelTimesSeconds: [0 ]
    });

});

test('updateTransferableNodes and all affected nodes', async() => {
    // Make the current transferable nodes contain the far node
    const node = nodeCollection.newObject(nodeClose1Geojson);
    node.startEditing();
    node.getAttributes().data.transferableNodes = { 
        nodesIds: [ nodeClose1Geojson.properties.id, nodeFarGeojson.properties.id ],
        walkingDistancesMeters: [ 0, 400 ],
        walkingTravelTimesSeconds: [ 0, 180 ]
    };
    nodeFarGeojson.properties.data.transferableNodes = { 
        nodesIds: [ nodeFarGeojson.properties.id, nodeClose1Geojson.properties.id ],
        walkingDistancesMeters: [ 0, 400 ],
        walkingTravelTimesSeconds: [ 0, 180 ]
    };

    // Mock the table from replies
    const tableFromClose1 = {
        query: '',
        durations: [120, 240],
        distances: [200, 400]
    };
    const tableFromClose2 = {
        query: '',
        durations: [120, 140],
        distances: [200, 250]
    }
    const tableFromClose3 = {
        query: '',
        durations: [120, 240],
        distances: [180, 360]
    }
    mockTableFrom.mockImplementation(async (params) => {
        if (params.origin.geometry.coordinates[0] === nodeClose1Geojson.geometry.coordinates[0]
            && params.origin.geometry.coordinates[1] === nodeClose1Geojson.geometry.coordinates[1]) {
            return tableFromClose1;
        } else if (params.origin.geometry.coordinates[0] === nodeClose2Geojson.geometry.coordinates[0]
            && params.origin.geometry.coordinates[1] === nodeClose2Geojson.geometry.coordinates[1]) {
            return tableFromClose2;
        } else if (params.origin.geometry.coordinates[0] === nodeClose3Geojson.geometry.coordinates[0]
            && params.origin.geometry.coordinates[1] === nodeClose3Geojson.geometry.coordinates[1]) {
            return tableFromClose3;
        } else {
            return { query: '', durations: [], distances: [] };
        }
    })

    const modifiedNodes = await NodeGeographyUtils.updateTransferableNodesWithAffected(node, nodeCollection);
    expect(modifiedNodes.length).toEqual(3);

    // Make sure the node in the collection were affected
    for (let i = 0; i < modifiedNodes.length; i++) {
        const modifiedNode = modifiedNodes[1];
        const modifiedNodeCoords = modifiedNode.getAttributes().geography.coordinates;
        if (modifiedNodeCoords[0] === nodeClose2Geojson.geometry.coordinates[0]
            && modifiedNodeCoords[1] === nodeClose2Geojson.geometry.coordinates[1]) {
            expect(modifiedNode.getAttributes().data.transferableNodes).toEqual({
                nodesIds: [ nodeClose2Geojson.properties.id, nodeClose1Geojson.properties.id, nodeClose3Geojson.properties.id ],
                walkingDistancesMeters: [ 0, tableFromClose2.distances[0], tableFromClose2.distances[1] ],
                walkingTravelTimesSeconds: [ 0, tableFromClose2.durations[0], tableFromClose2.durations[1] ]
            });
        } else if (modifiedNodeCoords[0] === nodeClose3Geojson.geometry.coordinates[0]
            && modifiedNodeCoords[1] === nodeClose3Geojson.geometry.coordinates[1]) {
            expect(modifiedNode.getAttributes().data.transferableNodes).toEqual({
                nodesIds: [ nodeClose3Geojson.properties.id, nodeClose2Geojson.properties.id, nodeClose1Geojson.properties.id ],
                walkingDistancesMeters: [ 0, tableFromClose3.distances[0], tableFromClose3.distances[1] ],
                walkingTravelTimesSeconds: [ 0, tableFromClose3.durations[0], tableFromClose3.durations[1] ]
            });
        } else if (modifiedNodeCoords[0] === nodeFarGeojson.geometry.coordinates[0]
            && modifiedNodeCoords[1] === nodeFarGeojson.geometry.coordinates[1]) {
            expect(modifiedNode.getAttributes().data.transferableNodes).toEqual({
                nodesIds: [ nodeFarGeojson.properties.id ],
                walkingDistancesMeters: [ 0 ],
                walkingTravelTimesSeconds: [ 0 ]
            });
        } else {
            throw 'Invalid node was updated';
        }
    }
    
});