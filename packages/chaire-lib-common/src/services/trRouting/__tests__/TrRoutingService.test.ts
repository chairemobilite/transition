/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TrRoutingService, ErrorCodes } from '../TrRoutingService';
import { TransitRouteQueryOptions, TrRoutingConstants } from '../../../api/TrRouting';
import serviceLocator from '../../../utils/ServiceLocator';
import TrError from '../../../utils/TrError';
import { TestUtils } from '../../../test';
import fetchMock from 'jest-fetch-mock';
import * as Status from '../../../utils/Status';
import { pathNoTransferRouteV2 } from '../../../test/services/trRouting/TrRoutingConstantsStubs';

const trRoutingService = new TrRoutingService;

const origin = TestUtils.makePoint([-73.745618, 45.368994]);
const destination = TestUtils.makePoint([-73.742861, 45.361682]);

const socketEventManager = {
    emit: jest.fn()
}

beforeEach(() => {
    serviceLocator.addService('socketEventManager', socketEventManager);
    socketEventManager.emit.mockClear();
    fetchMock.doMock();
    fetchMock.mockClear();
});

describe('Test routeV1 call', () => {

    test('With manual OD departure time', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        const result = await trRoutingService.routeV1({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            alternatives: true,
            scenarioId: 'abcdef',
            originDestination: [origin, destination],
            timeOfTrip: 10800,
            timeOfTripType: 'departure'
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
        expect(fetchMock).not.toHaveBeenCalled();
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain('&alternatives=1&');
        expect(queryString).toContain(`&origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`);
        expect(queryString).toContain(`&destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`);
        expect(queryString).toContain(`&departure_time_seconds=10800`);
        expect(queryString).not.toContain(`&od_trip_uuid`);
        expect(queryString).not.toContain(`&arrival_time_seconds`);
    
    });
    
    test('With manual OD arrival time', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        const result = await trRoutingService.routeV1({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            alternatives: true,
            scenarioId: 'abcdef',
            originDestination: [origin, destination],
            timeOfTrip: 10800,
            timeOfTripType: 'arrival'
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain('&alternatives=1&');
        expect(queryString).toContain(`&origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`);
        expect(queryString).toContain(`&destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`);
        expect(queryString).toContain(`&arrival_time_seconds=10800`);
        expect(queryString).not.toContain(`&od_trip_uuid`);
        expect(queryString).not.toContain(`&departure_time_seconds`);
    });
    
    test('With OD trip arrival time', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        const result = await trRoutingService.routeV1({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            alternatives: true,
            scenarioId: 'abcdef',
            odTripUuid: 'abcdefghi',
            timeOfTrip: 10800,
            timeOfTripType: 'arrival'
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain('&alternatives=1&');
        expect(queryString).toContain(`&od_trip_uuid=abcdefghi`);
        expect(queryString).toContain(`&arrival_time_seconds=10800`);
        expect(queryString).not.toContain(`&destination`);
        expect(queryString).not.toContain(`&origin`);
        expect(queryString).not.toContain(`&departure_time_seconds`);
    });
    
    test('Erroneous response', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'no_routing_found', alternatives: []})));
        let exception;
        try {
            const result = await trRoutingService.routeV1({minWaitingTime: 180,
                maxAccessTravelTime: 900,
                maxEgressTravelTime: 900,
                maxTransferTravelTime: 900,
                maxTravelTime: 900,
                alternatives: true,
                scenarioId: 'abcdef',
                odTripUuid: 'abcdefghi',
                timeOfTrip: 10800,
                timeOfTripType: 'arrival'
            });
        } catch (error) {
            exception = error;
        }
        expect(exception).not.toBeUndefined();
        expect(exception instanceof TrError).toBeTruthy();
        const exceptionObject = (exception as TrError).export();
        expect(exceptionObject.error).toEqual('cannot calculate transit route with trRouting: no_routing_found');
        expect(exceptionObject.errorCode).toEqual(ErrorCodes.NoRoutingFound);
        expect(exceptionObject.localizedMessage).toContain('NoResultFound');
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
    });
    
    test('Erroneous response with a reason', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({
            status: 'no_routing_found',
            reason: 'NO_ACCESS_AT_ORIGIN',
            alternatives: []}))
        );
        let exception;
        try {
            const result = await trRoutingService.routeV1({minWaitingTime: 180,
                maxAccessTravelTime: 900,
                maxEgressTravelTime: 900,
                maxTransferTravelTime: 900,
                maxTravelTime: 900,
                alternatives: true,
                scenarioId: 'abcdef',
                odTripUuid: 'abcdefghi',
                timeOfTrip: 10800,
                timeOfTripType: 'arrival'
            });
        } catch (error) {
            exception = error;
        }
        expect(exception).not.toBeUndefined();
        expect(exception instanceof TrError).toBeTruthy();
        const exceptionObject = (exception as TrError).export();
        expect(exceptionObject.error).toEqual('cannot calculate transit route with trRouting: no_routing_found');
        expect(exceptionObject.errorCode).toEqual(ErrorCodes.NoAccessAtOrigin);
        expect(exceptionObject.localizedMessage).toContain('NO_ACCESS_AT_ORIGIN');
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
    });
    
    test('Arbitrary server error', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createError('Error'))
        );
        let exception;
        try {
            await trRoutingService.routeV1({minWaitingTime: 180,
                maxAccessTravelTime: 900,
                maxEgressTravelTime: 900,
                maxTransferTravelTime: 900,
                maxTravelTime: 900,
                alternatives: true,
                scenarioId: 'abcdef',
                odTripUuid: 'abcdefghi',
                timeOfTrip: 10800,
                timeOfTripType: 'arrival'
            });
        } catch (error) {
            exception = error;
        }
        expect(exception).not.toBeUndefined();
        expect(exception instanceof TrError).toBeTruthy();
        const exceptionObject = (exception as TrError).export();
        expect(exceptionObject.error).toEqual('cannot handle call to trRouting: Error');
        expect(exceptionObject.errorCode).toEqual(ErrorCodes.OtherError);
        expect((exceptionObject.localizedMessage as any).text).toContain('TrRoutingServerError');
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
    });
    
    test('Using fetch call', async () => {
        serviceLocator.addService('socketEventManager', undefined);
        fetchMock.mockOnce(JSON.stringify({ status: 'ok', result: { status: 'success' } }));
        const result = await trRoutingService.routeV1({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            alternatives: true,
            scenarioId: 'abcdef',
            odTripUuid: 'abcdefghi',
            timeOfTrip: 10800,
            timeOfTripType: 'arrival'
        });
        expect(socketEventManager.emit).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/trRouting/routeV1', expect.objectContaining({ 
            method: 'POST',
            body: expect.stringContaining('query')
        }));
    
        const queryString = (fetchMock.mock as any).calls[0][1].body;
        expect(queryString).toContain('&alternatives=1&');
        expect(queryString).toContain(`&od_trip_uuid=abcdefghi`);
        expect(queryString).toContain(`&arrival_time_seconds=10800`);
        expect(queryString).not.toContain(`&destination`);
        expect(queryString).not.toContain(`&origin`);
        expect(queryString).not.toContain(`&departure_time_seconds`);
    });
});

