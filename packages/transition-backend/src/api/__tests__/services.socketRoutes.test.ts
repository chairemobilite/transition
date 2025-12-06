/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import routes from '../services.socketRoutes';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import osrmService from 'chaire-lib-backend/lib/utils/osrm/OSRMService';
import TestUtils from 'chaire-lib-common/lib/test/TestUtils';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { TrRoutingConstants } from 'chaire-lib-common/lib/api/TrRouting';
import trRoutingService from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';
import { ExecutableJob } from '../../services/executableJob/ExecutableJob';
import jobsDbQueries from '../../models/db/jobs.db.queries';
import Users from 'chaire-lib-backend/lib/services/users/users';
import { TransitAccessibilityMapCalculator } from '../../services/accessibilityMap/TransitAccessibilityMapCalculator';
import { TripRoutingQueryAttributes } from 'chaire-lib-common/src/services/routing/types';
import { CsvFileAndMapping } from 'transition-common/lib/services/csv';

const socketStub = new EventEmitter();
routes(socketStub, 1);

// Mocks for osrm service
jest.mock('chaire-lib-backend/lib/utils/osrm/OSRMService', () => {
    return {
        route: jest.fn(),
        tableFrom: jest.fn(),
        tableTo: jest.fn(),
        match: jest.fn()
    }
});
const mockedRoute = osrmService.route as jest.MockedFunction<typeof osrmService.route>;
const mockedTableFrom = osrmService.tableFrom as jest.MockedFunction<typeof osrmService.tableFrom>;
const mockedTableTo = osrmService.tableTo as jest.MockedFunction<typeof osrmService.tableTo>;
const mockedMatch = osrmService.match as jest.MockedFunction<typeof osrmService.match>;

// mocks for trRouting process manager
jest.mock('chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager', () => {
    return {
        stop: jest.fn(),
        restart: jest.fn(),
        status: jest.fn()
    }
});
const mockedStop = trRoutingProcessManager.stop as jest.MockedFunction<typeof trRoutingProcessManager.stop>;
const mockedRestart = trRoutingProcessManager.restart as jest.MockedFunction<typeof trRoutingProcessManager.restart>;
const mockedStatus = trRoutingProcessManager.status as jest.MockedFunction<typeof trRoutingProcessManager.status>;

jest.mock('../../models/db/jobs.db.queries', () => {
    return {
        create: jest.fn().mockResolvedValue(1)
    }
});
const mockedJobCreate = jobsDbQueries.create as jest.MockedFunction<typeof jobsDbQueries.create>;

jest.mock('../../services/accessibilityMap/TransitAccessibilityMapCalculator', () => ({
    TransitAccessibilityMapCalculator: {
        calculateWithPolygons: jest.fn()
    }
}))
const mockedCalculateMapWithPolygon = TransitAccessibilityMapCalculator.calculateWithPolygons as jest.MockedFunction<typeof TransitAccessibilityMapCalculator.calculateWithPolygons>;

