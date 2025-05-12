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
        nodesDistances: [246, 357, 250]
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
        bar2: 'foo2'
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
