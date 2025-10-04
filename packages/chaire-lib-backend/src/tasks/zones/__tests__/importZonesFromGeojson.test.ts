/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidV4 } from 'uuid';

import { ImportZonesFromGeojson } from '../importZonesFromGeojson';
import { fileManager } from '../../../utils/filesystem/fileManager';
import dsQueries from '../../../models/db/dataSources.db.queries';
import zonesQueries from '../../../models/db/zones.db.queries';
import { DataSourceAttributes } from 'chaire-lib-common/lib/services/dataSource/DataSource';

// Mock queries and file system
jest.mock('../../../utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
        readFileAbsolute: jest.fn()
    }
}));
const mockFileExists = fileManager.fileExistsAbsolute as jest.MockedFunction<typeof fileManager.fileExistsAbsolute>;
const mockReadFile = fileManager.readFileAbsolute as jest.MockedFunction<typeof fileManager.readFileAbsolute>;

jest.mock('inquirer-file-selector', () => ({
    fileSelector: jest.fn()
}));
import { fileSelector, Item } from 'inquirer-file-selector';
//const mockFileSelector = fileSelector as jest.MockedFunction<(config: any) => Promise<Item>>;
const mockFileSelector = fileSelector as unknown as jest.MockedFunction<(config: any) => Promise<Item>>;

jest.mock('@inquirer/prompts', () => ({
    select: jest.fn(),
    input: jest.fn()
}));
import { select, input } from '@inquirer/prompts';
const mockSelect = select as jest.MockedFunction<typeof select>;
const mockInput = input as jest.MockedFunction<typeof input>;

jest.mock('../../../models/db/zones.db.queries', () => ({
    deleteForDataSourceId: jest.fn(),
    createMultiple: jest.fn()
}));
const mockDeleteForDsId = zonesQueries.deleteForDataSourceId as jest.MockedFunction<typeof zonesQueries.deleteForDataSourceId>;
const mockCreateMultiple = zonesQueries.createMultiple as jest.MockedFunction<typeof zonesQueries.createMultiple>;

jest.mock('../../../models/db/dataSources.db.queries', () => ({
    collection: jest.fn(),
    read: jest.fn(),
    create: jest.fn()
}));
const mockDsCollection = dsQueries.collection as jest.MockedFunction<typeof dsQueries.collection>;
const mockDsRead = dsQueries.read as jest.MockedFunction<typeof dsQueries.read>;
const mockDsCreate = dsQueries.create as jest.MockedFunction<typeof dsQueries.create>;

beforeEach(() => {
    mockFileExists.mockClear();
    mockReadFile.mockClear();
    mockFileSelector.mockClear();
    mockSelect.mockClear();
    mockInput.mockClear();
    mockDeleteForDsId.mockClear();
    mockCreateMultiple.mockClear();
    mockDsCollection.mockClear();
    mockDsRead.mockClear();
    mockDsCreate.mockClear();
});

const file = '/home/test/myFile.geojson';
describe('Geojson zone file error', () => {

    const parameters = { ['zones-file']: file };

    test('File does not exist', async () => {
        const importZonesTask = new ImportZonesFromGeojson();
        mockFileExists.mockReturnValueOnce(false);

        await expect(importZonesTask.run(parameters))
            .rejects
            .toThrowError(`The requested file ${file} does not exist`); 
    });

    test('File object is not a string', async () => {
        const importZonesTask = new ImportZonesFromGeojson();

        await expect(importZonesTask.run({ ['zones-file']: 3 }))
            .rejects
            .toThrowError('File is undefined');
    });

    test('Not a geojson', async () => {
        const importZonesTask = new ImportZonesFromGeojson();
        mockReadFile.mockReturnValueOnce('{ "foo": "bar" }');

        await expect(importZonesTask.run(parameters))
            .rejects
            .toThrowError(`The file content is not geojson ${file}`);
    });

    test('Not a feature collection', async () => {
        const importZonesTask = new ImportZonesFromGeojson();
        mockReadFile.mockReturnValueOnce('{ "type": "Point", "coordinates": [-73, 45] }');

        await expect(importZonesTask.run(parameters))
            .rejects
            .toThrowError(`The file content is not a feature collection: ${file}`);
    });

    test('Empty feature collection', async () => {
        const importZonesTask = new ImportZonesFromGeojson();
        mockReadFile.mockReturnValueOnce('{ "type": "FeatureCollection", "features": [] }');

        await expect(importZonesTask.run(parameters))
            .rejects
            .toThrowError(`The feature collection is empty: ${file}`);
    });

    test('One feature not a polygon', async () => {
        const importZonesTask = new ImportZonesFromGeojson();
        const featureCollection = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: { foo: 'bar' },
                geometry: { type: 'Polygon', coordinates: [ [ [-73, 45], [-73, 46],[ -74, 46], [-73, 45] ] ] }
            }, {
                type: "Feature",
                properties: { foo: 'bar' },
                geometry: { type: 'Point', coordinates: [-73, 45] }
            }]
        }
        mockReadFile.mockReturnValueOnce(JSON.stringify(featureCollection));

        await expect(importZonesTask.run(parameters))
            .rejects
            .toThrowError(`Feature at index 1 is not a Polygon or MultiPolygon`);
    });
});