describe('Test accessibility map calls', () => {
    test('With origin', async () => {
        // Test only an origin and departure time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        await trRoutingService.accessibleMap({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: origin,
            timeOfTrip: 10800,
            timeOfTripType: 'departure'
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain(`&departure_time_seconds=10800`);
        expect(queryString).toContain(`&origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`);
        expect(queryString).toContain(`all_nodes=1`);
        expect(queryString).not.toContain(`&destination`);
        expect(queryString).not.toContain(`&arrival_time_seconds`);
        expect(queryString).not.toContain('alternatives');
        expect(queryString).not.toContain(`access_node_uuids`);
    });
    
    test('With origin and accessible nodes', async () => {
        const accessibleNodes = { ids: ['uuid1', 'uuid2'], durations: [125.3, 130] };
        // Test only an origin and departure time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        await trRoutingService.accessibleMap({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: origin,
            timeOfTrip: 10800,
            timeOfTripType: 'departure',
            accessibleNodes
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain(`&departure_time_seconds=10800`);
        expect(queryString).toContain(`&origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`);
        expect(queryString).toContain(`&access_node_uuids=uuid1,uuid2`);
        expect(queryString).toContain(`&access_node_travel_times=125,130`);
        expect(queryString).toContain(`all_nodes=1`);
        expect(queryString).not.toContain(`&destination`);
        expect(queryString).not.toContain(`&arrival_time_seconds`);
        expect(queryString).not.toContain('alternatives');
        expect(queryString).not.toContain('egress_node_uuids');
        expect(queryString).not.toContain('egress_node_travel_times');
    });
    
    test('With origin and accessible nodes with unmatched sizes', async () => {
        // 2 ids, 1 distance
        const accessibleNodes = { ids: ['uuid1', 'uuid2'], durations: [125.3] };
        // Test only an origin and departure time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        await trRoutingService.accessibleMap({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: origin,
            timeOfTrip: 10800,
            timeOfTripType: 'departure',
            accessibleNodes
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain(`&departure_time_seconds=10800`);
        expect(queryString).toContain(`&origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`);
        expect(queryString).toContain(`all_nodes=1`);
        expect(queryString).not.toContain(`&destination`);
        expect(queryString).not.toContain(`&arrival_time_seconds`);
        expect(queryString).not.toContain('alternatives');
        expect(queryString).not.toContain('egress_node_uuids');
        expect(queryString).not.toContain('egress_node_travel_times');
        expect(queryString).not.toContain('access_node_uuids');
        expect(queryString).not.toContain('access_node_travel_times');
    });
    
    test('With destination', async () => {
        // Test only an destination and arrival time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        const result = await trRoutingService.accessibleMap({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: destination,
            timeOfTrip: 10800,
            timeOfTripType: 'arrival'
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain(`&arrival_time_seconds=10800`);
        expect(queryString).toContain(`&destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`);
        expect(queryString).toContain(`all_nodes=1`);
        expect(queryString).not.toContain(`&origin`);
        expect(queryString).not.toContain(`&departure_time_seconds`);
        expect(queryString).not.toContain('alternatives');
    });
    
    test('With destination and accessible nodes', async () => {
        const accessibleNodes = { ids: ['uuid1', 'uuid2'], durations: [125.3, 130] };
        // Test only an destination and arrival time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        const result = await trRoutingService.accessibleMap({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: destination,
            timeOfTrip: 10800,
            timeOfTripType: 'arrival',
            accessibleNodes
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain(`&arrival_time_seconds=10800`);
        expect(queryString).toContain(`&destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`);
        expect(queryString).toContain(`&egress_node_uuids=uuid1,uuid2`);
        expect(queryString).toContain(`&egress_node_travel_times=125,130`);
        expect(queryString).toContain(`all_nodes=1`);
        expect(queryString).not.toContain(`&origin`);
        expect(queryString).not.toContain(`&departure_time_seconds`);
        expect(queryString).not.toContain('alternatives');
        expect(queryString).not.toContain('access_node_uuids');
        expect(queryString).not.toContain('access_node_travel_times');
    });
    
    test('With destination and accessible nodes with unmatched sizes', async () => {
        // 2 ids, 1 distance
        const accessibleNodes = { ids: ['uuid1', 'uuid2'], durations: [125.3] };
        // Test only an destination and arrival time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'success'})));
        const result = await trRoutingService.accessibleMap({minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: destination,
            timeOfTrip: 10800,
            timeOfTripType: 'arrival',
            accessibleNodes
        });
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE_V1, expect.anything(), expect.anything());
    
        const queryString = socketEventManager.emit.mock.calls[0][1].query;
        expect(queryString).toContain(`&arrival_time_seconds=10800`);
        expect(queryString).toContain(`&destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`);
        expect(queryString).toContain(`all_nodes=1`);
        expect(queryString).not.toContain(`&origin`);
        expect(queryString).not.toContain(`&departure_time_seconds`);
        expect(queryString).not.toContain('alternatives');
        expect(queryString).not.toContain('egress_node_uuids');
        expect(queryString).not.toContain('egress_node_travel_times');
        expect(queryString).not.toContain('access_node_uuids');
        expect(queryString).not.toContain('access_node_travel_times');
    });
});

