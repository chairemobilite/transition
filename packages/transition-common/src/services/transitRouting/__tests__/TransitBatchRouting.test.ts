/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitBatchRouting } from '../TransitBatchRouting';
import { TransitRouting } from '../TransitRouting';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import DataSourceCollection from '../../dataSource/DataSourceCollection';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import DataSource from '../../dataSource/DataSource';

const collectionManager = new CollectionManager(null);
serviceLocator.addService('collectionManager', collectionManager);

const defaultTransitRouting = new TransitRouting({});

test('Validate number of CPUs', () => {
    const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);
    
    // all cpu count has not been set, they should remain unset
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toBeUndefined();
    expect(batchRouting.getAttributes().maxCpuCount).toBeUndefined();

    // Set a max count, the count should be the max count
    const maxCpu = 4;
    batchRouting.getAttributes().maxCpuCount = maxCpu;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(maxCpu);
    expect(batchRouting.getAttributes().maxCpuCount).toEqual(maxCpu);

    // Set a valid count, should be unchanged
    let cpuCount = 2;
    batchRouting.getAttributes().cpuCount = cpuCount;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(cpuCount);
    expect(batchRouting.getAttributes().maxCpuCount).toEqual(maxCpu);

    // Set a CPU count too high, should be back to max count
    cpuCount = maxCpu + 2;
    batchRouting.getAttributes().cpuCount = cpuCount;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(maxCpu);
    expect(batchRouting.getAttributes().maxCpuCount).toEqual(maxCpu);

    // Set a CPU count below 0, should be set to 1
    cpuCount = -1;
    batchRouting.getAttributes().cpuCount = cpuCount;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(1);
    expect(batchRouting.getAttributes().maxCpuCount).toEqual(maxCpu);

    // Set max to undefined, then set cpu count below to 0 or negative, should be 1
    batchRouting.getAttributes().maxCpuCount = undefined;
    batchRouting.getAttributes().cpuCount = 0;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(1);
    expect(batchRouting.getAttributes().maxCpuCount).toBeUndefined();
    batchRouting.getAttributes().cpuCount = -1;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(1);
    expect(batchRouting.getAttributes().maxCpuCount).toBeUndefined();

    cpuCount = 10;
    batchRouting.getAttributes().cpuCount = cpuCount;
    batchRouting.validate();
    expect(batchRouting.getAttributes().cpuCount).toEqual(cpuCount);
    expect(batchRouting.getAttributes().maxCpuCount).toBeUndefined();
});

describe('validate saveToDb', () => {
    // Add data sources: 2 of identical names for different type and one of different name
    const dataSources = [
        new DataSource({ name: 'test', shortname: 'test', type: 'odTrips'}, false),
        new DataSource({ name: 'test', shortname: 'test', type: 'zones'}, false),
        new DataSource({ name: 'foo', shortname: 'foo', type: 'zones'}, false)
    ];
    const dataSourceCollection = new DataSourceCollection(dataSources, {});
    collectionManager.add('dataSources', dataSourceCollection);

    test('default validation, should be false', () => {
        const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);

        // Default validation, should be false and validate ok
        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(true);
        expect(batchRouting.attributes.saveToDb).toEqual(false);
    });

    test('new data source, unexisting name', () => {
        const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);
        const expectedSaveToDb = { type: 'new' as const, dataSourceName: dataSources[2].attributes.name as string };
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(true);
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('new data source, existing name', () => {
        const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);
        const expectedSaveToDb = { type: 'new' as const, dataSourceName: dataSources[0].attributes.name as string }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(false);
        expect(batchRouting.errors).toContain('transit:transitRouting:errors:DataSourceAlreadyExists');
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('existing data source, valid', () => {
        const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);
        const expectedSaveToDb = { type: 'overwrite' as const, dataSourceId: dataSources[0].getId() }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(true);
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('existing data source, unexisting', () => {
        const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);
        const expectedSaveToDb = { type: 'overwrite' as const, dataSourceId: 'arbitrary' }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(false);
        expect(batchRouting.errors).toContain('transit:transitRouting:errors:DataSourceDoesNotExists');
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('existing data source, not an odTrip data source', () => {
        const batchRouting = new TransitBatchRouting({}, false, defaultTransitRouting);
        const expectedSaveToDb = { type: 'overwrite' as const, dataSourceId: dataSources[1].getId() }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(false);
        expect(batchRouting.errors).toContain('transit:transitRouting:errors:InvalidOdTripsDataSource');
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });
});
