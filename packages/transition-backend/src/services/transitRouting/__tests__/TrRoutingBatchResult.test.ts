/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import { ObjectWritableMock } from 'stream-mock';


import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { simplePathResult } from './TrRoutingResultStub';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { createRoutingFileResultProcessor } from '../TrRoutingBatchResult';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import { getDefaultCsvAttributes, getDefaultStepsAttributes } from '../ResultAttributes';

const absoluteDir = `${directoryManager.userDataDirectory}/1/exports`;

let fileStreams: {[key: string]: ObjectWritableMock } = {};
const mockCreateStream = jest.fn().mockImplementation((filename: string) => {
    fileStreams[filename] = new ObjectWritableMock();
    return fileStreams[filename];
});

jest.mock('fs', () => {
    // Require the original module to not be mocked...
    const originalModule = jest.requireActual('fs');

    return {
        ...originalModule,
        createWriteStream: (fileName: string) => mockCreateStream(fileName)
    };
});

const odTrip = new BaseOdTrip({
    internal_id: '1',
    origin_geography: { type: 'Point' as const, coordinates: [ -73, 45 ]},
    destination_geography: { type: 'Point' as const, coordinates: [ -73.1002, 45.1002 ]},
    timeOfTrip: 8000,
    timeType: 'departure'
});

const defaultParameters = {
    calculationName: 'test',
    csvFile: { location: 'upload' as const, filename: 'input.csv' },
    projection: 'test',
    idAttribute: 'id',
    originXAttribute: 'origX',
    originYAttribute: 'origX',
    destinationXAttribute: 'origX',
    destinationYAttribute: 'origX',
    timeAttributeDepartureOrArrival: 'departure' as const,
    timeFormat: 'HMM',
    timeAttribute: 'timeattrib',
    withGeometries: false,
    detailed: false,
    cpuCount: 2,
    saveToDb: false as false
};

const results = {
    csv: ['any,string,not,important'],
    result: new TransitRoutingResult({
        origin: { type: 'Feature' as const, geometry: odTrip.attributes.origin_geography, properties: {} },
        destination: { type: 'Feature' as const, geometry: odTrip.attributes.destination_geography, properties: {} },
        paths: simplePathResult.routes,
        maxWalkingTime: 300
    })
}

const resetFileStreams = () => {
    mockCreateStream.mockClear();
    fileStreams = {};
}

const CSV_FILE_NAME = 'batchRoutingResults.csv';
const DETAILED_CSV_FILE_NAME = 'batchRoutingDetailedResults.csv';
const GEOMETRY_FILE_NAME = 'batchRoutingGeometryResults.geojson';
const inputFileName = 'input.csv';

const getCsvFile = () => {
    const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith(CSV_FILE_NAME));
    expect(csvFileName).toBeDefined();
    return fileStreams[csvFileName as string];
}

const getDetailedCsvFile = () => {
    const fileName = Object.keys(fileStreams).find(filename => filename.endsWith(DETAILED_CSV_FILE_NAME));
    expect(fileName).toBeDefined();
    return fileStreams[fileName as string];
}

const getGeojsonFile = () => {
    const fileName = Object.keys(fileStreams).find(filename => filename.endsWith(GEOMETRY_FILE_NAME));
    expect(fileName).toBeDefined();
    return fileStreams[fileName as string];
}

const testRoutingModes = ['walking' as const, 'transit' as const];
describe('Only CSV results', () => {
    let resultProcessor;

    beforeAll(() => {
        resetFileStreams();
        resultProcessor = createRoutingFileResultProcessor(absoluteDir, Object.assign({}, defaultParameters, { detailed: false, withGeometry: false }), new TransitRouting({ routingModes: testRoutingModes }), inputFileName);
    })

    test('File initialization', () => {
        expect(mockCreateStream).toHaveBeenCalledTimes(1);

        // Only 1 stream should have been created
        expect(Object.keys(fileStreams).length).toEqual(1);
        const csvStream = getCsvFile();

        // Make sure file header is correct
        expect(csvStream.data.length).toEqual(1);
        expect(csvStream.data[0]).toEqual(Object.keys(getDefaultCsvAttributes(testRoutingModes)).join(',') + '\n');
    });

    test('get files', () => {
        expect(resultProcessor.getFiles()).toEqual({ input: inputFileName, csv: CSV_FILE_NAME, detailed: undefined, geojson: undefined });
    });

    test('Process results', () => {
        resultProcessor.processResult(results);
        const csvStream = getCsvFile();

        // Check the data that was appended
        expect(csvStream.data.length).toEqual(2);
        expect(csvStream.data[1]).toEqual(results.csv[0] + '\n');
    });

    test('Process invalid results', () => {
        resultProcessor.processResult({});
        const csvStream = getCsvFile();

        // Check that no other data was appended
        expect(csvStream.data.length).toEqual(2);

    });

    test('End', () => {
        const csvStream = getCsvFile();
        expect(csvStream.writableEnded).toBeFalsy();

        resultProcessor.end();
        expect(csvStream.writableEnded).toBeTruthy();
        expect(resultProcessor.getFiles()).toEqual({ input: inputFileName, csv: CSV_FILE_NAME, detailed: undefined, geojson: undefined });
    })
});