describe('Test route call', () => {
    const parameters: TransitRouteQueryOptions = {
        minWaitingTime: 180,
        maxAccessTravelTime: 900,
        maxEgressTravelTime: 900,
        maxTransferTravelTime: 900,
        maxTravelTime: 900,
        alternatives: true,
        scenarioId: 'abcdef',
        originDestination: [origin, destination],
        timeOfTrip: 10800,
        timeOfTripType: 'departure'  
    };

    const defaultSuccessfulQuery = {
        status: 'success', 
        query: {
            origin: origin.geometry.coordinates,
            destination: destination.geometry.coordinates,
            timeType: 0,
            timeOfTrip: 10800
        },
        result: {
            routes: [pathNoTransferRouteV2],
            totalRoutesCalculated: 1
        }
    }

    const defaultQueryToResult = {
        originDestination: [TestUtils.makePoint(defaultSuccessfulQuery.query.origin as any), TestUtils.makePoint(defaultSuccessfulQuery.query.destination as any)],
        timeOfTripType: 'departure' as const,
        timeOfTrip: defaultSuccessfulQuery.query.timeOfTrip
    }

    test('Test successful response', async () => {

        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk(defaultSuccessfulQuery)));
        const result = await trRoutingService.route(parameters);
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE, { parameters, hostPort: undefined }, expect.anything());
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toEqual({ routes: [{ ...pathNoTransferRouteV2, ...defaultQueryToResult }], totalRoutesCalculated: 1 });
    });

    test('Test call with host port', async () => {
        const hostPort = {
            host: 'http://test',
            port: 1234
        };

        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk(defaultSuccessfulQuery)));
        const result = await trRoutingService.route(parameters, hostPort);
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE, { parameters, hostPort }, expect.anything());
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toEqual({ routes: [{ ...pathNoTransferRouteV2, ...defaultQueryToResult }], totalRoutesCalculated: 1 });
    });
    
    test('Test erroneous response', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({status: 'no_routing_found', alternatives: []})));
        let exception;
        try {
            const result = await trRoutingService.route(parameters);
        } catch (error) {
            exception = error;
        }
        expect(exception).not.toBeUndefined();
        expect(exception instanceof TrError).toBeTruthy();
        const exceptionObject = (exception as TrError).export();
        expect(exceptionObject.error).toEqual('cannot calculate transit route with trRouting: no_routing_found');
        expect(exceptionObject.errorCode).toEqual(ErrorCodes.NoRoutingFound);
        expect(exceptionObject.localizedMessage).toContain('NoResultFound');
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE, { parameters, hostPort: undefined }, expect.anything());
    
    });
    
    test('Test erroneous response with a reason', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createOk({
            status: 'no_routing_found',
            reason: 'NO_ACCESS_AT_ORIGIN',
            alternatives: []}))
        );
        let exception;
        try {
            const result = await trRoutingService.route(parameters);
        } catch (error) {
            exception = error;
        }
        expect(exception).not.toBeUndefined();
        expect(exception instanceof TrError).toBeTruthy();
        const exceptionObject = (exception as TrError).export();
        expect(exceptionObject.error).toEqual('cannot calculate transit route with trRouting: no_routing_found');
        expect(exceptionObject.errorCode).toEqual(ErrorCodes.NoAccessAtOrigin);
        expect(exceptionObject.localizedMessage).toContain('NO_ACCESS_AT_ORIGIN');
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE, { parameters, hostPort: undefined }, expect.anything());
    
    });
    
    test('Test arbitrary server error', async () => {
        socketEventManager.emit.mockImplementation((_socketRoute, _args, callback) => callback(Status.createError('Error'))
        );
        let exception;
        try {
            await trRoutingService.route(parameters);
        } catch (error) {
            exception = error;
        }
        expect(exception).not.toBeUndefined();
        expect(exception instanceof TrError).toBeTruthy();
        const exceptionObject = (exception as TrError).export();
        expect(exceptionObject.error).toEqual('cannot handle call to trRouting: Error');
        expect(exceptionObject.errorCode).toEqual(ErrorCodes.OtherError);
        expect((exceptionObject.localizedMessage as any).text).toContain('TrRoutingServerError');
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ROUTE, {parameters, hostPort: undefined }, expect.anything());
    
    });

    test('Using fetch call', async () => {
        serviceLocator.addService('socketEventManager', undefined);
        fetchMock.mockOnce(JSON.stringify({ status: 'ok', result: defaultSuccessfulQuery }));
        const result = await trRoutingService.route(parameters);
        expect(socketEventManager.emit).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/trRouting/route', expect.objectContaining({ 
            method: 'POST',
            body: JSON.stringify({ parameters })
        }));
        expect(result).toEqual({ routes: [{ ...pathNoTransferRouteV2, ...defaultQueryToResult }], totalRoutesCalculated: 1 });
    
    });
});

describe('Test summary query', () => {
    test('Using fetch call', async () => {
        const response = { status: 'success', lines: [{
            lineUuid: 'lineUuid',
            lineShortname: 'shortname',
            lineLongname: 'longname',
            agencyUuid: 'agencyUuid',
            agencyAcronym: 'acro',
            agencyName: 'agencyName',
            alternativeCount: 2
        }]};
        fetchMock.mockOnce(JSON.stringify({ status: 'ok', result: response }));
        const params = {
            originDestination: [origin, destination] as any,
            minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            alternatives: true,
            scenarioId: 'abcdef',
            timeOfTrip: 10800,
            timeOfTripType: 'arrival' as const
        };
        const result = await trRoutingService.summary(params);
        expect(socketEventManager.emit).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/trRouting/summary', expect.objectContaining({ 
            method: 'POST',
            body: JSON.stringify(params)
        }));
        expect(result).toEqual(response);
    });
});
