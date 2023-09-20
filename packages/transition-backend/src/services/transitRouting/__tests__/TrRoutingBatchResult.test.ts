/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { ObjectWritableMock } from 'stream-mock';


import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { simplePathResult, transferPathResult, alternativesResult, walkingRouteResult, cyclingRouteResult } from './TrRoutingResultStub';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { createRoutingFileResultProcessor, generateFileOutputResults } from '../TrRoutingBatchResult';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import { getDefaultCsvAttributes, getDefaultStepsAttributes } from '../ResultAttributes';
import { routeToUserObject, TrRoutingBoardingStep, TrRoutingUnboardingStep, TrRoutingWalkingStep } from 'chaire-lib-common/src/services/trRouting/TrRoutingResultConversion';
import { UnimodalRouteCalculationResult } from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import Path from 'transition-common/lib/services/path/Path';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ErrorCodes } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';


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
describe('File generator: Only CSV results', () => {
    let resultProcessor;

    beforeAll(() => {
        resetFileStreams();
        resultProcessor = createRoutingFileResultProcessor(absoluteDir, defaultParameters, { routingModes: testRoutingModes, detailed: false, withGeometries: false }, inputFileName);
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

describe('File generator: CSV and detailed results', () => {
    let resultProcessor;
    beforeAll(() => {
        resetFileStreams();
        resultProcessor = createRoutingFileResultProcessor(absoluteDir, defaultParameters, { routingModes: testRoutingModes, detailed: true, withGeometries: false }, inputFileName);
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


describe('File generator: CSV and geojson results', () => {
    let resultProcessor;
    beforeAll(() => {
        resetFileStreams();
        resultProcessor = createRoutingFileResultProcessor(absoluteDir, defaultParameters, { routingModes: testRoutingModes, detailed: false, withGeometries: true }, inputFileName);
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

const origin = simplePathResult.routes[0].originDestination[0];
const destination = simplePathResult.routes[0].originDestination[1];
const internalId = 'test';
const odTripWithResult = new BaseOdTrip({
    origin_geography: origin.geometry,
    destination_geography: destination.geometry,
    internal_id: internalId,
    timeOfTrip: 28000,
    timeType: 'departure'
}, false);

describe('Generate CSV results only', () => {

    test('One mode', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any);
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(0);
        expect(csv).toBeDefined();
        expect((csv as string[]).length).toEqual(1);
        expect((csv as string[])[0]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},` +
            `${expectedUserResult.origin[1]},${expectedUserResult.origin[0]},` +
            `${expectedUserResult.destination[1]},${expectedUserResult.destination[0]},` +
            `1,1,success,${expectedUserResult.departureTime},` +
            `${expectedUserResult.departureTimeSeconds},${expectedUserResult.arrivalTime},${expectedUserResult.arrivalTimeSeconds},` +
            `${expectedUserResult.initialDepartureTime},${expectedUserResult.initialDepartureTimeSeconds},${expectedUserResult.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResult.initialLostTimeAtDepartureSeconds},${expectedUserResult.totalTravelTimeMinutes},${expectedUserResult.totalTravelTimeSeconds},` +
            `${expectedUserResult.totalDistanceMeters},${expectedUserResult.totalInVehicleTimeMinutes},${expectedUserResult.totalInVehicleTimeSeconds},` +
            `${expectedUserResult.totalInVehicleDistanceMeters},${expectedUserResult.totalNonTransitTravelTimeMinutes},${expectedUserResult.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResult.totalNonTransitDistanceMeters},${expectedUserResult.numberOfBoardings},${expectedUserResult.numberOfTransfers},` +
            `${expectedUserResult.transferWalkingTimeMinutes},${expectedUserResult.transferWalkingTimeSeconds},${expectedUserResult.transferWalkingDistanceMeters},` +
            `${expectedUserResult.accessTravelTimeMinutes},${expectedUserResult.accessTravelTimeSeconds},${expectedUserResult.accessDistanceMeters},` +
            `${expectedUserResult.egressTravelTimeMinutes},${expectedUserResult.egressTravelTimeSeconds},${expectedUserResult.egressDistanceMeters},` +
            `${expectedUserResult.transferWaitingTimeMinutes},` +
            `${expectedUserResult.transferWaitingTimeSeconds},${expectedUserResult.firstWaitingTimeMinutes},${expectedUserResult.firstWaitingTimeSeconds},` +
            `${expectedUserResult.totalWaitingTimeMinutes},${expectedUserResult.totalWaitingTimeSeconds},` +
            `${(expectedUserResult.steps[1] as any).lineUuid},${(expectedUserResult.steps[1] as any).mode},access210s262m|wait180s|ride391s1426m|egress753s998m`
        );
    });

    test('Multiple modes', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any);
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(0);
        expect(csv).toBeDefined();
        expect((csv as string[]).length).toEqual(1);
        expect((csv as string[])[0]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},` + 
            `${expectedUserResult.origin[1]},${expectedUserResult.origin[0]},` +
            `${expectedUserResult.destination[1]},${expectedUserResult.destination[0]},` +
            `1,1,success,${expectedUserResult.departureTime},` +
            `${expectedUserResult.departureTimeSeconds},${expectedUserResult.arrivalTime},${expectedUserResult.arrivalTimeSeconds},` +
            `${expectedUserResult.initialDepartureTime},${expectedUserResult.initialDepartureTimeSeconds},${expectedUserResult.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResult.initialLostTimeAtDepartureSeconds},${expectedUserResult.totalTravelTimeMinutes},${expectedUserResult.totalTravelTimeSeconds},` +
            `${expectedUserResult.totalDistanceMeters},${expectedUserResult.totalInVehicleTimeMinutes},${expectedUserResult.totalInVehicleTimeSeconds},` +
            `${expectedUserResult.totalInVehicleDistanceMeters},${expectedUserResult.totalNonTransitTravelTimeMinutes},${expectedUserResult.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResult.totalNonTransitDistanceMeters},${expectedUserResult.numberOfBoardings},${expectedUserResult.numberOfTransfers},` +
            `${expectedUserResult.transferWalkingTimeMinutes},${expectedUserResult.transferWalkingTimeSeconds},${expectedUserResult.transferWalkingDistanceMeters},` +
            `${expectedUserResult.accessTravelTimeMinutes},${expectedUserResult.accessTravelTimeSeconds},${expectedUserResult.accessDistanceMeters},` +
            `${expectedUserResult.egressTravelTimeMinutes},${expectedUserResult.egressTravelTimeSeconds},${expectedUserResult.egressDistanceMeters},` +
            `${expectedUserResult.transferWaitingTimeMinutes},` +
            `${expectedUserResult.transferWaitingTimeSeconds},${expectedUserResult.firstWaitingTimeMinutes},${expectedUserResult.firstWaitingTimeSeconds},` +
            `${expectedUserResult.totalWaitingTimeMinutes},${expectedUserResult.totalWaitingTimeSeconds},` +
            `${(expectedUserResult.steps[1] as any).lineUuid},${(expectedUserResult.steps[1] as any).mode},access210s262m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
    });

    test('With alternatives', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: alternativesResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any);
        const expectedUserResult = routeToUserObject(alternativesResult.routes[0]);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(0);
        expect(csv).toBeDefined();
        expect((csv as string[]).length).toEqual(2);
        expect((csv as string[])[0]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},` +
            `${expectedUserResult.origin[1]},${expectedUserResult.origin[0]},` +
            `${expectedUserResult.destination[1]},${expectedUserResult.destination[0]},` +
            `1,2,success,${expectedUserResult.departureTime},` +
            `${expectedUserResult.departureTimeSeconds},${expectedUserResult.arrivalTime},${expectedUserResult.arrivalTimeSeconds},` +
            `${expectedUserResult.initialDepartureTime},${expectedUserResult.initialDepartureTimeSeconds},${expectedUserResult.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResult.initialLostTimeAtDepartureSeconds},${expectedUserResult.totalTravelTimeMinutes},${expectedUserResult.totalTravelTimeSeconds},` +
            `${expectedUserResult.totalDistanceMeters},${expectedUserResult.totalInVehicleTimeMinutes},${expectedUserResult.totalInVehicleTimeSeconds},` +
            `${expectedUserResult.totalInVehicleDistanceMeters},${expectedUserResult.totalNonTransitTravelTimeMinutes},${expectedUserResult.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResult.totalNonTransitDistanceMeters},${expectedUserResult.numberOfBoardings},${expectedUserResult.numberOfTransfers},` +
            `${expectedUserResult.transferWalkingTimeMinutes},${expectedUserResult.transferWalkingTimeSeconds},${expectedUserResult.transferWalkingDistanceMeters},` +
            `${expectedUserResult.accessTravelTimeMinutes},${expectedUserResult.accessTravelTimeSeconds},${expectedUserResult.accessDistanceMeters},` +
            `${expectedUserResult.egressTravelTimeMinutes},${expectedUserResult.egressTravelTimeSeconds},${expectedUserResult.egressDistanceMeters},` +
            `${expectedUserResult.transferWaitingTimeMinutes},` +
            `${expectedUserResult.transferWaitingTimeSeconds},${expectedUserResult.firstWaitingTimeMinutes},${expectedUserResult.firstWaitingTimeSeconds},` +
            `${expectedUserResult.totalWaitingTimeMinutes},${expectedUserResult.totalWaitingTimeSeconds},` +
            `${(expectedUserResult.steps[1] as any).lineUuid},${(expectedUserResult.steps[1] as any).mode},access210s262m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
        const expectedUserResultAlt = routeToUserObject(alternativesResult.routes[1]);
        expect((csv as string[])[1]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},` +
            `${expectedUserResultAlt.origin[1]},${expectedUserResultAlt.origin[0]},` +
            `${expectedUserResultAlt.destination[1]},${expectedUserResultAlt.destination[0]},` +
            `2,2,success,${expectedUserResultAlt.departureTime},` +
            `${expectedUserResultAlt.departureTimeSeconds},${expectedUserResultAlt.arrivalTime},${expectedUserResultAlt.arrivalTimeSeconds},` +
            `${expectedUserResultAlt.initialDepartureTime},${expectedUserResultAlt.initialDepartureTimeSeconds},${expectedUserResultAlt.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResultAlt.initialLostTimeAtDepartureSeconds},${expectedUserResultAlt.totalTravelTimeMinutes},${expectedUserResultAlt.totalTravelTimeSeconds},` +
            `${expectedUserResultAlt.totalDistanceMeters},${expectedUserResultAlt.totalInVehicleTimeMinutes},${expectedUserResultAlt.totalInVehicleTimeSeconds},` +
            `${expectedUserResultAlt.totalInVehicleDistanceMeters},${expectedUserResultAlt.totalNonTransitTravelTimeMinutes},${expectedUserResultAlt.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResultAlt.totalNonTransitDistanceMeters},${expectedUserResultAlt.numberOfBoardings},${expectedUserResultAlt.numberOfTransfers},` +
            `${expectedUserResultAlt.transferWalkingTimeMinutes},${expectedUserResultAlt.transferWalkingTimeSeconds},${expectedUserResultAlt.transferWalkingDistanceMeters},` +
            `${expectedUserResultAlt.accessTravelTimeMinutes},${expectedUserResultAlt.accessTravelTimeSeconds},${expectedUserResultAlt.accessDistanceMeters},` +
            `${expectedUserResultAlt.egressTravelTimeMinutes},${expectedUserResultAlt.egressTravelTimeSeconds},${expectedUserResultAlt.egressDistanceMeters},` +
            `${expectedUserResultAlt.transferWaitingTimeMinutes},` +
            `${expectedUserResultAlt.transferWaitingTimeSeconds},${expectedUserResultAlt.firstWaitingTimeMinutes},${expectedUserResultAlt.firstWaitingTimeSeconds},` +
            `${expectedUserResultAlt.totalWaitingTimeMinutes},${expectedUserResultAlt.totalWaitingTimeSeconds},` +
            `${(expectedUserResultAlt.steps[1] as any).lineUuid}|${(expectedUserResultAlt.steps[4] as any).lineUuid},` +
            `${(expectedUserResultAlt.steps[1] as any).mode}|${(expectedUserResultAlt.steps[4] as any).mode},` +
            `access210s262m|wait180s|ride391s1426m|transfer753s998m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
    });

    test('No routing found', async () => {
        // Prepare test data
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                ).export()
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(0);
        expect(csv).toBeDefined();
        expect((csv as string[]).length).toEqual(1);
        expect((csv as string[])[0]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},` +
            `${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]},` +
            `${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]},` +
            `,,TRROUTING_NO_ROUTING_FOUND,,` +
            `,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
    });
});

describe('detailed csv only result', () => {

    test('One mode', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: true, withGeometries: false});
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(csv.length).toEqual(1);
        expect(geometries.length).toEqual(0);
        expect((csvDetailed as string[]).length).toEqual(4);
        const accessStep = expectedUserResult.steps[0] as TrRoutingWalkingStep;
        const boardingStep = expectedUserResult.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = expectedUserResult.steps[2] as TrRoutingUnboardingStep;
        const egressStep = expectedUserResult.steps[3] as TrRoutingWalkingStep;
        expect((csvDetailed as string[])[0]).toEqual(`${odTripWithResult.getId()},${internalId},1,1,${expectedUserResult.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((csvDetailed as string[])[1]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,2,${expectedUserResult.steps[1].action},` +
            `,,,` +
            `,${boardingStep.departureTime},,` +
            `${boardingStep.departureTimeSeconds},,` +
            `${boardingStep.agencyAcronym},${boardingStep.agencyName},${boardingStep.agencyUuid},` +
            `${boardingStep.lineShortname},${boardingStep.lineLongname},${boardingStep.lineUuid},` +
            `${boardingStep.pathUuid},${boardingStep.modeName},${boardingStep.mode},` +
            `${boardingStep.tripUuid},,${boardingStep.legSequenceInTrip},` +
            `${boardingStep.stopSequenceInTrip},${boardingStep.nodeName},${boardingStep.nodeCode},` +
            `${boardingStep.nodeUuid},"${boardingStep.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep.waitingTimeSeconds},${boardingStep.waitingTimeMinutes},,` +
            ``
        );
        expect((csvDetailed as string[])[2]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,3,${expectedUserResult.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep.arrivalTime},` +
            `,${unboardingStep.arrivalTimeSeconds},` +
            `${unboardingStep.agencyAcronym},${unboardingStep.agencyName},${unboardingStep.agencyUuid},` +
            `${unboardingStep.lineShortname},${unboardingStep.lineLongname},${unboardingStep.lineUuid},` +
            `${unboardingStep.pathUuid},${unboardingStep.modeName},${unboardingStep.mode},` +
            `${unboardingStep.tripUuid},,${unboardingStep.legSequenceInTrip},` +
            `${unboardingStep.stopSequenceInTrip},${unboardingStep.nodeName},${unboardingStep.nodeCode},` +
            `${unboardingStep.nodeUuid},"${unboardingStep.nodeCoordinates}",${unboardingStep.inVehicleTimeSeconds},` +
            `${unboardingStep.inVehicleTimeMinutes},${unboardingStep.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((csvDetailed as string[])[3]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,4,${expectedUserResult.steps[3].action},` +
            `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
            `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
            `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
    });

    test('Multiple modes', async () => {
        // Detailed steps should be same as single transit mode

        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };

        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: true, withGeometries: false});
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(csv.length).toEqual(1);
        expect(geometries.length).toEqual(0);
        expect((csvDetailed as string[]).length).toEqual(4);
        const accessStep = expectedUserResult.steps[0] as TrRoutingWalkingStep;
        const boardingStep = expectedUserResult.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = expectedUserResult.steps[2] as TrRoutingUnboardingStep;
        const egressStep = expectedUserResult.steps[3] as TrRoutingWalkingStep;
        expect((csvDetailed as string[])[0]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,1,${expectedUserResult.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((csvDetailed as string[])[1]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,2,${expectedUserResult.steps[1].action},` +
            `,,,` +
            `,${boardingStep.departureTime},,` +
            `${boardingStep.departureTimeSeconds},,` +
            `${boardingStep.agencyAcronym},${boardingStep.agencyName},${boardingStep.agencyUuid},` +
            `${boardingStep.lineShortname},${boardingStep.lineLongname},${boardingStep.lineUuid},` +
            `${boardingStep.pathUuid},${boardingStep.modeName},${boardingStep.mode},` +
            `${boardingStep.tripUuid},,${boardingStep.legSequenceInTrip},` +
            `${boardingStep.stopSequenceInTrip},${boardingStep.nodeName},${boardingStep.nodeCode},` +
            `${boardingStep.nodeUuid},"${boardingStep.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep.waitingTimeSeconds},${boardingStep.waitingTimeMinutes},,` +
            ``
        );
        expect((csvDetailed as string[])[2]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,3,${expectedUserResult.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep.arrivalTime},` +
            `,${unboardingStep.arrivalTimeSeconds},` +
            `${unboardingStep.agencyAcronym},${unboardingStep.agencyName},${unboardingStep.agencyUuid},` +
            `${unboardingStep.lineShortname},${unboardingStep.lineLongname},${unboardingStep.lineUuid},` +
            `${unboardingStep.pathUuid},${unboardingStep.modeName},${unboardingStep.mode},` +
            `${unboardingStep.tripUuid},,${unboardingStep.legSequenceInTrip},` +
            `${unboardingStep.stopSequenceInTrip},${unboardingStep.nodeName},${unboardingStep.nodeCode},` +
            `${unboardingStep.nodeUuid},"${unboardingStep.nodeCoordinates}",${unboardingStep.inVehicleTimeSeconds},` +
            `${unboardingStep.inVehicleTimeMinutes},${unboardingStep.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((csvDetailed as string[])[3]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,4,${expectedUserResult.steps[3].action},` +
            `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
            `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
            `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
    });

    test('With alternatives', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: alternativesResult.routes,
                maxWalkingTime: 300
            })
        };

        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: true, withGeometries: false});
        expect(csv.length).toEqual(2);
        expect(geometries.length).toEqual(0);
        expect(csvDetailed.length).toEqual(11);

        // Validate first path
        const expectedUserResult = routeToUserObject(alternativesResult.routes[0]);
        const accessStep = expectedUserResult.steps[0] as TrRoutingWalkingStep;
        const boardingStep = expectedUserResult.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = expectedUserResult.steps[2] as TrRoutingUnboardingStep;
        const egressStep = expectedUserResult.steps[3] as TrRoutingWalkingStep;
        expect((csvDetailed as string[])[0]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,1,${expectedUserResult.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((csvDetailed as string[])[1]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,2,${expectedUserResult.steps[1].action},` +
            `,,,` +
            `,${boardingStep.departureTime},,` +
            `${boardingStep.departureTimeSeconds},,` +
            `${boardingStep.agencyAcronym},${boardingStep.agencyName},${boardingStep.agencyUuid},` +
            `${boardingStep.lineShortname},${boardingStep.lineLongname},${boardingStep.lineUuid},` +
            `${boardingStep.pathUuid},${boardingStep.modeName},${boardingStep.mode},` +
            `${boardingStep.tripUuid},,${boardingStep.legSequenceInTrip},` +
            `${boardingStep.stopSequenceInTrip},${boardingStep.nodeName},${boardingStep.nodeCode},` +
            `${boardingStep.nodeUuid},"${boardingStep.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep.waitingTimeSeconds},${boardingStep.waitingTimeMinutes},,` +
            ``
        );
        expect((csvDetailed as string[])[2]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,3,${expectedUserResult.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep.arrivalTime},` +
            `,${unboardingStep.arrivalTimeSeconds},` +
            `${unboardingStep.agencyAcronym},${unboardingStep.agencyName},${unboardingStep.agencyUuid},` +
            `${unboardingStep.lineShortname},${unboardingStep.lineLongname},${unboardingStep.lineUuid},` +
            `${unboardingStep.pathUuid},${unboardingStep.modeName},${unboardingStep.mode},` +
            `${unboardingStep.tripUuid},,${unboardingStep.legSequenceInTrip},` +
            `${unboardingStep.stopSequenceInTrip},${unboardingStep.nodeName},${unboardingStep.nodeCode},` +
            `${unboardingStep.nodeUuid},"${unboardingStep.nodeCoordinates}",${unboardingStep.inVehicleTimeSeconds},` +
            `${unboardingStep.inVehicleTimeMinutes},${unboardingStep.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((csvDetailed as string[])[3]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},1,4,${expectedUserResult.steps[3].action},` +
        `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
        `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
        `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
        `,,,,,,,,,,,,,,,,,,,,,,,,`
        );

        // Validate second path, with transfer steps
        const expectedUserResultAlt = routeToUserObject(alternativesResult.routes[1]);
        const accessStepSeq2 = expectedUserResultAlt.steps[0] as TrRoutingWalkingStep;
        const boardingStep1Seq2 = expectedUserResultAlt.steps[1] as TrRoutingBoardingStep;
        const unboardingStep1Seq2 = expectedUserResultAlt.steps[2] as TrRoutingUnboardingStep;
        const transferStep = expectedUserResultAlt.steps[3] as TrRoutingWalkingStep;
        const boardingStep2Seq2 = expectedUserResultAlt.steps[4] as TrRoutingBoardingStep;
        const unboardingStep2Seq2 = expectedUserResultAlt.steps[5] as TrRoutingUnboardingStep;
        const egressStepSeq2 = expectedUserResultAlt.steps[6] as TrRoutingWalkingStep;
        expect((csvDetailed as string[])[4]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,1,${expectedUserResultAlt.steps[0].action},` +
            `${accessStepSeq2.type},${accessStepSeq2.travelTimeSeconds},${accessStepSeq2.travelTimeMinutes},` +
            `${accessStepSeq2.distanceMeters},${accessStepSeq2.departureTime},${accessStepSeq2.arrivalTime},` +
            `${accessStepSeq2.departureTimeSeconds},${accessStepSeq2.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStepSeq2.readyToBoardAt},${accessStepSeq2.readyToBoardAtSeconds}`
        );
        expect((csvDetailed as string[])[5]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,2,${expectedUserResultAlt.steps[1].action},` +
            `,,,` +
            `,${boardingStep1Seq2.departureTime},,` +
            `${boardingStep1Seq2.departureTimeSeconds},,` +
            `${boardingStep1Seq2.agencyAcronym},${boardingStep1Seq2.agencyName},${boardingStep1Seq2.agencyUuid},` +
            `${boardingStep1Seq2.lineShortname},${boardingStep1Seq2.lineLongname},${boardingStep1Seq2.lineUuid},` +
            `${boardingStep1Seq2.pathUuid},${boardingStep1Seq2.modeName},${boardingStep1Seq2.mode},` +
            `${boardingStep1Seq2.tripUuid},,${boardingStep1Seq2.legSequenceInTrip},` +
            `${boardingStep1Seq2.stopSequenceInTrip},${boardingStep1Seq2.nodeName},${boardingStep1Seq2.nodeCode},` +
            `${boardingStep1Seq2.nodeUuid},"${boardingStep1Seq2.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep1Seq2.waitingTimeSeconds},${boardingStep1Seq2.waitingTimeMinutes},,` +
            ``
        );
        expect((csvDetailed as string[])[6]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,3,${expectedUserResultAlt.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep1Seq2.arrivalTime},` +
            `,${unboardingStep1Seq2.arrivalTimeSeconds},` +
            `${unboardingStep1Seq2.agencyAcronym},${unboardingStep1Seq2.agencyName},${unboardingStep1Seq2.agencyUuid},` +
            `${unboardingStep1Seq2.lineShortname},${unboardingStep1Seq2.lineLongname},${unboardingStep1Seq2.lineUuid},` +
            `${unboardingStep1Seq2.pathUuid},${unboardingStep1Seq2.modeName},${unboardingStep1Seq2.mode},` +
            `${unboardingStep1Seq2.tripUuid},,${unboardingStep1Seq2.legSequenceInTrip},` +
            `${unboardingStep1Seq2.stopSequenceInTrip},${unboardingStep1Seq2.nodeName},${unboardingStep1Seq2.nodeCode},` +
            `${unboardingStep1Seq2.nodeUuid},"${unboardingStep1Seq2.nodeCoordinates}",${unboardingStep1Seq2.inVehicleTimeSeconds},` +
            `${unboardingStep1Seq2.inVehicleTimeMinutes},${unboardingStep1Seq2.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((csvDetailed as string[])[7]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,4,${expectedUserResultAlt.steps[3].action},` +
            `${transferStep.type},${transferStep.travelTimeSeconds},${transferStep.travelTimeMinutes},` +
            `${transferStep.distanceMeters},${transferStep.departureTime},${transferStep.arrivalTime},` +
            `${transferStep.departureTimeSeconds},${transferStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,${transferStep.readyToBoardAt},${transferStep.readyToBoardAtSeconds}`
        );
        expect((csvDetailed as string[])[8]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,5,${expectedUserResultAlt.steps[4].action},` +
            `,,,` +
            `,${boardingStep2Seq2.departureTime},,` +
            `${boardingStep2Seq2.departureTimeSeconds},,` +
            `${boardingStep2Seq2.agencyAcronym},${boardingStep2Seq2.agencyName},${boardingStep2Seq2.agencyUuid},` +
            `${boardingStep2Seq2.lineShortname},${boardingStep2Seq2.lineLongname},${boardingStep2Seq2.lineUuid},` +
            `${boardingStep2Seq2.pathUuid},${boardingStep2Seq2.modeName},${boardingStep2Seq2.mode},` +
            `${boardingStep2Seq2.tripUuid},,${boardingStep2Seq2.legSequenceInTrip},` +
            `${boardingStep2Seq2.stopSequenceInTrip},${boardingStep2Seq2.nodeName},${boardingStep2Seq2.nodeCode},` +
            `${boardingStep2Seq2.nodeUuid},"${boardingStep2Seq2.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep2Seq2.waitingTimeSeconds},${boardingStep2Seq2.waitingTimeMinutes},,` +
            ``
        );
        expect((csvDetailed as string[])[9]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,6,${expectedUserResultAlt.steps[5].action},` +
            `,,,` +
            `,,${unboardingStep2Seq2.arrivalTime},` +
            `,${unboardingStep2Seq2.arrivalTimeSeconds},` +
            `${unboardingStep2Seq2.agencyAcronym},${unboardingStep2Seq2.agencyName},${unboardingStep2Seq2.agencyUuid},` +
            `${unboardingStep2Seq2.lineShortname},${unboardingStep2Seq2.lineLongname},${unboardingStep2Seq2.lineUuid},` +
            `${unboardingStep2Seq2.pathUuid},${unboardingStep2Seq2.modeName},${unboardingStep2Seq2.mode},` +
            `${unboardingStep2Seq2.tripUuid},,${unboardingStep2Seq2.legSequenceInTrip},` +
            `${unboardingStep2Seq2.stopSequenceInTrip},${unboardingStep2Seq2.nodeName},${unboardingStep2Seq2.nodeCode},` +
            `${unboardingStep2Seq2.nodeUuid},"${unboardingStep2Seq2.nodeCoordinates}",${unboardingStep2Seq2.inVehicleTimeSeconds},` +
            `${unboardingStep2Seq2.inVehicleTimeMinutes},${unboardingStep2Seq2.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((csvDetailed as string[])[10]).toEqual(`${odTripWithResult.getId()},${odTripWithResult.attributes.internal_id},2,7,${expectedUserResultAlt.steps[6].action},` +
            `${egressStepSeq2.type},${egressStepSeq2.travelTimeSeconds},${egressStepSeq2.travelTimeMinutes},` +
            `${egressStepSeq2.distanceMeters},${egressStepSeq2.departureTime},${egressStepSeq2.arrivalTime},` +
            `${egressStepSeq2.departureTimeSeconds},${egressStepSeq2.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
    });

    test('No routing found', async () => {
        // Prepare test data
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                ).export()
            })
        };
        
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: true, withGeometries: false});
        expect(csv.length).toEqual(1);
        expect(geometries.length).toEqual(0);
        expect(csvDetailed.length).toEqual(0);
    });
    
});

describe('geometries result', () => {

    const path = new Path({
        id: (simplePathResult.routes[0].steps[1] as any).pathUuid,
        geography: {
            type: 'LineString',
            coordinates: [[-73,45], [-73.01,45.001], [-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                [-73.021,45.02], [-73.03,45.04], [-73.03,45.045], [-73.035,45.05], [-73.04,45.06] ]
        },
        direction: 'outbound',
        line_id: (simplePathResult.routes[0].steps[1] as any).lineUuid,
        nodes: ['node1', 'node2', 'node3', 'node4', 'node5', 'node6', 'node7', 'node8'],
        segments: [0, 2, 3, 4, 6, 7, 8, 9],
        data: {}
    }, false);
    const pathCollection = new PathCollection([path.toGeojson()], {});

    test('One mode', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: false, withGeometries: true, pathCollection});
        expect(csv.length).toEqual(1);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(1);
        expect(geometries[0]).toEqual({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                    [-73.021,45.02], [-73.03,45.04], [-73.03,45.045]]
            },
            properties: expect.objectContaining({
                action: 'ride',
                routingMode: 'transit',
                mode: 'bus',
                internalId: odTripWithResult.attributes.internal_id
            })
        });
    });

    test('Multiple modes', async () => {
        // Prepare test data
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: false, withGeometries: true, pathCollection});
        expect(csv.length).toEqual(1);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(3);
        expect(geometries[0]).toEqual({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                    [-73.021,45.02], [-73.03,45.04], [-73.03,45.045]]
            },
            properties: expect.objectContaining({
                action: 'ride',
                routingMode: 'transit',
                mode: 'bus',
                internalId: odTripWithResult.attributes.internal_id
            })
        });
        expect((geometries as GeoJSON.Feature[])[1]).toEqual({
            type: 'Feature',
            geometry: walkingRouteResult.routes[0].geometry,
            properties: expect.objectContaining({
                mode: 'walking',
                routingMode: 'walking'
            })
        });
        expect((geometries as GeoJSON.Feature[])[2]).toEqual({
            type: 'Feature',
            geometry: cyclingRouteResult.routes[0].geometry,
            properties: expect.objectContaining({
                mode: 'cycling',
                routingMode: 'cycling'
            })
        })
    });

    test('No routing found', async () => {
        // Prepare test data
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                ).export()
            })
        };
        
        const { csv, csvDetailed, geometries } = await generateFileOutputResults({
            uuid: odTripWithResult.attributes.id,
            internalId: internalId,
            origin: origin.geometry,
            destination: destination.geometry,
            results: resultByMode

        }, Object.keys(resultByMode) as any, { exportCsv: true, exportDetailed: false, withGeometries: true, pathCollection});
        expect(csv.length).toEqual(1);
        expect(csvDetailed.length).toEqual(0);
        expect(geometries.length).toEqual(0);
    });
});
