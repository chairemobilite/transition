/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { point as turfPoint } from '@turf/turf';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../places.db.queries';
import dataSourcesDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import {
    categories,
    detailedCategories,
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import GeojsonCollection from 'transition-common/lib/services/places/PlaceCollection';
import ObjectClass, { PlaceAttributes } from 'transition-common/lib/services/places/Place';

const dataSourceId = uuidV4();
const dataSourceId2 = uuidV4();
const objectName   = 'place';

const newObjectAttributes = {
    id: uuidV4(),
    internal_id: 'internalTestId',
    data_source_id: dataSourceId,
    is_frozen: false,
    shortname: 'resto',
    name: 'Resto Test',
    description: 'Description du Resto Test',
    geography: turfPoint([-73.6, 45.5]).geometry,
    walking_20min_accessible_nodes_count: 23,
    walking_15min_accessible_nodes_count: null,
    walking_10min_accessible_nodes_count: 33,
    walking_5min_accessible_nodes_count: 43,
    data: {
        foo: 'bar',
        bar: 'foo',
        nodes: [0, 2, 4],
        nodesTravelTimes: [123, 456, 789],
        nodesDistances: [246, 357, 250],
        category: 'restaurant',
        category_detailed: 'restaurant_restaurant'
    }
} as PlaceAttributes;

const newObjectAttributes2 = {
    id: uuidV4(),
    is_frozen: true,
    internal_id: 'internalTestId2',
    data_source_id: dataSourceId,
    shortname: 'resto2',
    name: 'Resto Test 2',
    description: 'Description du Resto Test 2',
    geography: turfPoint([-73.5, 45.6]).geometry,
    walking_20min_accessible_nodes_count: 0,
    walking_15min_accessible_nodes_count: 0,
    walking_10min_accessible_nodes_count: 11,
    walking_5min_accessible_nodes_count: 22,
    data: {
        foo2: 'bar2',
        bar2: 'foo2',
        category: 'restaurant',
        category_detailed: 'restaurant_cafe'
    }
} as PlaceAttributes;

const newObjectAttributes1ForDs2 = Object.assign({}, newObjectAttributes, { id: uuidV4(), data_source_id: dataSourceId2});
const newObjectAttributes2ForDs2 = Object.assign({}, newObjectAttributes2, { id: uuidV4(), data_source_id: dataSourceId2});

const updatedAttributes = {
    shortname: 'resto_test'
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await dataSourcesDbQueries.createMultiple([{
        id: dataSourceId,
        type: 'places',
        data: {}
    }, {
        id: dataSourceId2,
        type: 'places',
        data: {}
    }]);
});

afterAll(async() => {
    await dbQueries.truncate();
    await dataSourcesDbQueries.truncate();
    await knex.destroy();
});