const mockedEnqueue = ExecutableJob.prototype.enqueue = jest.fn().mockResolvedValue(true);
const mockedRefresh = ExecutableJob.prototype.refresh = jest.fn().mockResolvedValue(true);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('osrm service routes', () => {
    // Route and match parameters are the same here for this test
    const routeParameters = {
        mode: 'walking',
        points: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([ -73.1, 45.1 ])],
        withAlternatives: true
    };

    test('Route correctly', (done) => {
        mockedRoute.mockResolvedValueOnce(Status.createOk({ routes: [], waypoints: [] }));
        socketStub.emit('service.osrmRouting.route', routeParameters, (status) => {
            expect(mockedRoute).toHaveBeenCalledWith(routeParameters);
            expect(Status.isStatusOk(status)).toBe(true);
            expect(Status.unwrap(status)).toEqual({
                routes: [], waypoints: []
            });
            done();
        });
    });

    test('Route with error', (done) => {
        const message = 'Error while routing';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedRoute.mockRejectedValueOnce(error);
        socketStub.emit('service.osrmRouting.route', routeParameters, function (status) {
            expect(mockedRoute).toHaveBeenCalledWith(routeParameters);
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

    test('Match correctly', (done) => {
        mockedMatch.mockResolvedValueOnce(Status.createOk({ tracepoints: [], matchings: [] }));
        socketStub.emit('service.osrmRouting.match', routeParameters, (status) => {
            console.log('status of the match', status);
            expect(mockedMatch).toHaveBeenCalledWith(routeParameters);
            expect(Status.isStatusOk(status)).toBe(true);
            expect(Status.unwrap(status)).toEqual({
                tracepoints: [], matchings: []
            });
            done();
        });
    });

    test('Match with error', (done) => {
        const message = 'Error while matching';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedMatch.mockRejectedValueOnce(error);
        socketStub.emit('service.osrmRouting.match', routeParameters, function (status) {
            expect(mockedMatch).toHaveBeenCalledWith(routeParameters);
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });
});

describe('trRouting process manager routes', () => {
    // Parameter to pass to socket route
    const trRoutingParameters = {
        // Can be empty object, only port is required
    };

    test('Stop process correctly', (done) => {
        const stopResponse = { status: 'stopped' };
        mockedStop.mockResolvedValueOnce(stopResponse);
        socketStub.emit('service.trRouting.stop', trRoutingParameters, (response) => {
            expect(mockedStop).toHaveBeenCalledWith(trRoutingParameters);
            expect(response).toEqual(stopResponse);
            done();
        });
    });

    test('Stop process with error', (done) => {
        const message = 'Error stopping process';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedStop.mockRejectedValueOnce(error);
        socketStub.emit('service.trRouting.stop', trRoutingParameters, function (status) {
            expect(mockedStop).toHaveBeenCalledWith(trRoutingParameters);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

    test('Restart process correctly', (done) => {
        const restartResponse = { status: 'started' };
        mockedRestart.mockResolvedValueOnce(restartResponse);
        socketStub.emit('service.trRouting.restart', trRoutingParameters, (response) => {
            expect(mockedRestart).toHaveBeenCalledWith(trRoutingParameters);
            expect(response).toEqual(restartResponse);
            done();
        });
    });

    test('Restart process with error', (done) => {
        const message = 'Error restarting process';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedRestart.mockRejectedValueOnce(error);
        socketStub.emit('service.trRouting.restart', trRoutingParameters, function (status) {
            expect(mockedRestart).toHaveBeenCalledWith(trRoutingParameters);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

    test('Get status correctly', (done) => {
        const statusResponse = {
            status: 'started',
            service: 'trRouting',
            name: 'trRouting'
        };
        mockedStatus.mockResolvedValueOnce(statusResponse);
        socketStub.emit('service.trRouting.status', trRoutingParameters, (response) => {
            expect(mockedStatus).toHaveBeenCalledWith(trRoutingParameters);
            expect(response).toEqual(statusResponse);
            done();
        });
    });

    test('Get status with error', (done) => {
        const message = 'Error getting status';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedStatus.mockRejectedValueOnce(error);
        socketStub.emit('service.trRouting.status', trRoutingParameters, function (status) {
            expect(mockedStatus).toHaveBeenCalledWith(trRoutingParameters);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });
});

describe('trRouting routes', () => {

    // It's a stub call, parameters don't have to be complete
    const demandParameters: CsvFileAndMapping = {
        type: 'csv',
        fileAndMapping: {
            csvFile: { location: 'upload', filename: 'myCoolFile.csv', uploadFilename: 'batchRoute.csv' },
            fieldMappings: {
                id: 'trip_id',
                projection: '4326',
                originLat: 'origin_latitude',
                originLon: 'origin_longitude',
                destinationLat: 'dest_latitude',
                destinationLon: 'dest_longitude'
            }
        },
        csvFields: ['trip_id', 'origin_latitude', 'origin_longitude', 'dest_latitude', 'dest_longitude']
    };

    // It's a stub call, parameters don't have to be complete
    const batchAccessMapParameters = {
        calculationName: 'test',
        cpuCount: 1
    };

    const transitAttributes = {
        minWaitingTimeSeconds: 180,
        scenarioId: 'arbitrary',
        routingModes: ['walking']
    };

    test('Batch route correctly', (done) => {
        mockedEnqueue.mockResolvedValueOnce(true);
        mockedRefresh.mockResolvedValueOnce(true);
        socketStub.emit(TrRoutingConstants.BATCH_ROUTE, demandParameters, transitAttributes, (status) => {
            expect(Status.isStatusOk(status));
            expect(mockedJobCreate).toHaveBeenCalledTimes(1);
            expect(mockedJobCreate).toHaveBeenCalledWith(expect.objectContaining({
                name: 'batchRoute',
                user_id: 1,
                data: {
                    parameters: {
                        demandAttributes: demandParameters.fileAndMapping.fieldMappings,
                        transitRoutingAttributes: transitAttributes
                    }
                }
            }));
            expect(mockedEnqueue).toHaveBeenCalledTimes(1);
            expect(mockedRefresh).toHaveBeenCalledTimes(1);  
            done();
        });
    });

    test('Batch route auto add walking', (done) => {
        const transitAttributesOnlyTransit = {
            minWaitingTimeSeconds: 180,
            scenarioId: 'arbitrary',
            routingModes: ['transit']
        };

        mockedEnqueue.mockResolvedValueOnce(true);
        mockedRefresh.mockResolvedValueOnce(true);
        socketStub.emit(TrRoutingConstants.BATCH_ROUTE, demandParameters, transitAttributesOnlyTransit, (status) => {
            expect(Status.isStatusOk(status));
            expect(mockedJobCreate).toHaveBeenCalledTimes(1);
            expect(mockedJobCreate).toHaveBeenCalledWith(expect.objectContaining({
                name: 'batchRoute',
                user_id: 1,
                data: {
                    parameters: {
                        demandAttributes: demandParameters.fileAndMapping.fieldMappings,
                        transitRoutingAttributes: {
                            minWaitingTimeSeconds: 180,
                            scenarioId: 'arbitrary',
                            routingModes: ['transit','walking']
                        },
                    }
                }
            }));
            expect(mockedEnqueue).toHaveBeenCalledTimes(1);
            expect(mockedRefresh).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('Batch route with error', (done) => {
        const message = 'Error routing batch';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedEnqueue.mockRejectedValueOnce(error);
        socketStub.emit(TrRoutingConstants.BATCH_ROUTE, demandParameters, transitAttributes, function (status) {
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            expect(mockedJobCreate).toHaveBeenCalledTimes(1);
            expect(mockedJobCreate).toHaveBeenCalledWith(expect.objectContaining({
                name: 'batchRoute',
                user_id: 1,
                data: {
                    parameters: {
                        demandAttributes: demandParameters.fileAndMapping.fieldMappings,
                        transitRoutingAttributes: transitAttributes
                    }
                }
            }));
            expect(mockedEnqueue).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('Batch access map correctly', (done) => {
        mockedEnqueue.mockResolvedValueOnce(true);
        mockedRefresh.mockResolvedValueOnce(true);
        socketStub.emit(TrRoutingConstants.BATCH_ACCESS_MAP, batchAccessMapParameters, transitAttributes, (status) => {
            expect(Status.isStatusOk(status));
            expect(mockedJobCreate).toHaveBeenCalledTimes(1);
            expect(mockedJobCreate).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 1,
                name: 'batchAccessMap',
                data: {
                    parameters: {
                        batchAccessMapAttributes: batchAccessMapParameters,
                        accessMapAttributes: transitAttributes
                    }
                }
            }));
            expect(mockedEnqueue).toHaveBeenCalledTimes(1);
            expect(mockedRefresh).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('Batch access map with error', (done) => {
        const message = 'Error calculating batch access map';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedEnqueue.mockRejectedValueOnce(error);
        socketStub.emit(TrRoutingConstants.BATCH_ACCESS_MAP, batchAccessMapParameters, transitAttributes, function (status) {
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            expect(mockedJobCreate).toHaveBeenCalledTimes(1);
            expect(mockedJobCreate).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 1,
                name: 'batchAccessMap',
                data: {
                    parameters: {
                        batchAccessMapAttributes: batchAccessMapParameters,
                        accessMapAttributes: transitAttributes
                    }
                }
            }));
            expect(mockedEnqueue).toHaveBeenCalledTimes(1);
            done();
        });
    });

});

describe('accessibility map calculation routes', () => {

    // Parameter to pass to socket route for `accessibility map`
    const accessibilytMapCalculationAttributes = {
        locationGeojson: TestUtils.makePoint([-73, 45]),
        scenarioId: 'abc',
        id: 'abcdef',
        data: {},
        arrivalTimeSecondsSinceMidnight: 25200,
        maxTotalTravelTimeSeconds: 1800,
        minWaitingTimeSeconds: 120,
        maxAccessEgressTravelTimeSeconds: 180,
        maxTransferTravelTimeSeconds: 120,
        deltaSeconds: 180,
        deltaIntervalSeconds: 60
    };
    const options = {
        port: 4000,
        additionalProperties: { foo: 'bar' }
    }

    test('Accessibility map correct', (done) => {
        const results = {
            polygons: { type: 'FeatureCollection' as const, features: [] },
            strokes: { type: 'FeatureCollection' as const, features: [] },
            resultByNode: undefined
        };
        mockedCalculateMapWithPolygon.mockResolvedValueOnce(results);
        socketStub.emit('accessibiliyMap.calculateWithPolygons', accessibilytMapCalculationAttributes, options, (response) => {
            expect(Status.isStatusOk(response)).toBe(true);
            expect(mockedCalculateMapWithPolygon).toHaveBeenCalledWith(accessibilytMapCalculationAttributes, options);
            expect(response).toEqual(Status.createOk(results));
            done();
        });
    });

    test('Accessibility map with error', (done) => {
        const message = 'Error routing transit';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedCalculateMapWithPolygon.mockRejectedValueOnce(error);
        socketStub.emit('accessibiliyMap.calculateWithPolygons', accessibilytMapCalculationAttributes, options, function (status) {
            expect(mockedCalculateMapWithPolygon).toHaveBeenCalledWith(accessibilytMapCalculationAttributes, options);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

});
