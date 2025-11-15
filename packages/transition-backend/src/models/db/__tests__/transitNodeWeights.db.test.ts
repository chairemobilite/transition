/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../transitNodeWeights.db.queries';
import weightDataSourcesDbQueries from '../weightDataSources.db.queries';
import weightingModelsDbQueries from '../weightingModels.db.queries';
import transitNodesDbQueries from '../transitNodes.db.queries';
import { TransitNodeWeightAttributes } from 'transition-common/lib/services/weights/TransitNodeWeight';

const objectName = 'transitNodeWeight';

let weightDataSourceId: number;
let transitNodeId: string;
let transitNodeId2: string;

const newObjectAttributes: TransitNodeWeightAttributes = {
    weight_data_source_id: 0, // Will be set in beforeAll
    transit_node_id: '', // Will be set in beforeAll
    weight_value: 100.5
};

const newObjectAttributes2: TransitNodeWeightAttributes = {
    weight_data_source_id: 0, // Will be set in beforeAll
    transit_node_id: '', // Will be set in beforeAll
    weight_value: 250.75
};

const updatedAttributes: Partial<Pick<TransitNodeWeightAttributes, 'weight_value'>> = {
    weight_value: 150.25
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await weightDataSourcesDbQueries.truncate();
    await weightingModelsDbQueries.truncate();
    await transitNodesDbQueries.truncate();

    // Create a weighting model
    const weightingModelId = await weightingModelsDbQueries.create({
        name: 'Test Weighting Model',
        calculation: 'weight_only',
        notes: undefined,
        references: undefined
    });

    // Create a weight data source
    weightDataSourceId = await weightDataSourcesDbQueries.create({
        name: 'Test Data Source',
        description: 'Test description',
        weighting_model_id: weightingModelId
    });

    // Create transit nodes
    transitNodeId = uuidV4();
    transitNodeId2 = uuidV4();

    await transitNodesDbQueries.create({
        id: transitNodeId,
        code: 'NODE001',
        name: 'Test Node 1',
        internal_id: 'test_node_1',
        integer_id: 1,
        geography: {
            type: 'Point' as const,
            coordinates: [-73.0, 45.0]
        },
        is_enabled: true,
        is_frozen: false,
        routing_radius_meters: 1000,
        default_dwell_time_seconds: 60,
        data: {}
    });

    await transitNodesDbQueries.create({
        id: transitNodeId2,
        code: 'NODE002',
        name: 'Test Node 2',
        internal_id: 'test_node_2',
        integer_id: 2,
        geography: {
            type: 'Point' as const,
            coordinates: [-73.1, 45.1]
        },
        is_enabled: true,
        is_frozen: false,
        routing_radius_meters: 1000,
        default_dwell_time_seconds: 60,
        data: {}
    });

    newObjectAttributes.weight_data_source_id = weightDataSourceId;
    newObjectAttributes.transit_node_id = transitNodeId;
    newObjectAttributes2.weight_data_source_id = weightDataSourceId;
    newObjectAttributes2.transit_node_id = transitNodeId2;
});

afterAll(async () => {
    await dbQueries.truncate();
    await weightDataSourcesDbQueries.truncate();
    await weightingModelsDbQueries.truncate();
    await transitNodesDbQueries.truncate();
    await knex.destroy();
});

beforeEach(async () => {
    // Truncate only the weights table to ensure each test starts with a clean state
    // The weight data sources, weighting models, and transit nodes are created in beforeAll
    // and should persist across tests
    await dbQueries.truncate();
});

