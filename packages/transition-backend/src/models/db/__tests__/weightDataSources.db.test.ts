/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../weightDataSources.db.queries';
import weightingModelsDbQueries from '../weightingModels.db.queries';
import { WeightDataSourceAttributes } from 'transition-common/lib/services/weights/WeightDataSource';

const objectName = 'weightDataSource';

let weightingModelId: number;

const newObjectAttributes: Omit<WeightDataSourceAttributes, 'id' | 'created_at' | 'updated_at'> = {
    name: 'Test Data Source',
    description: 'Test description',
    weighting_model_id: undefined,
    max_access_time_seconds: 1800,
    max_bird_distance_meters: 1500
};

const newObjectAttributes2: Omit<WeightDataSourceAttributes, 'id' | 'created_at' | 'updated_at'> = {
    name: 'Test Data Source 2',
    description: undefined,
    weighting_model_id: undefined,
    max_access_time_seconds: undefined,
    max_bird_distance_meters: undefined
};

const updatedAttributes: Partial<Omit<WeightDataSourceAttributes, 'id' | 'created_at'>> = {
    name: 'Updated Test Data Source',
    description: 'Updated description',
    max_access_time_seconds: 2400,
    max_bird_distance_meters: 2000
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await weightingModelsDbQueries.truncate();
    // Create a weighting model for foreign key reference
    weightingModelId = await weightingModelsDbQueries.create({
        name: 'Test Weighting Model',
        calculation: 'weight_only',
        notes: undefined,
        references: undefined
    });
    newObjectAttributes.weighting_model_id = weightingModelId;
    newObjectAttributes2.weighting_model_id = weightingModelId;
});

afterAll(async () => {
    await dbQueries.truncate();
    await weightingModelsDbQueries.truncate();
    await knex.destroy();
});

describe(`${objectName}`, () => {
    test('exists should return false if object is not in database', async () => {
        const exists = await dbQueries.exists(99999);
        expect(exists).toBe(false);
    });

    test('should create a new object in database', async () => {
        const id = await dbQueries.create(newObjectAttributes);
        expect(typeof id).toBe('number');
        expect(id).toBeGreaterThan(0);
    });

    test('should read a new object in database', async () => {
        const createdId = await dbQueries.create(newObjectAttributes);
        const attributes = await dbQueries.read(createdId);
        expect(attributes.name).toBe(newObjectAttributes.name);
        expect(attributes.description).toBe(newObjectAttributes.description);
        expect(attributes.weighting_model_id).toBe(weightingModelId);
        expect(attributes.max_access_time_seconds).toBe(newObjectAttributes.max_access_time_seconds);
        expect(attributes.max_bird_distance_meters).toBe(newObjectAttributes.max_bird_distance_meters);
        expect(attributes.created_at).toBeDefined();
    });

    test('should update an object in database', async () => {
        const createdId = await dbQueries.create(newObjectAttributes);
        const id = await dbQueries.update(createdId, updatedAttributes);
        expect(id).toBe(createdId);
    });

    test('should read an updated object from database', async () => {
        const createdId = await dbQueries.create(newObjectAttributes);
        await dbQueries.update(createdId, updatedAttributes);
        const updatedObject = await dbQueries.read(createdId);
        for (const attribute in updatedAttributes) {
            expect(updatedObject[attribute]).toBe(updatedAttributes[attribute]);
        }
    });

    test('should create a second new object in database', async () => {
        const id = await dbQueries.create(newObjectAttributes2);
        expect(typeof id).toBe('number');
        expect(id).toBeGreaterThan(0);
    });

    test('should read collection from database', async () => {
        const _collection = await dbQueries.collection();
        expect(_collection.length).toBeGreaterThanOrEqual(2);
        const testDataSource = _collection.find((obj) => obj.name === newObjectAttributes.name);
        expect(testDataSource).toBeDefined();
        expect(testDataSource?.weighting_model_id).toBe(weightingModelId);
        expect(testDataSource?.max_access_time_seconds).toBe(newObjectAttributes.max_access_time_seconds);
        expect(testDataSource?.max_bird_distance_meters).toBe(newObjectAttributes.max_bird_distance_meters);
    });

    test('should use default values when creating without max_access_time_seconds and max_bird_distance_meters', async () => {
        const attributesWithoutDefaults: Omit<WeightDataSourceAttributes, 'id' | 'created_at' | 'updated_at' | 'max_access_time_seconds' | 'max_bird_distance_meters'> = {
            name: 'Test Data Source with Defaults',
            description: 'Test description',
            weighting_model_id: weightingModelId
        };
        const createdId = await dbQueries.create(attributesWithoutDefaults);
        const attributes = await dbQueries.read(createdId);
        expect(attributes.max_access_time_seconds).toBe(1200); // Default from migration
        expect(attributes.max_bird_distance_meters).toBe(1250); // Default from migration
    });

    test('should delete objects from database', async () => {
        const id1 = await dbQueries.create(newObjectAttributes);
        const id2 = await dbQueries.create(newObjectAttributes2);
        const deletedId = await dbQueries.delete(id1);
        expect(deletedId).toBe(id1);

        const ids = await dbQueries.deleteMultiple([id1, id2]);
        // Only id2 should be deleted since id1 was already deleted
        expect(ids.length).toBeGreaterThanOrEqual(1);
    });

    test('create multiple with success', async () => {
        const ids = await dbQueries.createMultiple([newObjectAttributes, newObjectAttributes2]);
        expect(ids.length).toEqual(2);
        expect(ids[0]).toHaveProperty('id');
        expect(ids[1]).toHaveProperty('id');

        const _collection = await dbQueries.collection();
        const createdSources = _collection.filter(
            (obj) => obj.name === newObjectAttributes.name || obj.name === newObjectAttributes2.name
        );
        expect(createdSources.length).toBeGreaterThanOrEqual(2);
    });

    test('update multiple with success', async () => {
        const id1 = await dbQueries.create(newObjectAttributes);
        const id2 = await dbQueries.create(newObjectAttributes2);
        const response = await dbQueries.updateMultiple([
            { id: id1, ...updatedAttributes },
            { id: id2, name: 'Updated Data Source 2' }
        ]);
        expect(response.length).toEqual(2);

        const updated1 = await dbQueries.read(id1);
        const updated2 = await dbQueries.read(id2);
        expect(updated1.name).toBe(updatedAttributes.name);
        expect(updated2.name).toBe('Updated Data Source 2');
    });
});