describe(`${objectName}`, () => {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(uuidV4())
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read a new object in database', async() => {
        
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        delete _newObjectAttributes.data.nodes;
        delete _newObjectAttributes.data.nodesTravelTimes;
        delete _newObjectAttributes.data.nodesDistances;
        const attributes = await dbQueries.read(newObjectAttributes.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        expect(attributes).toEqual(expect.objectContaining(_newObjectAttributes));

    });

    test('should update an object in database', async() => {
        
        const id = await dbQueries.update(newObjectAttributes.id, updatedAttributes);
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read an updated object from database', async() => {

        const updatedObject = await dbQueries.read(newObjectAttributes.id) as any;
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toBe(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object in database', async() => {
        
        const newObject = new ObjectClass(newObjectAttributes2, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes2.id);

    });

    // These tests are executed here, so that there will only be one of each object in the database.
    describe('get right amount of POIs in polygon', () => {

        // We add an object with no data to the db, as well as one with data but no categories, both of them placed in between the two main objects.
        // This way, we can test that only objects with categories are counted.
        const objectWithNoDataAttributes = {
            id: uuidV4(),
            internal_id: 'internalTestId3',
            data_source_id: dataSourceId,
            geography: turfPoint([-73.55, 45.55]).geometry
        } as PlaceAttributes;

        const objectWithNoCategoriesAttributes = {
            id: uuidV4(),
            internal_id: 'internalTestId4',
            data_source_id: dataSourceId,
            geography: turfPoint([-73.55, 45.55]).geometry,
            data: {
                foo4: 'bar4',
                bar4: 'foo4'
            }
        } as PlaceAttributes;

        const accessiblePlacesCountByCategory = categories.reduce(
            (categoriesAsKeys, category) => ((categoriesAsKeys[category] = 0), categoriesAsKeys),
            {}
        ) as { [key in PlaceCategory]: number };
        const accessiblePlacesCountByDetailedCategory = detailedCategories.reduce(
            (categoriesAsKeys, category) => ((categoriesAsKeys[category] = 0), categoriesAsKeys),
            {}
        ) as { [key in PlaceDetailedCategory]: number };

        test('add objects with no categories to database', async () => {

            const objectWithNoData = new ObjectClass(objectWithNoDataAttributes, true);
            const idNoData = await dbQueries.create(objectWithNoData.attributes);
            expect(idNoData).toBe(objectWithNoDataAttributes.id);

            const objectWithNoCategories = new ObjectClass(objectWithNoCategoriesAttributes, true);
            const idNoCategories = await dbQueries.create(objectWithNoCategories.attributes);
            expect(idNoCategories).toBe(objectWithNoCategoriesAttributes.id);

        });

        test('test with polygon that has zero POI', async () => {

            const polygonWithNoPoints: GeoJSON.Polygon = {
                type: 'Polygon',
                coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
            };

            const resultNoPoints = await dbQueries.getPOIsCategoriesCountInPolygon(polygonWithNoPoints);

            expect(resultNoPoints).toEqual({ accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory });

        });

        test('test with polygon that has one POI', async () => {

            const polygonWithOnePoint: GeoJSON.Polygon = {
                type: 'Polygon',
                coordinates: [[[-73.55, 45.55], [-73.55, 45.65], [-73.45, 45.65], [-73.45, 45.55], [-73.55, 45.55]]]
            };

            accessiblePlacesCountByCategory.restaurant = 1;
            accessiblePlacesCountByDetailedCategory.restaurant_cafe = 1;

            const resultOnePoint = await dbQueries.getPOIsCategoriesCountInPolygon(polygonWithOnePoint);

            expect(resultOnePoint).toEqual({ accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory });

        });

        test('test with polygon that has two POIs', async () => {

            const polygonWithBothPoints: GeoJSON.Polygon = {
                type: 'Polygon',
                coordinates: [[[-100, -100], [-100, 100], [100, 100], [100, -100], [-100, -100]]]
            };

            accessiblePlacesCountByCategory.restaurant = 2;
            accessiblePlacesCountByDetailedCategory.restaurant_restaurant = 1;

            const resultBothPoints = await dbQueries.getPOIsCategoriesCountInPolygon(polygonWithBothPoints);

            expect(resultBothPoints).toEqual({ accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory });

        });

        test('delete objects with no categories from database', async() => {

            const idNoData = await dbQueries.delete(objectWithNoDataAttributes.id);
            expect(idNoData).toBe(objectWithNoDataAttributes.id);

            const idNoCategories = await dbQueries.delete(objectWithNoCategoriesAttributes.id);
            expect(idNoCategories).toBe(objectWithNoCategoriesAttributes.id);

        });

    });

    test('should create multiple objects in database for second datasource', async() => {
        
        const newObject1 = new ObjectClass(newObjectAttributes1ForDs2, true);
        const newObject2 = new ObjectClass(newObjectAttributes2ForDs2, true);
        await dbQueries.createMultiple([newObject1.attributes, newObject2.attributes]);

    });

    test('should read geojson collection from database', async () => {

        const _collection = await dbQueries.geojsonCollection();
        const geojsonCollection = new GeojsonCollection(_collection.features, {}, undefined);
        const _newObjectAttributes = Object.assign({}, newObjectAttributes) as any;
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2) as any;
        const _newObjectAttributes3 = Object.assign({}, newObjectAttributes1ForDs2) as any;
        const _newObjectAttributes4 = Object.assign({}, newObjectAttributes2ForDs2) as any;
        delete _newObjectAttributes.geography;
        delete _newObjectAttributes2.geography;
        delete _newObjectAttributes3.geography;
        delete _newObjectAttributes4.geography;
        delete _newObjectAttributes.data.nodes;
        delete _newObjectAttributes.data.nodesTravelTimes;
        delete _newObjectAttributes.data.nodesDistances;
        delete _newObjectAttributes3.data.nodes;
        delete _newObjectAttributes3.data.nodesTravelTimes;
        delete _newObjectAttributes3.data.nodesDistances;
        const collection = geojsonCollection.features;
        expect(collection.length).toEqual(4);
        for (const attribute in updatedAttributes) {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].properties.created_at;
        delete collection[0].properties.updated_at;
        delete collection[1].properties.created_at;
        delete collection[1].properties.updated_at;
        delete collection[2].properties.created_at;
        delete collection[2].properties.updated_at;
        delete collection[3].properties.created_at;
        delete collection[3].properties.updated_at;

        expect(collection[0].properties.id).toBe(_newObjectAttributes.id);
        expect(collection[0].properties).toMatchObject(_newObjectAttributes);
        expect(collection[1].properties.id).toBe(_newObjectAttributes2.id);
        expect(collection[1].properties).toMatchObject(_newObjectAttributes2);
        expect(collection[2].properties.id).toBe(_newObjectAttributes3.id);
        expect(collection[2].properties).toMatchObject(_newObjectAttributes3);
        expect(collection[3].properties.id).toBe(_newObjectAttributes4.id);
        expect(collection[3].properties).toMatchObject(_newObjectAttributes4);

    });

    test('count places by data source id', async () => {

        const countByDs = await dbQueries.countForDataSources();
        expect(countByDs).toEqual( {
            [dataSourceId]: 2,
            [dataSourceId2]: 2
        });

        const countByDsForDs1 = await dbQueries.countForDataSources([dataSourceId]);
        expect(countByDsForDs1).toEqual( {
            [dataSourceId]: 2
        });

        const countByDsForBoth = await dbQueries.countForDataSources([dataSourceId, dataSourceId2]);
        expect(countByDsForBoth).toEqual( {
            [dataSourceId]: 2,
            [dataSourceId2]: 2
        });

    });

    test('get collection by data source', async () => {

        const collection = await dbQueries.collection([dataSourceId]);
        expect(collection.length).toEqual(2);

        expect(collection[0].data_source_id).toEqual(dataSourceId);
        expect(collection[1].data_source_id).toEqual(dataSourceId);

    });

    test('get sample ratio', async () => {

        const collection = await dbQueries.collection([dataSourceId], 1);
        expect(collection.length).toEqual(1);
        expect(collection[0].data_source_id).toEqual(dataSourceId);

        const collectionTooLarge = await dbQueries.collection([dataSourceId], 3);
        expect(collectionTooLarge.length).toEqual(2);

    });

    test('should delete objects from database', async() => {
        
        const id = await dbQueries.delete(newObjectAttributes.id)
        expect(id).toBe(newObjectAttributes.id);

        const ids = await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id]);
        expect(ids).toEqual([newObjectAttributes.id, newObjectAttributes2.id]);

    });

});
