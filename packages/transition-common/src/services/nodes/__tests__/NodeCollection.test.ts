/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Node, { NodeAttributes } from '../Node';
import NodeCollection from '../NodeCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TestUtils } from 'chaire-lib-common/lib/test';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const nodeAttributes1 = {
    id: uuidV4(),
    name: 'Node1',
    data: {
        variables: {}
    },
    geography: { type: 'Point' as const, coordinates: [-73, 45] as [number, number] },
    station_id: 'abdefg',
    code: 'nodeCode',
    is_enabled: true,
    routing_radius_meters: 20,
    default_dwell_time_seconds: 20,
    is_frozen: false
};

const nodeAttributes2= {
    id: uuidV4(),
    name: 'Node2',
    geography: { type: 'Point' as const, coordinates: [-74, 46] as [number, number] },
    station_id: 'abdefg',
    code: 'nodeCode2',
    is_enabled: true,
    is_frozen: true
};

const node1Geojson = TestUtils.makePoint(nodeAttributes1.geography.coordinates, nodeAttributes1) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
const node2Geojson = TestUtils.makePoint(nodeAttributes2.geography.coordinates, nodeAttributes2) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct node collection with or without geojson features', function() {

    const nodeCollectionEmpty = new NodeCollection([], {}, eventManager);
    const nodeCollection2 = new NodeCollection([node1Geojson], {}, eventManager);
    const nodeCollection3 = new NodeCollection([node1Geojson, node2Geojson], {}, eventManager);

    expect(nodeCollectionEmpty.size()).toBe(0);
    expect(nodeCollection2.size()).toBe(1);
    expect(nodeCollection3.size()).toBe(2);

    expect(nodeCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(nodeCollection2.getFeatures()[0]).toMatchObject(node1Geojson);
    expect(nodeCollection3.getFeatures()[1]).toMatchObject(node2Geojson);

    expect(nodeCollectionEmpty.getById(nodeAttributes1.id)).toBeUndefined();
    expect(nodeCollection2.getById(nodeAttributes1.id)).toMatchObject(node1Geojson);
    expect(nodeCollection2.getById(nodeAttributes2.id)).toBeUndefined();
    expect(nodeCollection3.getById(nodeAttributes2.id)).toMatchObject(node2Geojson);

    nodeCollectionEmpty.add(node1Geojson);
    expect(nodeCollectionEmpty.size()).toBe(1);
    expect(nodeCollectionEmpty.getById(nodeAttributes1.id)).toMatchObject(node1Geojson);
    nodeCollectionEmpty.removeById(nodeAttributes1.id);
    expect(nodeCollectionEmpty.size()).toBe(0);
    expect(nodeCollectionEmpty.getFeatures()[0]).toBeUndefined();

});

test('new node object', function() {

    const nodeCollection = new NodeCollection([node1Geojson], {}, eventManager);
    
    const node1 = nodeCollection.newObject(node1Geojson, true);
    const node1Expected = new Node(nodeAttributes1, true);
    expect(node1.attributes).toEqual(node1Expected.attributes);

});

test('update node feature', () => {

    const nodeCollection = new NodeCollection([node1Geojson], {}, eventManager);

    const newName = 'Node1Duplicate';
    const node1Duplicate = Object.assign({}, node1Geojson);
    node1Duplicate.properties.name = newName;
    nodeCollection.updateFeature(node1Duplicate);
    expect(nodeCollection.size()).toEqual(1);
    const node1 = nodeCollection.getById(nodeAttributes1.id);
    expect(node1 as any).toEqual(node1Duplicate);
    expect((node1 as any).properties.name).toEqual(newName);
});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({geojson: { type: 'FeatureCollection', features: [node1Geojson, node2Geojson] } });

    // Test loading a simple collection
    const collection = new NodeCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitNodes.geojsonCollection', { dataSourceIds: [], format: 'geobuf', sampleSize: undefined }, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const node1 = collection.getFeatures()[0];
    const node2 = collection.getFeatures()[1];
    expect(node1).toEqual(node1Geojson);
    expect(node2).toEqual(node2Geojson);

});

test('static attributes', () => {
    const collection = new NodeCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Nodes');
    expect(collection.socketPrefix).toEqual('transitNodes');
    expect(collection.displayName).toEqual('NodeCollection');
});