describe(`${objectName}`, () => {
    test('exists should return false if object is not in database', async () => {
        const exists = await dbQueries.exists(99999, uuidV4());
        expect(exists).toBe(false);
    });

    test('should create a new object in database', async () => {
        const result = await dbQueries.create(newObjectAttributes);
        expect(result.weight_data_source_id).toBe(weightDataSourceId);
        expect(result.transit_node_id).toBe(transitNodeId);
    });

    test('should read a new object in database', async () => {
        await dbQueries.create(newObjectAttributes);
        const attributes = await dbQueries.read(weightDataSourceId, transitNodeId);
        expect(attributes.weight_data_source_id).toBe(newObjectAttributes.weight_data_source_id);
        expect(attributes.transit_node_id).toBe(newObjectAttributes.transit_node_id);
        expect(attributes.weight_value).toBe(newObjectAttributes.weight_value);
    });

    test('should update an object in database', async () => {
        await dbQueries.create(newObjectAttributes);
        const result = await dbQueries.update(weightDataSourceId, transitNodeId, updatedAttributes);
        expect(result.weight_data_source_id).toBe(weightDataSourceId);
        expect(result.transit_node_id).toBe(transitNodeId);
    });

    test('should read an updated object from database', async () => {
        await dbQueries.create(newObjectAttributes);
        await dbQueries.update(weightDataSourceId, transitNodeId, updatedAttributes);
        const updatedObject = await dbQueries.read(weightDataSourceId, transitNodeId);
        expect(updatedObject.weight_value).toBe(updatedAttributes.weight_value);
    });

    test('should create a second new object in database', async () => {
        const result = await dbQueries.create(newObjectAttributes2);
        expect(result.weight_data_source_id).toBe(weightDataSourceId);
        expect(result.transit_node_id).toBe(transitNodeId2);
    });

    test('should read collection from database', async () => {
        await dbQueries.create(newObjectAttributes);
        await dbQueries.create(newObjectAttributes2);
        const _collection = await dbQueries.collection();
        expect(_collection.length).toBeGreaterThanOrEqual(2);
        const testWeight = _collection.find(
            (obj) =>
                obj.weight_data_source_id === weightDataSourceId && obj.transit_node_id === transitNodeId
        );
        expect(testWeight).toBeDefined();
        expect(testWeight?.weight_value).toBe(newObjectAttributes.weight_value);
    });

    test('should read collection filtered by weight data source id', async () => {
        await dbQueries.create(newObjectAttributes);
        await dbQueries.create(newObjectAttributes2);
        const _collection = await dbQueries.collection(weightDataSourceId);
        expect(_collection.length).toBeGreaterThanOrEqual(2);
        _collection.forEach((item) => {
            expect(item.weight_data_source_id).toBe(weightDataSourceId);
        });
    });

    test('should read collection filtered by transit node id', async () => {
        await dbQueries.create(newObjectAttributes);
        await dbQueries.create(newObjectAttributes2);
        const _collection = await dbQueries.collection(undefined, transitNodeId);
        expect(_collection.length).toBeGreaterThanOrEqual(1);
        _collection.forEach((item) => {
            expect(item.transit_node_id).toBe(transitNodeId);
        });
    });

    test('should delete objects from database', async () => {
        await dbQueries.create(newObjectAttributes);
        await dbQueries.create(newObjectAttributes2);
        const result = await dbQueries.delete(weightDataSourceId, transitNodeId);
        expect(result.weight_data_source_id).toBe(weightDataSourceId);
        expect(result.transit_node_id).toBe(transitNodeId);

        const exists = await dbQueries.exists(weightDataSourceId, transitNodeId);
        expect(exists).toBe(false);
    });

    test('should delete multiple objects from database', async () => {
        await dbQueries.create(newObjectAttributes);
        await dbQueries.create(newObjectAttributes2);
        const pairs = [
            { weight_data_source_id: weightDataSourceId, transit_node_id: transitNodeId },
            { weight_data_source_id: weightDataSourceId, transit_node_id: transitNodeId2 }
        ];
        const results = await dbQueries.deleteMultiple(pairs);
        expect(results.length).toBe(2);

        const exists1 = await dbQueries.exists(weightDataSourceId, transitNodeId);
        const exists2 = await dbQueries.exists(weightDataSourceId, transitNodeId2);
        expect(exists1).toBe(false);
        expect(exists2).toBe(false);
    });

    test('create multiple with success', async () => {
        const results = await dbQueries.createMultiple([newObjectAttributes, newObjectAttributes2]);
        expect(results.length).toEqual(2);
        expect(results[0].weight_data_source_id).toBe(weightDataSourceId);
        expect(results[0].transit_node_id).toBe(transitNodeId);
        expect(results[1].weight_data_source_id).toBe(weightDataSourceId);
        expect(results[1].transit_node_id).toBe(transitNodeId2);

        const _collection = await dbQueries.collection(weightDataSourceId);
        expect(_collection.length).toBeGreaterThanOrEqual(2);
    });
});

