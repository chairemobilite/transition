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
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { ExecutableJob } from '../../services/executableJob/ExecutableJob';
import jobsDbQueries from '../../models/db/jobs.db.queries';
import Users from 'chaire-lib-backend/lib/services/users/users';

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
const mockedGetDiskUsage = Users.getUserDiskUsage = jest.fn() as jest.MockedFunction<typeof Users.getUserDiskUsage>;

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

jest.mock('chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend', () => {
    return {
        route: jest.fn(),
        v1TransitCall: jest.fn()
    }
});
const mockedTrRoutingRoute = trRoutingService.route as jest.MockedFunction<typeof trRoutingService.route>;
const mockedTrRoutingV1Transit = trRoutingService.v1TransitCall as jest.MockedFunction<typeof trRoutingService.v1TransitCall>;

jest.mock('../../models/db/jobs.db.queries', () => {
    return {
        create: jest.fn().mockResolvedValue(1)
    }
});
const mockedJobCreate = jobsDbQueries.create as jest.MockedFunction<typeof jobsDbQueries.create>;

const mockedEnqueue = ExecutableJob.prototype.enqueue = jest.fn().mockResolvedValue(true);
const mockedRefresh = ExecutableJob.prototype.refresh = jest.fn().mockResolvedValue(true);

beforeEach(() => {
    mockedRoute.mockClear();
    mockedTableFrom.mockClear();
    mockedTableTo.mockClear();
    mockedMatch.mockClear();

    mockedStop.mockClear();
    mockedRestart.mockClear();
    mockedStatus.mockClear();

    mockedTrRoutingRoute.mockClear();
    mockedTrRoutingV1Transit.mockClear();
    mockedEnqueue.mockClear();
    mockedRefresh.mockClear();
    mockedJobCreate.mockClear();
});

