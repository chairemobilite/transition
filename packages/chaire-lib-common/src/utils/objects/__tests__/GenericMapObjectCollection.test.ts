/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import { GenericPlace, GenericPlaceAttributes } from '../GenericPlace';
import GenericMapObjectCollection from '../GenericMapObjectCollection';
import CollectionManager from '../CollectionManager';
import EventManager from '../../../services/events/EventManager';
import TestUtils from '../../../test/TestUtils';
import { Feature, Point } from 'geojson';

const collectionManager = new CollectionManager(new EventManager());
const point1 = TestUtils.makePoint([-73, 45]);
const point2 = TestUtils.makePoint([-73.1, 45.09]);
const point3 = TestUtils.makePoint([-73.11, 45.034]);
const point4 = TestUtils.makePoint([-73.2, 45.2]);
const genericPlace1: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point1.geometry, id: uuidV4(), integer_id: 1 }, false, collectionManager);
const genericPlace2: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point2.geometry, id: uuidV4(), integer_id: 2 }, false, collectionManager);
const genericPlace3: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point3.geometry, id: uuidV4(), integer_id: 3 }, false, collectionManager);
const genericPlace4: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point4.geometry, id: uuidV4(), integer_id: 4 }, false, collectionManager);

class GenericMapCollectionStub extends GenericMapObjectCollection<GeoJSON.Point, GenericPlaceAttributes, GenericPlace<GenericPlaceAttributes>> {
    newObject(attribs: Feature<Point, GenericPlaceAttributes>, isNew = false): GenericPlace<GenericPlaceAttributes> {
        return new GenericPlace(attribs.properties, isNew);
    }
}
let mapCollection: GenericMapCollectionStub;

beforeEach(() => {
    mapCollection = new GenericMapCollectionStub([genericPlace1.toGeojson(), genericPlace2.toGeojson(), genericPlace3.toGeojson()]);
})

test('Get by id', () => {
    let feature = mapCollection.getById(genericPlace1.attributes.id);
    expect(feature).toBeDefined();
    expect(feature).toEqual(genericPlace1.toGeojson());

    // Unknown id
    feature = mapCollection.getById('abdef');
    expect(feature).not.toBeDefined();
});

test('Get by integer id', () => {
    let id = mapCollection.getIdByIntegerId(genericPlace1.attributes.integer_id as number);
    expect(id).toBeDefined();
    expect(id).toEqual(genericPlace1.attributes.id);

    // Unknown id
    id = mapCollection.getIdByIntegerId(1000);
    expect(id).not.toBeDefined();
});

test('Update feature or object by ID', () => {

    // Add a field to the genericPlace1 object
    let newName = 'Has a name now';
    genericPlace1.attributes.name = newName;

    mapCollection.updateById(genericPlace1.getId(), genericPlace1);
    expect(mapCollection.getFeatures().length).toEqual(3);
    let feature = mapCollection.getById(genericPlace1.attributes.id);
    expect(feature).toBeDefined();
    expect((feature as any).properties.name).toEqual(newName);

    // Modify the name of the geojson object and update
    newName = 'New name';
    const place1Geojson = genericPlace1.toGeojson();
    place1Geojson.properties.name = newName;
    mapCollection.updateById(genericPlace1.getId(), place1Geojson);
    expect(mapCollection.getFeatures().length).toEqual(3);
    feature = mapCollection.getById(genericPlace1.attributes.id);
    expect(feature).toBeDefined();
    expect((feature as any).properties.name).toEqual(newName);

});

test('Update feature or object', () => {

    // Add a field to the genericPlace1 object
    let newName = 'Has a name now';
    genericPlace1.attributes.name = newName;

    mapCollection.updateFeature(genericPlace1);
    expect(mapCollection.getFeatures().length).toEqual(3);
    let feature = mapCollection.getById(genericPlace1.attributes.id);
    expect(feature).toBeDefined();
    expect((feature as any).properties.name).toEqual(newName);

    // Modify the name of the geojson object and update
    newName = 'New name';
    const place1Geojson = genericPlace1.toGeojson();
    place1Geojson.properties.name = newName;
    mapCollection.updateFeature(place1Geojson);
    expect(mapCollection.getFeatures().length).toEqual(3);
    feature = mapCollection.getById(genericPlace1.attributes.id);
    expect(feature).toBeDefined();
    expect((feature as any).properties.name).toEqual(newName);

});

test('Add / remove feature or object', () => {

    // Add a feature as object
    expect(mapCollection.getFeatures().length).toEqual(3);
    mapCollection.add(genericPlace4);
    expect(mapCollection.getFeatures().length).toEqual(4);
    let feature = mapCollection.getById(genericPlace4.getId());
    expect(feature).toBeDefined();

    // Remove the added feature
    mapCollection.removeById(genericPlace4.getId());
    expect(mapCollection.getFeatures().length).toEqual(3);

    // Add a feature as geojson feature
    mapCollection.add(genericPlace4.toGeojson());
    expect(mapCollection.getFeatures().length).toEqual(4);
    feature = mapCollection.getById(genericPlace4.getId());
    expect(feature).toBeDefined();

});