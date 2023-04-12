/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import { TransitOdDemandFromCsv } from '../TransitOdDemandFromCsv';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import DataSourceCollection from '../../dataSource/DataSourceCollection';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import DataSource from '../../dataSource/DataSource';
import { CsvFileAttributes, parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';

jest.mock('chaire-lib-common/lib/utils/files/CsvFile', () => ({
    parseCsvFile: jest.fn()
}))
const parseCsvFileMock = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;

const collectionManager = new CollectionManager(null);
serviceLocator.addService('collectionManager', collectionManager);

beforeEach(() => {
    parseCsvFileMock.mockClear();
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
        const batchRouting = new TransitOdDemandFromCsv({}, false);

        // Default validation, should be false and validate ok
        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(true);
        expect(batchRouting.attributes.saveToDb).toEqual(false);
    });

    test('new data source, unexisting name', () => {
        const batchRouting = new TransitOdDemandFromCsv({}, false);
        const expectedSaveToDb = { type: 'new' as const, dataSourceName: dataSources[2].attributes.name as string };
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(true);
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('new data source, existing name', () => {
        const batchRouting = new TransitOdDemandFromCsv({}, false);
        const expectedSaveToDb = { type: 'new' as const, dataSourceName: dataSources[0].attributes.name as string }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(false);
        expect(batchRouting.errors).toContain('transit:transitRouting:errors:DataSourceAlreadyExists');
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('existing data source, valid', () => {
        const batchRouting = new TransitOdDemandFromCsv({}, false);
        const expectedSaveToDb = { type: 'overwrite' as const, dataSourceId: dataSources[0].getId() }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(true);
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('existing data source, unexisting', () => {
        const batchRouting = new TransitOdDemandFromCsv({}, false);
        const expectedSaveToDb = { type: 'overwrite' as const, dataSourceId: 'arbitrary' }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(false);
        expect(batchRouting.errors).toContain('transit:transitRouting:errors:DataSourceDoesNotExists');
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });

    test('existing data source, not an odTrip data source', () => {
        const batchRouting = new TransitOdDemandFromCsv({}, false);
        const expectedSaveToDb = { type: 'overwrite' as const, dataSourceId: dataSources[1].getId() }
        batchRouting.attributes.saveToDb = expectedSaveToDb;

        batchRouting.validate();
        expect(batchRouting.isValid).toEqual(false);
        expect(batchRouting.errors).toContain('transit:transitRouting:errors:InvalidOdTripsDataSource');
        expect(batchRouting.attributes.saveToDb).toEqual(expectedSaveToDb);
    });
});

describe('setCsvFile', () => {
    // csvObject to send to the row callback for the test.
    let csvObjects = {};
    parseCsvFileMock.mockImplementation((_input: string | NodeJS.ReadableStream | any,
        rowCallback: (object: { [key: string]: any }, rowNumber: number) => void,
        _options: Partial<CsvFileAttributes>) => {
            return new Promise((resolve, reject) => {
                rowCallback(csvObjects, 1);
                resolve('completed');
            });
    });

    test('Test with no prior field mapping', async () => {
        // Set test data
        csvObjects = { id: 1, field1: 'just data', field2: -73, field3: 45, field4: 'arbitrary' };

        const batchRouting = new TransitOdDemandFromCsv({}, false);
        const expectedUndefined = ['idAttribute', 'timeAttributeDepartureOrArrival', 'timeFormat', 'timeAttribute',
            'withGeometries', 'detailed', 'projection', 'originXAttribute', 'originYAttribute', 
            'destinationXAttribute', 'destinationYAttribute'];
        const file = 'justAFile.csv';

        const csvFields = await batchRouting.setCsvFile(file, { location: 'upload' });

        // Validte calls and return values
        expect(csvFields).toEqual(Object.keys(csvObjects));
        expect(parseCsvFileMock).toHaveBeenCalledTimes(1);
        expect(parseCsvFileMock).toHaveBeenCalledWith(file, expect.anything(), { header: true, nbRows: 1});
        expect(batchRouting.attributes).toEqual(expect.objectContaining({
            csvFile: { location: 'upload', filename: file },
        }));
        
        expect(expectedUndefined.find((name) => batchRouting.attributes[name] !== undefined)).toBeUndefined();
    });

    test('Test with prior still valid field mapping', async () => {
        // Set test data
        csvObjects = { id: 1, field1: 'id', field2: -73, field3: 45, field4: '01:00', field5: -73, field6: 45, };

        const batchRoutingAttributes = {
            calculationName: 'calculationName',
            csvFile: { location: 'upload' as const, filename: 'input.csv' },
            idAttribute: 'field1',
            timeAttributeDepartureOrArrival: 'arrival' as const,
            timeFormat: 'timeFormat',
            timeAttribute: 'field4',
            withGeometries: true,
            detailed: false,
            projection: 'projection',
            originXAttribute: 'field2',
            originYAttribute: 'field3',
            destinationXAttribute: 'field5',
            destinationYAttribute: 'field6',
        };
        const batchRouting = new TransitOdDemandFromCsv(_cloneDeep(batchRoutingAttributes), false);
        const file = 'justAFile.csv';
    
        const csvFields = await batchRouting.setCsvFile(file, { location: 'upload' });

        // Validte calls and return values
        expect(csvFields).toEqual(Object.keys(csvObjects));
        expect(parseCsvFileMock).toHaveBeenCalledTimes(1);
        expect(parseCsvFileMock).toHaveBeenCalledWith(file, expect.anything(), { header: true, nbRows: 1});
        
        expect(batchRouting.attributes).toEqual(expect.objectContaining({
            ...batchRoutingAttributes,
            csvFile: { location: 'upload', filename: file }
        }));
    });

    test('Test with prior field mapping to reset', async () => {
        // Set test data
        csvObjects = { id: 1, field1: 'just data', field2: -73, field3: 45, field4: 'arbitrary' };

        const batchRoutingAttributes = {
            calculationName: 'calculationName',
            csvFile: { location: 'upload' as const, filename: 'input.csv' },
            idAttribute: 'idAttribute',
            timeAttributeDepartureOrArrival: 'arrival' as const,
            timeFormat: 'timeFormat',
            timeAttribute: 'timeAttribute',
            withGeometries: true,
            detailed: false,
            projection: 'projection',
            originXAttribute: 'originXAttribute',
            originYAttribute: 'originYAttribute',
            destinationXAttribute: 'destinationXAttribute',
            destinationYAttribute: 'destinationYAttribute',
        };
        const batchRouting = new TransitOdDemandFromCsv(_cloneDeep(batchRoutingAttributes), false);
        const expectedUndefined = ['idAttribute', 'timeAttribute', 'originXAttribute', 'originYAttribute', 
            'destinationXAttribute', 'destinationYAttribute'];
        const file = 'justAFile.csv';
        
        const csvFields = await batchRouting.setCsvFile(file, { location: 'upload' });

        // Validte calls and return values
        expect(csvFields).toEqual(Object.keys(csvObjects));
        expect(parseCsvFileMock).toHaveBeenCalledTimes(1);
        expect(parseCsvFileMock).toHaveBeenCalledWith(file, expect.anything(), { header: true, nbRows: 1});
        expect(batchRouting.attributes).toEqual(expect.objectContaining({
            csvFile: { location: 'upload', filename: file },
            calculationName: batchRoutingAttributes.calculationName,
            timeAttributeDepartureOrArrival: batchRoutingAttributes.timeAttributeDepartureOrArrival,
            timeFormat: batchRoutingAttributes.timeFormat,
            withGeometries: true,
            detailed: false,
            projection: 'projection'
        }));
        
        expect(expectedUndefined.find((name) => batchRouting.attributes[name] !== undefined)).toBeUndefined();
    })
})
