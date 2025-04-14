/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Path from '../Path';
import PathCollection from '../PathCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const lineId = uuidV4();
const pathAttributes1 = {
    id: uuidV4(),
    name: 'Path1',
    direction: 'outbound' as const,
    line_id: lineId,
    nodes: [],
    segments: [],
    data: {
        variables: {},
        nodeTypes: [],
        waypoints: [],
        waypointTypes: []
    },
    geography: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.1, 45]] as [number, number][] },
    is_frozen: false,
    mode: 'bus'
};

const pathAttributes2= {
    id: uuidV4(),
    name: 'Path1',
    direction: 'inbound' as const,
    line_id: lineId,
    data: {
        nodeTypes: [],
        waypoints: [],
        waypointTypes: []
    },
    nodes: [],
    segments: [],
    geography: { type: 'LineString' as const, coordinates: [[-74, 46], [-74.001, 46.001]] as [number, number][] },
    is_enabled: true,
    is_frozen: true,
    mode: 'trolleybus'
};

const path1Geojson = {
    type: 'Feature' as const,
    geometry: pathAttributes1.geography,
    properties: pathAttributes1
}
const path2Geojson = {
    type: 'Feature' as const,
    geometry: pathAttributes2.geography,
    properties: pathAttributes2
}

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct path collection with or without geojson features', function() {

    const pathCollectionEmpty = new PathCollection([], {}, eventManager);
    const pathCollection2 = new PathCollection([path1Geojson], {}, eventManager);
    const pathCollection3 = new PathCollection([path1Geojson, path2Geojson], {}, eventManager);

    expect(pathCollectionEmpty.size()).toBe(0);
    expect(pathCollection2.size()).toBe(1);
    expect(pathCollection3.size()).toBe(2);

    expect(pathCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(pathCollection2.getFeatures()[0]).toMatchObject(path1Geojson);
    expect(pathCollection3.getFeatures()[1]).toMatchObject(path2Geojson);

    expect(pathCollectionEmpty.getById(pathAttributes1.id)).toBeUndefined();
    expect(pathCollection2.getById(pathAttributes1.id)).toMatchObject(path1Geojson);
    expect(pathCollection2.getById(pathAttributes2.id)).toBeUndefined();
    expect(pathCollection3.getById(pathAttributes2.id)).toMatchObject(path2Geojson);

    pathCollectionEmpty.add(path1Geojson);
    expect(pathCollectionEmpty.size()).toBe(1);
    expect(pathCollectionEmpty.getById(pathAttributes1.id)).toMatchObject(path1Geojson);
    pathCollectionEmpty.removeById(pathAttributes1.id);
    expect(pathCollectionEmpty.size()).toBe(0);
    expect(pathCollectionEmpty.getFeatures()[0]).toBeUndefined();

});

test('new path object', function() {

    const pathCollection = new PathCollection([path1Geojson], {}, eventManager);
    
    const path1 = pathCollection.newObject(path1Geojson, true);
    const path1Expected = new Path(pathAttributes1, true);
    expect(path1.attributes).toEqual(path1Expected.attributes);

});

test('path collection progress', () => {
    // Collection with event manager
    let pathCollection = new PathCollection([path1Geojson], {}, eventManager);
    pathCollection.progress('Test', 0);

    expect(eventManager.emitProgress).toHaveBeenCalledTimes(1);
    expect(eventManager.emitProgress).toHaveBeenCalledWith('PathCollectionTest', 0);

    // Collection without event manager
    pathCollection = new PathCollection([path1Geojson], {});
    pathCollection.progress('Test', 0);

    expect(eventManager.emitProgress).toHaveBeenCalledTimes(1);
});

test('update path feature', () => {

    const pathCollection = new PathCollection([path1Geojson], {}, eventManager);

    const newName = 'Path1Duplicate';
    const path1Duplicate = Object.assign({}, path1Geojson);
    path1Duplicate.properties.name = newName;
    pathCollection.updateFeature(path1Duplicate);
    expect(pathCollection.size()).toEqual(1);
    const path1 = pathCollection.getById(pathAttributes1.id);
    expect(path1 as any).toEqual(path1Duplicate);
    expect((path1 as any).properties.name).toEqual(newName);
});

test('Save path collection to cache', async () => {
    EventManagerMock.emitResponseReturnOnce({ status: 'ok' });

    // Test saving a collection
    const collection = new PathCollection([], {}, eventManager);
    await collection.saveCache(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitPaths.saveCollectionCache', undefined, undefined, expect.anything());

    await collection.saveCache(eventManager, [path1Geojson, path2Geojson]);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitPaths.saveCollectionCache', [path1Geojson, path2Geojson], undefined, expect.anything());
});

test('Load path collection from server', async () => {
    EventManagerMock.emitResponseReturnOnce(Status.createOk({ type: 'geojson', geojson: { type: 'FeatureCollection', features: [path1Geojson, path2Geojson] } }));

    // Test loading a simple collection
    const collection = new PathCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitPaths.geojsonCollection', { dataSourceIds: [], format: 'geobuf', sampleSize: undefined }, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const path1 = collection.getFeatures()[0];
    const path2 = collection.getFeatures()[1];
    expect(path1).toEqual(path1Geojson);
    expect(path2).toEqual(path2Geojson);

});

test('Load path collection from cache', async () => {
    EventManagerMock.emitResponseReturnOnce(new PathCollection([path1Geojson, path2Geojson], {}, eventManager));

    // Test loading a simple collection
    const collection = new PathCollection([], {}, eventManager);
    const response = await collection.loadCache(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitPaths.loadCollectionCache', undefined, expect.anything());
    expect(response.getFeatures().length).toEqual(2);
    const path1 = response.getFeatures()[0];
    const path2 = response.getFeatures()[1];
    expect(path1).toEqual(path1Geojson);
    expect(path2).toEqual(path2Geojson);

});

test('Load paths from collection', function() {

    const pathCollectionEmpty = new PathCollection([], {}, eventManager);
    const pathCollectionWithFeatures = new PathCollection([path1Geojson, path2Geojson], {}, eventManager);

    // Check the collection has been loaded
    pathCollectionEmpty.loadFromCollection(pathCollectionWithFeatures.getFeatures());
    expect(pathCollectionEmpty.size()).toBe(2);
    expect(pathCollectionEmpty.getFeatures()[0]).toMatchObject(path1Geojson);
    expect(pathCollectionEmpty.getFeatures()[1]).toMatchObject(path2Geojson);

    // Make sure original collection is unchanged
    expect(pathCollectionWithFeatures.size()).toBe(2);
    expect(pathCollectionWithFeatures.getFeatures()[0]).toMatchObject(path1Geojson);
    expect(pathCollectionWithFeatures.getFeatures()[1]).toMatchObject(path2Geojson);

});

test('static attributes', () => {
    const collection = new PathCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Paths');
    expect(collection.socketPrefix).toEqual('transitPaths');
    expect(collection.displayName).toEqual('PathCollection');
});

test('toGeojsonSimplified', () => {
    const pathCollection = new PathCollection([path1Geojson, path2Geojson], {}, eventManager);
    const simplified = pathCollection.toGeojsonSimplified();
    expect(simplified.type).toEqual('FeatureCollection');
    expect(simplified.features.length).toEqual(2);
    expect(simplified.features[0].properties).toEqual({
        mode: 'bus',
        color: undefined,
        id: pathAttributes1.id,
        line_id: lineId,
    });
    expect(simplified.features[1].properties).toEqual({
        mode: 'trolleybus',
        color: undefined,
        id: pathAttributes2.id,
        line_id: lineId,
    });
});
