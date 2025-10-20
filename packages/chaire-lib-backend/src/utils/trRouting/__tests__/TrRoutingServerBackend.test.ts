/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrRoutingServiceBackend from '../TrRoutingServiceBackend';
import TestUtils from 'chaire-lib-common/lib/test/TestUtils';

global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
    jest.resetAllMocks(); // otherwise the mocks will accumulate the calls and haveBeenCalledTimes will not be accurate
});

const defaultParameters = {
    originDestination: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([-74, 45.5])] as [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
    scenarioId: 'arbitraryId',
    timeOfTrip: 36000,
    timeOfTripType: 'departure' as const
};

describe('Route queries', () => {

    test('Test simple call', async () => {
        const jsonObject = { status: 'success' };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const expectedQueryString = `origin=${defaultParameters.originDestination[0].geometry.coordinates[0]},${defaultParameters.originDestination[0].geometry.coordinates[1]}&` +
            `destination=${defaultParameters.originDestination[1].geometry.coordinates[0]},${defaultParameters.originDestination[1].geometry.coordinates[1]}&` +
            `scenario_id=${defaultParameters.scenarioId}&` +
            `time_of_trip=${defaultParameters.timeOfTrip}&` +
            'time_type=0&' +
            'alternatives=false';
        const result = await TrRoutingServiceBackend.route(defaultParameters);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`http://localhost:4000/v2/route?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Test with custom host port', async () => {
        const host = 'https://my.test.server';
        const port = 1234;

        const jsonObject = {
            status: 'success'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const expectedQueryString = `origin=${defaultParameters.originDestination[0].geometry.coordinates[0]},${defaultParameters.originDestination[0].geometry.coordinates[1]}&` +
            `destination=${defaultParameters.originDestination[1].geometry.coordinates[0]},${defaultParameters.originDestination[1].geometry.coordinates[1]}&` +
            `scenario_id=${defaultParameters.scenarioId}&` +
            `time_of_trip=${defaultParameters.timeOfTrip}&` +
            'time_type=0&' +
            'alternatives=false';
        const result = await TrRoutingServiceBackend.route(defaultParameters, { host, port });
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`${host}:${port}/v2/route?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Test call with complete data', async () => {
        const jsonObject = {
            status: 'success'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const params = {
            originDestination: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([-74, 45.5])] as [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
            scenarioId: 'arbitraryId',
            timeOfTrip: 36000,
            timeOfTripType: 'arrival' as const,
            alternatives: true,
            minWaitingTime: 300,
            maxAccessTravelTime: 600,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 200,
            maxTravelTime: 1800,
            maxFirstWaitingTime: 180
        };

        const expectedQueryString = `origin=${params.originDestination[0].geometry.coordinates[0]},${params.originDestination[0].geometry.coordinates[1]}&` +
            `destination=${params.originDestination[1].geometry.coordinates[0]},${params.originDestination[1].geometry.coordinates[1]}&` +
            `scenario_id=${params.scenarioId}&` +
            `time_of_trip=${params.timeOfTrip}&` +
            'time_type=1&' +
            'alternatives=true&' +
            `min_waiting_time=${params.minWaitingTime}&` +
            `max_access_travel_time=${params.maxAccessTravelTime}&` +
            `max_egress_travel_time=${params.maxEgressTravelTime}&` +
            `max_transfer_travel_time=${params.maxTransferTravelTime}&` +
            `max_travel_time=${params.maxTravelTime}&` +
            `max_first_waiting_time=${params.maxFirstWaitingTime}`;
        const result = await TrRoutingServiceBackend.route(params);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`http://localhost:4000/v2/route?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

});

describe('Legacy transit queries', () => {
    const host = 'https://my.test.server';
    const port = '4000';

    test('Test simple call', async () => {
        const jsonObject = {
            status: 'success'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const params = {
            originDestination: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([-74, 45.5])] as [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
            scenarioId: 'arbitraryId',
            alternatives: true,
            departureTime: 36000,
        };
        const queryString = `origin=${params.originDestination[0].geometry.coordinates[1]},${params.originDestination[0].geometry.coordinates[0]}&` +
            `destination=${params.originDestination[1].geometry.coordinates[1]},${params.originDestination[1].geometry.coordinates[0]}&` +
            `scenario_uuid=${params.scenarioId}&` +
            'alternatives=1&' +
            `departure_time=${params.departureTime}`;
        const result = await TrRoutingServiceBackend.v1TransitCall(queryString, host, port);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`${host}:${port}/route/v1/transit?${queryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

});

describe('Summary queries', () => {

    test('Test call with minimal data', async () => {
        const jsonObject = {
            status: 'success'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const expectedQueryString = `origin=${defaultParameters.originDestination[0].geometry.coordinates[0]},${defaultParameters.originDestination[0].geometry.coordinates[1]}&` +
        `destination=${defaultParameters.originDestination[1].geometry.coordinates[0]},${defaultParameters.originDestination[1].geometry.coordinates[1]}&` +
        `scenario_id=${defaultParameters.scenarioId}&` +
        `time_of_trip=${defaultParameters.timeOfTrip}&` +
        'time_type=0&' +
        'alternatives=false';
        const result = await TrRoutingServiceBackend.summary(defaultParameters);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`http://localhost:4000/v2/summary?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Test call with complete data', async () => {
        const jsonObject = {
            status: 'success'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const params = {
            originDestination: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([-74, 45.5])] as [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
            scenarioId: 'arbitraryId',
            timeOfTrip: 36000,
            timeOfTripType: 'arrival' as const,
            alternatives: true,
            minWaitingTime: 300,
            maxAccessTravelTime: 600,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 200,
            maxTravelTime: 1800,
            maxFirstWaitingTime: 180
        };

        const expectedQueryString = `origin=${params.originDestination[0].geometry.coordinates[0]},${params.originDestination[0].geometry.coordinates[1]}&` +
        `destination=${params.originDestination[1].geometry.coordinates[0]},${params.originDestination[1].geometry.coordinates[1]}&` +
        `scenario_id=${params.scenarioId}&` +
        `time_of_trip=${params.timeOfTrip}&` +
        'time_type=1&' +
        'alternatives=true&' +
        `min_waiting_time=${params.minWaitingTime}&` +
        `max_access_travel_time=${params.maxAccessTravelTime}&` +
        `max_egress_travel_time=${params.maxEgressTravelTime}&` +
        `max_transfer_travel_time=${params.maxTransferTravelTime}&` +
        `max_travel_time=${params.maxTravelTime}&` +
        `max_first_waiting_time=${params.maxFirstWaitingTime}`;
        const result = await TrRoutingServiceBackend.summary(params);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`http://localhost:4000/v2/summary?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

});

describe('Retry and timeout behavior', () => {

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('Should retry and succeed on second attempt', async () => {
        const jsonObject = { status: 'success' };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        // First call fails, second succeeds
        mockedFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(response);

        const expectedQueryString = `origin=${defaultParameters.originDestination[0].geometry.coordinates[0]},${defaultParameters.originDestination[0].geometry.coordinates[1]}&` +
            `destination=${defaultParameters.originDestination[1].geometry.coordinates[0]},${defaultParameters.originDestination[1].geometry.coordinates[1]}&` +
            `scenario_id=${defaultParameters.scenarioId}&` +
            `time_of_trip=${defaultParameters.timeOfTrip}&` +
            'time_type=0&' +
            'alternatives=false';

        const routePromise = TrRoutingServiceBackend.route(defaultParameters);

        // Fast-forward through the 1-second retry delay
        await jest.advanceTimersByTimeAsync(1000);

        const result = await routePromise;

        expect(mockedFetch).toHaveBeenCalledTimes(2);
        expect(mockedFetch).toHaveBeenCalledWith(`http://localhost:4000/v2/route?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Should fail after exhausting all retry attempts', async () => {
        // Both attempts fail
        mockedFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'));

        // TODO We use real timers for this test, we had issue with fake timer
        // and the handling of the exception. Might need to be investigated further if
        // we want to accelerate test execution.
        jest.useRealTimers();

        const routePromise = TrRoutingServiceBackend.route(defaultParameters);

        await expect(routePromise).rejects.toThrow('TrRouting request failed, exhausted all retries');

        expect(mockedFetch).toHaveBeenCalledTimes(2);
    });

    test('Should handle non-OK response and retry', async () => {
        const errorResponse = new Response(JSON.stringify({ error: 'Server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
        const successResponse = new Response(JSON.stringify({ status: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

        // First call returns 500, second succeeds
        mockedFetch
            .mockResolvedValueOnce(errorResponse)
            .mockResolvedValueOnce(successResponse);

        const routePromise = TrRoutingServiceBackend.route(defaultParameters);

        // Fast-forward through the 1-second retry delay
        await jest.advanceTimersByTimeAsync(1000);

        const result = await routePromise;

        expect(mockedFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ status: 'success' });
    });

});