describe('CSV and detailed results', () => {
    let resultProcessor;
    beforeAll(() => {
        resetFileStreams();
        resultProcessor = createRoutingFileResultProcessor(absoluteDir, Object.assign({}, defaultParameters, { detailed: true, withGeometry: false }), new TransitRouting({ routingModes: testRoutingModes }), inputFileName);
    })

    test('File initialization', () => {
        expect(mockCreateStream).toHaveBeenCalledTimes(2);

        // 2 streams should have been created
        expect(Object.keys(fileStreams).length).toEqual(2);
        const csvStream = getCsvFile();
        const detailedStream = getDetailedCsvFile();

        // Make sure file header is correct
        expect(csvStream.data.length).toEqual(1);
        expect(csvStream.data[0]).toEqual(Object.keys(getDefaultCsvAttributes(testRoutingModes)).join(',') + '\n');

        expect(detailedStream.data.length).toEqual(1);
        expect(detailedStream.data[0]).toEqual(Object.keys(getDefaultStepsAttributes()).join(',') + '\n');
        
    });

    test('get files', () => {
        expect(resultProcessor.getFiles()).toEqual({ input: expect.anything(), csv: CSV_FILE_NAME, detailedCsv: DETAILED_CSV_FILE_NAME, geojson: undefined });
    });

    test('Process results', () => {
        const detailedResults = ['csv,for,first,step','csv,for,second,step'];
        const resultsWithDetailed = Object.assign({}, results, {csvDetailed: detailedResults});
        resultProcessor.processResult(resultsWithDetailed);
        const csvStream = getCsvFile();
        const detailedStream = getDetailedCsvFile();

        // Check the data that was appended
        expect(csvStream.data.length).toEqual(2);
        expect(csvStream.data[1]).toEqual(results.csv[0] + '\n');

        expect(detailedStream.data.length).toEqual(2);
        expect(detailedStream.data[1]).toEqual(detailedResults[0] + '\n' + detailedResults[1] + '\n');
    });

    test('Process invalid results', () => {
        // No detailed results
        resultProcessor.processResult(results);
        const detailedStream = getDetailedCsvFile();

        // Check that no other data was appended
        expect(detailedStream.data.length).toEqual(2);
    });

    test('End', () => {
        const csvStream = getCsvFile();
        const detailedStream = getDetailedCsvFile();
        expect(csvStream.writableEnded).toBeFalsy();
        expect(detailedStream.writableEnded).toBeFalsy();

        resultProcessor.end();
        expect(csvStream.writableEnded).toBeTruthy();
        expect(detailedStream.writableEnded).toBeTruthy();
        expect(resultProcessor.getFiles()).toEqual({ input: expect.anything(), csv: CSV_FILE_NAME, detailedCsv: DETAILED_CSV_FILE_NAME, geojson: undefined });
    })
});


describe('CSV and geojson results', () => {
    let resultProcessor;
    beforeAll(() => {
        resetFileStreams();
        resultProcessor = createRoutingFileResultProcessor(absoluteDir, Object.assign({}, defaultParameters, { detailed: false, withGeometries: true }), new TransitRouting({ routingModes: testRoutingModes }), inputFileName);
    })

    test('File initialization', () => {
        expect(mockCreateStream).toHaveBeenCalledTimes(2);

        // 2 streams should have been created
        expect(Object.keys(fileStreams).length).toEqual(2);
        const csvStream = getCsvFile();
        const geojsonStream = getGeojsonFile();

        // Make sure file header is correct
        expect(csvStream.data.length).toEqual(1);
        expect(csvStream.data[0]).toEqual(Object.keys(getDefaultCsvAttributes(testRoutingModes)).join(',') + '\n');

        expect(geojsonStream.data.length).toEqual(1);
        expect(geojsonStream.data[0]).toEqual('{ "type": "FeatureCollection", "features": [');
        
    });

    test('get files', () => {
        expect(resultProcessor.getFiles()).toEqual({ input: expect.anything(), csv: CSV_FILE_NAME, detailedCsv: undefined, geojson: GEOMETRY_FILE_NAME });
    });

    test('Process results', () => {
        // Just add any geojson feature, taken from the data we already have
        const features = [odTrip.attributes.origin_geography, odTrip.attributes.destination_geography];
        const resultsWithGeometries = Object.assign({}, results, {geometries: features});
        resultProcessor.processResult(resultsWithGeometries);
        const csvStream = getCsvFile();
        const geojsonStream = getGeojsonFile();

        // Check the data that was appended
        expect(csvStream.data.length).toEqual(2);
        expect(csvStream.data[1]).toEqual(results.csv[0] + '\n');

        expect(geojsonStream.data.length).toEqual(2);
        expect(geojsonStream.data[1]).toEqual(`\n${JSON.stringify(features[0])},\n${JSON.stringify(features[1])}`);

        // Process the results a second time to make sure a comma was added
        resultProcessor.processResult(resultsWithGeometries);
        expect(geojsonStream.data.length).toEqual(3);
        expect(geojsonStream.data[2]).toEqual(`,\n${JSON.stringify(features[0])},\n${JSON.stringify(features[1])}`);
    });

    test('Process invalid results', () => {
        // No geometries results
        resultProcessor.processResult(results);
        const geojsonStream = getGeojsonFile();

        // Check that no other data was appended
        expect(geojsonStream.data.length).toEqual(3);
    });

    test('End', () => {
        const csvStream = getCsvFile();
        const geojsonStream = getGeojsonFile();
        expect(csvStream.writableEnded).toBeFalsy();
        expect(geojsonStream.writableEnded).toBeFalsy();
        
        resultProcessor.end();
        expect(csvStream.writableEnded).toBeTruthy();
        expect(geojsonStream.writableEnded).toBeTruthy();
        expect(resultProcessor.getFiles()).toEqual({ input: expect.anything(), csv: CSV_FILE_NAME, detailedCsv: undefined, geojson: GEOMETRY_FILE_NAME });

        // make sure the geojson content is valid geojson
        const geojsonString = geojsonStream.data.join('');
        const geojsonObj = JSON.parse(geojsonString);
        expect(geojsonObj.type).toEqual('FeatureCollection');
        expect(geojsonObj.features.length).toEqual(4);
    })
});