describe('Correct calls', () => {
    const featureCollection = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            properties: { foo: 'bar' },
            geometry: { type: 'Polygon', coordinates: [ [ [-73, 45], [-73, 46],[ -74, 46], [-73, 45] ] ] }
        }, {
            id: 3,
            type: "Feature",
            properties: { foo: 'a very long string that should be trimmed for shortname' },
            geometry: { type: 'Polygon', coordinates: [ [ [-72, 45], [-72, 46],[ -73, 46], [-73, 45] ] ] }
        }]
    };
    const dataSources: DataSourceAttributes[] = [{
        id: uuidV4(),
        type: 'zones',
        data: {},
        shortname: 'DS1',
        name: 'Data source 1'
    }, {
        id: uuidV4(),
        type: 'zones',
        data: {},
        shortname: 'DS2',
        name: 'Data source 2'
    }]

    test('Prompt file name and new data source, one property', async () => {
        // Prepare test data
        const dataSourceName = 'Data source';
        const dataSourceShortname = 'DS';
        mockReadFile.mockReturnValueOnce(JSON.stringify(featureCollection));
        mockFileSelector.mockResolvedValueOnce({name: 'myFile.geojson', path: '/home/test/myFile.geojson', size: 100, createdMs: 100000, lastModifiedMs: 100000, isDirectory: false});
        mockSelect.mockResolvedValueOnce('__newDataSource__');
        mockInput.mockResolvedValueOnce(dataSourceShortname);
        mockInput.mockResolvedValueOnce(dataSourceName);
        mockDsCollection.mockResolvedValueOnce(dataSources);
        mockDsRead.mockImplementationOnce(async (id) => ({
            shortname: dataSourceShortname,
            name: dataSourceName,
            type: 'zones',
            id,
            data: {}
        }));

        // Import zones
        const importZonesTask = new ImportZonesFromGeojson();
        await importZonesTask.run({});

        // A new data source should have been created, with 2 new zones and no prompt for properties as there is only one
        expect(mockSelect).toHaveBeenCalledWith(expect.objectContaining({
            choices: [{
                name: `${dataSources[0].name} - ${dataSources[0].shortname}`,
                value: dataSources[0].id
            }, {
                name: `${dataSources[1].name} - ${dataSources[1].shortname}`,
                value: dataSources[1].id
            }, {
                value: `__newDataSource__`,
                name: '--New data source--'
            }]
        }));
        expect(mockInput).toHaveBeenCalledTimes(2);
        expect(mockDsCreate).toHaveBeenCalledWith(expect.objectContaining({
            shortname: dataSourceShortname,
            name: dataSourceName,
            type: 'zones',
            id: expect.anything()
        }));
        const dataSource = mockDsCreate.mock.calls[0][0];
        expect(mockCreateMultiple).toHaveBeenCalledWith([expect.objectContaining({
            id: expect.anything(),
            internal_id: undefined,
            shortname: featureCollection.features[0].properties.foo,
            name: featureCollection.features[0].properties.foo,
            geography: featureCollection.features[0].geometry,
            dataSourceId: dataSource.id,
            data: featureCollection.features[0].properties
        }), expect.objectContaining({
            id: expect.anything(),
            internal_id: '3',
            shortname: featureCollection.features[1].properties.foo.substring(0, 30),
            name: featureCollection.features[1].properties.foo,
            geography: featureCollection.features[1].geometry,
            dataSourceId: dataSource.id,
            data: featureCollection.features[1].properties
        })]);

    });

    test('File and data source parameters, data source exists', async () => {
        // Prepare test data
        mockReadFile.mockReturnValueOnce(JSON.stringify(featureCollection));
        mockDsCollection.mockResolvedValueOnce(dataSources);

        // Import zones
        const importZonesTask = new ImportZonesFromGeojson();
        await importZonesTask.run({ ['zones-file']: file, shortname: dataSources[0].shortname, name: dataSources[0].name });

        // A new data source should have been created, with 2 new zones and no prompt for properties as there is only one
        expect(mockDsCreate).not.toHaveBeenCalled();
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockInput).not.toHaveBeenCalled();
        expect(mockDeleteForDsId).toHaveBeenCalledWith(dataSources[0].id);

        expect(mockCreateMultiple).toHaveBeenCalledWith([expect.objectContaining({
            id: expect.anything(),
            internal_id: undefined,
            shortname: featureCollection.features[0].properties.foo,
            name: featureCollection.features[0].properties.foo,
            geography: featureCollection.features[0].geometry,
            dataSourceId: dataSources[0].id
        }), expect.objectContaining({
            id: expect.anything(),
            internal_id: '3',
            shortname: featureCollection.features[1].properties.foo.substring(0, 30),
            name: featureCollection.features[1].properties.foo,
            geography: featureCollection.features[1].geometry,
            dataSourceId: dataSources[0].id
        })]);

    });

    test('File and data source parameters, data source does not exist', async () => {
        // Prepare test data
        const dsShortname = 'DS';
        const dsName = 'Data source';
        mockReadFile.mockReturnValueOnce(JSON.stringify(featureCollection));
        mockDsCollection.mockResolvedValueOnce(dataSources);
        mockDsRead.mockImplementationOnce(async (id) => ({
            shortname: dsShortname,
            name: dsName,
            type: 'zones',
            id,
            data: {}
        }));

        // Import zones
        const importZonesTask = new ImportZonesFromGeojson();
        await importZonesTask.run({ ['zones-file']: file, shortname: dsShortname, name: dsName });

        // A new data source should have been created, with 2 new zones and no prompt for properties as there is only one
        expect(mockDsCreate).toHaveBeenCalledWith(expect.objectContaining({
            shortname: dsShortname,
            name: dsName,
            type: 'zones',
            id: expect.anything()
        }));
        const dataSource = mockDsCreate.mock.calls[0][0];
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockInput).not.toHaveBeenCalled();
        expect(mockDeleteForDsId).not.toHaveBeenCalled();

        expect(mockCreateMultiple).toHaveBeenCalledWith([expect.objectContaining({
            id: expect.anything(),
            internal_id: undefined,
            shortname: featureCollection.features[0].properties.foo,
            name: featureCollection.features[0].properties.foo,
            geography: featureCollection.features[0].geometry,
            dataSourceId: dataSource.id
        }), expect.objectContaining({
            id: expect.anything(),
            internal_id: '3',
            shortname: featureCollection.features[1].properties.foo.substring(0, 30),
            name: featureCollection.features[1].properties.foo,
            geography: featureCollection.features[1].geometry,
            dataSourceId: dataSource.id
        })]);

    });

    test('File and data source parameters, data source exists, many features properties', async () => {
        // Prepare test data
        mockDsCollection.mockResolvedValueOnce(dataSources);
        const newFeatureCollection = {
            type: 'FeatureCollection',
            features: featureCollection.features.map((feature, idx) => ({
                ...feature,
                properties: {
                    property1: 'a',
                    property2: `b${idx}`,
                    property3: '3'
                }
            }))
        };
        mockReadFile.mockReturnValueOnce(JSON.stringify(newFeatureCollection));
        mockSelect.mockResolvedValueOnce('property2');
        mockSelect.mockResolvedValueOnce('property3');
        
        // Import zones
        const importZonesTask = new ImportZonesFromGeojson();
        await importZonesTask.run({ ['zones-file']: file, shortname: dataSources[0].shortname, name: dataSources[0].name });

        // A new data source should have been created, with 2 new zones and no prompt for properties as there is only one
        expect(mockDsCreate).not.toHaveBeenCalled();
        expect(mockDeleteForDsId).toHaveBeenCalledWith(dataSources[0].id);
        const expectedAttributeChoices = [{
            name: `property1 (${newFeatureCollection.features[0].properties.property1})`,
            value: 'property1'
        }, {
            name: `property2 (${newFeatureCollection.features[0].properties.property2})`,
            value: 'property2'
        }, {
            name: `property3 (${newFeatureCollection.features[0].properties.property3})`,
            value: 'property3'
        }];
        expect(mockSelect).toHaveBeenCalledTimes(2);
        expect(mockSelect).toHaveBeenNthCalledWith(1, expect.objectContaining({
            choices: expectedAttributeChoices
        }));
        expect(mockSelect).toHaveBeenNthCalledWith(2, expect.objectContaining({
            choices: expectedAttributeChoices
        }));

        expect(mockCreateMultiple).toHaveBeenCalledWith([expect.objectContaining({
            id: expect.anything(),
            internal_id: undefined,
            shortname: newFeatureCollection.features[0].properties.property2,
            name: newFeatureCollection.features[0].properties.property3,
            geography: newFeatureCollection.features[0].geometry,
            dataSourceId: dataSources[0].id,
            data: newFeatureCollection.features[0].properties
        }), expect.objectContaining({
            id: expect.anything(),
            internal_id: '3',
            shortname: newFeatureCollection.features[1].properties.property2,
            name: newFeatureCollection.features[1].properties.property3,
            geography: newFeatureCollection.features[1].geometry,
            dataSourceId: dataSources[0].id,
            data: newFeatureCollection.features[1].properties
        })]);

    });

    test('File and data source parameters, data source exists, many features properties, no strings', async () => {
        // Prepare test data
        mockDsCollection.mockResolvedValueOnce(dataSources);
        const newFeatureCollection = {
            type: 'FeatureCollection',
            features: featureCollection.features.map((feature, idx) => ({
                ...feature,
                properties: {
                    property1: [1, 3],
                    property2: { subProperty: 'abc' },
                    property3: 3
                }
            }))
        };
        mockReadFile.mockReturnValueOnce(JSON.stringify(newFeatureCollection));
        mockSelect.mockResolvedValueOnce('property3');
        mockSelect.mockResolvedValueOnce('property1');
        
        // Import zones
        const importZonesTask = new ImportZonesFromGeojson();
        await importZonesTask.run({ ['zones-file']: file, shortname: dataSources[0].shortname, name: dataSources[0].name });

        // A new data source should have been created, with 2 new zones and no prompt for properties as there is only one
        expect(mockDsCreate).not.toHaveBeenCalled();
        expect(mockDeleteForDsId).toHaveBeenCalledWith(dataSources[0].id);
        const expectedAttributeChoices = [{
            name: `property1 (${newFeatureCollection.features[0].properties.property1})`,
            value: 'property1'
        }, {
            name: `property2 (${newFeatureCollection.features[0].properties.property2})`,
            value: 'property2'
        }, {
            name: `property3 (${newFeatureCollection.features[0].properties.property3})`,
            value: 'property3'
        }];
        expect(mockSelect).toHaveBeenCalledTimes(2);
        expect(mockSelect).toHaveBeenNthCalledWith(1, expect.objectContaining({
            choices: expectedAttributeChoices
        }));
        expect(mockSelect).toHaveBeenNthCalledWith(2, expect.objectContaining({
            choices: expectedAttributeChoices
        }));

        expect(mockCreateMultiple).toHaveBeenCalledWith([expect.objectContaining({
            id: expect.anything(),
            internal_id: undefined,
            shortname: String(newFeatureCollection.features[0].properties.property3),
            name: String(newFeatureCollection.features[0].properties.property1),
            geography: newFeatureCollection.features[0].geometry,
            dataSourceId: dataSources[0].id,
            data: newFeatureCollection.features[0].properties
        }), expect.objectContaining({
            id: expect.anything(),
            internal_id: '3',
            shortname: String(newFeatureCollection.features[1].properties.property3),
            name: String(newFeatureCollection.features[1].properties.property1),
            geography: newFeatureCollection.features[1].geometry,
            dataSourceId: dataSources[0].id,
            data: newFeatureCollection.features[1].properties
        })]);

    });
})