describe('osrm service routes', () => {
    // Route and match parameters are the same here for this test
    const routeParameters = {
        mode: 'walking',
        points: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([ -73.1, 45.1 ])]
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
    // Parameter to pass to socket route v1
    const routeV1Parameters = {
        query: 'query=bla',
        host: 'https://test',
        port: 80
    };

    // Parameter to pass to socket route for `route`
    const routeParameters = {
        parameters: {
            originDestination: [TestUtils.makePoint([1, 1]), TestUtils.makePoint([-1, -1])],
            scenarioId: 'arbitrary',
            timeOfTrip: 28000,
            timeOfTripType: 'arrival' as const,
        },
        hostPort: {
            host: 'https://test',
            port: 80
        }
    };

    // It's a stub call, parameters don't have to be complete
    const demandParameters = {
        type: 'csv',
        configuration: {
            calculationName: 'test',
            cpuCount: 1,
            saveToDb: false
        }
    };

    // It's a stub call, parameters don't have to be complete
    const batchAccessMapParameters = {
        calculationName: 'test',
        cpuCount: 1
    };

    const transitAttributes = {
        minWaitingTimeSeconds: 180,
        scenarioId: 'arbitrary'
    }

    test('Route v1 correctly', (done) => {
        const routeResponse = { 
            status: 'no_routing_found' as const,
            origin: [1, 1] as [number, number],
            destination: [2, 1] as [number, number]
        };
        mockedTrRoutingV1Transit.mockResolvedValueOnce(routeResponse);
        socketStub.emit(TrRoutingConstants.ROUTE_V1, routeV1Parameters, (response) => {
            expect(Status.isStatusOk(response)).toBe(true);
            expect(mockedTrRoutingV1Transit).toHaveBeenCalledWith(routeV1Parameters.query, routeV1Parameters.host, routeV1Parameters.port);
            expect(response).toEqual(Status.createOk(routeResponse));
            done();
        });
    });

    test('Route v1 with default parameters correctly', (done) => {
        const routeResponse = { 
            status: 'no_routing_found' as const,
            origin: [1, 1] as [number, number],
            destination: [2, 1] as [number, number]
        };
        mockedTrRoutingV1Transit.mockResolvedValueOnce(routeResponse);
        socketStub.emit(TrRoutingConstants.ROUTE_V1, { query: routeV1Parameters.query }, (response) => {
            expect(Status.isStatusOk(response)).toBe(true);
            expect(mockedTrRoutingV1Transit).toHaveBeenCalledWith(routeV1Parameters.query, 'http://localhost', Preferences.get('trRouting.port'));
            expect(response).toEqual(Status.createOk(routeResponse));
            done();
        });
    });

    test('Route v1 with error', (done) => {
        const message = 'Error routing transit';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedTrRoutingV1Transit.mockRejectedValueOnce(error);
        socketStub.emit(TrRoutingConstants.ROUTE_V1, routeV1Parameters, function (status) {
            expect(mockedTrRoutingV1Transit).toHaveBeenCalledWith(routeV1Parameters.query, routeV1Parameters.host, routeV1Parameters.port);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

    test('Route correctly', (done) => {
        const routeResponse = {
            status: 'no_routing_found' as const,
            query: {
                origin: [1, 1] as [number, number],
                destination: [-1, -1] as [number, number],
                timeOfTrip: routeParameters.parameters.timeOfTrip,
                timeType: 1 as 0 | 1
            },
            reason: 'NO_ACCESS_AT_ORIGIN' as const
        };
        mockedTrRoutingRoute.mockResolvedValueOnce(routeResponse);
        socketStub.emit(TrRoutingConstants.ROUTE, routeParameters, (response) => {
            expect(Status.isStatusOk(response)).toBe(true);
            expect(mockedTrRoutingRoute).toHaveBeenCalledWith(routeParameters.parameters, routeParameters.hostPort);
            expect(response).toEqual(Status.createOk(routeResponse));
            done();
        });
    });

    test('Route correctly without host port', (done) => {
        const parametersOnly = { parameters: routeParameters.parameters };
        const routeResponse = {
            status: 'no_routing_found' as const,
            query: {
                origin: [1, 1] as [number, number],
                destination: [-1, -1] as [number, number],
                timeOfTrip: routeParameters.parameters.timeOfTrip,
                timeType: 1 as 0 | 1
            },
            reason: 'NO_ACCESS_AT_ORIGIN' as const
        };
        mockedTrRoutingRoute.mockResolvedValueOnce(routeResponse);
        socketStub.emit(TrRoutingConstants.ROUTE, parametersOnly, (response) => {
            expect(Status.isStatusOk(response)).toBe(true);
            expect(mockedTrRoutingRoute).toHaveBeenCalledWith(routeParameters.parameters, undefined);
            expect(response).toEqual(Status.createOk(routeResponse));
            done();
        });
    });

    test('Route with error', (done) => {
        const message = 'Error routing transit';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedTrRoutingRoute.mockRejectedValueOnce(error);
        socketStub.emit(TrRoutingConstants.ROUTE, routeParameters, function (status) {
            expect(mockedTrRoutingRoute).toHaveBeenCalledWith(routeParameters.parameters, routeParameters.hostPort);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

    test('Batch route correctly', (done) => {
        mockedGetDiskUsage.mockReturnValueOnce({ used: 100000, remaining: undefined });
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
                        demandAttributes: demandParameters,
                        transitRoutingAttributes: transitAttributes
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
        mockedGetDiskUsage.mockReturnValueOnce({ used: 100000, remaining: 100 });
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
                        demandAttributes: demandParameters,
                        transitRoutingAttributes: transitAttributes
                    }
                }
            }));
            expect(mockedEnqueue).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('Batch route, not enough space on disk', (done) => {
        mockedGetDiskUsage.mockReturnValueOnce({ used: 100000, remaining: 0 });
        socketStub.emit(TrRoutingConstants.BATCH_ROUTE, demandParameters, transitAttributes, function (status) {
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual('UserDiskQuotaReached');
            expect(mockedJobCreate).not.toHaveBeenCalled();
            expect(mockedEnqueue).not.toHaveBeenCalled();
            done();
        });
    });

    test('Batch access map correctly', (done) => {
        mockedGetDiskUsage.mockReturnValueOnce({ used: 100000, remaining: undefined });
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
        mockedGetDiskUsage.mockReturnValueOnce({ used: 100000, remaining: 100 });
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

    test('Batch route, not enough space on disk', (done) => {
        mockedGetDiskUsage.mockReturnValueOnce({ used: 100000, remaining: 0 });
        socketStub.emit(TrRoutingConstants.BATCH_ACCESS_MAP, batchAccessMapParameters, transitAttributes, function (status) {
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual('UserDiskQuotaReached');
            expect(mockedJobCreate).not.toHaveBeenCalled();
            expect(mockedEnqueue).not.toHaveBeenCalled();
            done();
        });
    });

});
