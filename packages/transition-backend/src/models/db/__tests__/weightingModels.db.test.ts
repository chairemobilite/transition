/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../weightingModels.db.queries';
import { WeightingModelAttributes } from 'transition-common/lib/services/weights/WeightingModel';

const objectName = 'weightingModel';

const newObjectAttributes: Omit<WeightingModelAttributes, 'id'> = {
    name: 'Test Model',
    calculation: 'weight_only',
    notes: undefined,
    references: undefined
};

const newObjectAttributes2: Omit<WeightingModelAttributes, 'id'> = {
    name: 'Test Model 2',
    calculation: 'gravity_walking_1',
    notes: 'Test notes',
    references: 'Test references'
};

const updatedAttributes: Partial<WeightingModelAttributes> = {
    name: 'Updated Test Model',
    notes: 'Updated notes'
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    // Re-seed the default models after truncate
    await knex('tr_weighting_models').insert([
        {
            name: 'Weight Only',
            calculation: 'weight_only',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Walking, exponent 1)',
            calculation: 'gravity_walking_1',
            notes: null,
            references: null
        }
    ]);
});

afterAll(async () => {
    await dbQueries.truncate();
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
        expect(attributes.calculation).toBe(newObjectAttributes.calculation);
        expect(attributes.notes).toBe(newObjectAttributes.notes);
        expect(attributes.references).toBe(newObjectAttributes.references);
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
        const testModel = _collection.find((obj) => obj.name === newObjectAttributes.name);
        expect(testModel).toBeDefined();
        expect(testModel?.calculation).toBe(newObjectAttributes.calculation);
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
        const createdModels = _collection.filter(
            (obj) => obj.name === newObjectAttributes.name || obj.name === newObjectAttributes2.name
        );
        expect(createdModels.length).toBeGreaterThanOrEqual(2);
    });

    test('update multiple with success', async () => {
        const id1 = await dbQueries.create(newObjectAttributes);
        const id2 = await dbQueries.create(newObjectAttributes2);
        const response = await dbQueries.updateMultiple([
            { id: id1, ...updatedAttributes },
            { id: id2, name: 'Updated Model 2' }
        ]);
        expect(response.length).toEqual(2);

        const updated1 = await dbQueries.read(id1);
        const updated2 = await dbQueries.read(id2);
        expect(updated1.name).toBe(updatedAttributes.name);
        expect(updated2.name).toBe('Updated Model 2');
    });
});

