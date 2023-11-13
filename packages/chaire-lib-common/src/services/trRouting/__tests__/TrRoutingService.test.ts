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

describe('Test accessibility map calls', () => {
    
    test('With origin', async () => {
        const parameters = {
            minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: origin,
            timeOfTrip: 10800,
            timeOfTripType: 'departure' as const
        };
        const nodes = [{
            nodeName: 'TestNode',
            nodeCode: 'T',
            nodeUuid: 'arbitrary',
            nodeTime: 11800,
            nodeCoordinates: origin,
            totalTravelTime: 900,
            numberOfTransfers: 1
        }];
        // Test only an origin and departure time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementationOnce((_socketRoute, _args, callback) => callback(Status.createOk({
            status: 'success', 
            query: {
                place: origin.geometry.coordinates,
                timeType: 0,
                timeOfTrip: 10800
            },
            result: {
                nodes,
                totalNodeCount: 10
            }
        })));
        const result = await trRoutingService.accessibleMap(parameters);
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ACCESSIBILITY_MAP, { parameters, hostPort: undefined }, expect.anything());
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toEqual({ type: 'nodes', nodes: [{ 
            arrivalTimeSeconds: nodes[0].nodeTime,
            arrivalTime: undefined,
            departureTime: undefined,
            departureTimeSeconds: undefined,
            numberOfTransfers: nodes[0].numberOfTransfers,
            id: nodes[0].nodeUuid,
            totalTravelTimeSeconds: nodes[0].totalTravelTime
        }] });

    });
    
    test('With destination', async () => {
        const parameters = {
            minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            maxTravelTime: 900,
            scenarioId: 'abcdef',
            location: origin,
            timeOfTrip: 10800,
            timeOfTripType: 'arrival' as const
        };
        const nodes = [{
            nodeName: 'TestNode',
            nodeCode: 'T',
            nodeUuid: 'arbitrary',
            nodeTime: 11800,
            nodeCoordinates: origin,
            totalTravelTime: 900,
            numberOfTransfers: 1
        }];
        // Test only an origin and departure time, the alternative should not be set and all_nodes=1 should be there
        socketEventManager.emit.mockImplementationOnce((_socketRoute, _args, callback) => callback(Status.createOk({
            status: 'success', 
            query: {
                place: origin.geometry.coordinates,
                timeType: 1,
                timeOfTrip: 10800
            },
            result: {
                nodes,
                totalNodeCount: 10
            }
        })));
        const result = await trRoutingService.accessibleMap(parameters);
        expect(socketEventManager.emit).toHaveBeenCalledTimes(1);
        expect(socketEventManager.emit).toHaveBeenLastCalledWith(TrRoutingConstants.ACCESSIBILITY_MAP, { parameters, hostPort: undefined }, expect.anything());
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toEqual({ type: 'nodes', nodes: [{ 
            arrivalTimeSeconds: undefined,
            arrivalTime: undefined,
            departureTime: undefined,
            departureTimeSeconds: nodes[0].nodeTime,
            numberOfTransfers: nodes[0].numberOfTransfers,
            id: nodes[0].nodeUuid,
            totalTravelTimeSeconds: nodes[0].totalTravelTime
        }] });

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
