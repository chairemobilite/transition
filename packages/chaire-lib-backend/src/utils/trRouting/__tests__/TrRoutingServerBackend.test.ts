/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrRoutingServiceBackend from '../TrRoutingServiceBackend';
import fetchMock from 'jest-fetch-mock';
import TestUtils from 'chaire-lib-common/lib/test/TestUtils';

beforeEach(() => {
    fetchMock.doMock();
    fetchMock.mockClear();
});

describe('Route queries', () => {
    const host = 'https://my.test.server';
    const port = '4000';

    test('Test simple call', async () => {
        const jsonObject = {
            status: 'success'
        };
        fetchMock.mockOnce(JSON.stringify(jsonObject));

        const params = {
            originDestination: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([-74, 45.5])] as [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
            scenarioId: 'arbitraryId',
            alternatives: true,
            departureTime: 36000,
        }
        const queryString = `origin=${params.originDestination[0].geometry.coordinates[1]},${params.originDestination[0].geometry.coordinates[0]}&` +
            `destination=${params.originDestination[1].geometry.coordinates[1]},${params.originDestination[1].geometry.coordinates[0]}&` +
            `scenario_uuid=${params.scenarioId}&` +
            `alternatives=1&` +
            `departure_time=${params.departureTime}`;
        const result = await TrRoutingServiceBackend.route(queryString, host, port);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`${host}:${port}/route/v1/transit?${queryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

});

describe('Summary queries', () => {

    test('Test call with minimal data', async () => {
        const jsonObject = {
            status: 'success'
        };
        fetchMock.mockOnce(JSON.stringify(jsonObject));

        const params = {
            originDestination: [TestUtils.makePoint([-73, 45]), TestUtils.makePoint([-74, 45.5])] as [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
            scenarioId: 'arbitraryId',
            timeOfTrip: 36000,
            timeOfTripType: 'departure' as const
        }
        
        const expectedQueryString = `origin=${params.originDestination[0].geometry.coordinates[0]},${params.originDestination[0].geometry.coordinates[1]}&` +
        `destination=${params.originDestination[1].geometry.coordinates[0]},${params.originDestination[1].geometry.coordinates[1]}&` +
        `scenario_id=${params.scenarioId}&` +
        `time_of_trip=${params.timeOfTrip}&` +
        `time_type=0&` +
        `alternatives=false`;
        const result = await TrRoutingServiceBackend.summary(params);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`http://localhost:4000/v2/summary?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Test call with complete data', async () => {
        const jsonObject = {
            status: 'success'
        };
        fetchMock.mockOnce(JSON.stringify(jsonObject));

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
        }
        
        const expectedQueryString = `origin=${params.originDestination[0].geometry.coordinates[0]},${params.originDestination[0].geometry.coordinates[1]}&` +
        `destination=${params.originDestination[1].geometry.coordinates[0]},${params.originDestination[1].geometry.coordinates[1]}&` +
        `scenario_id=${params.scenarioId}&` +
        `time_of_trip=${params.timeOfTrip}&` +
        `time_type=1&` +
        `alternatives=true&` +
        `min_waiting_time=${params.minWaitingTime}&` +
        `max_access_travel_time=${params.maxAccessTravelTime}&` +
        `max_egress_travel_time=${params.maxEgressTravelTime}&` +
        `max_transfer_travel_time=${params.maxTransferTravelTime}&` +
        `max_travel_time=${params.maxTravelTime}&` +
        `max_first_waiting_time=${params.maxFirstWaitingTime}`;
        const result = await TrRoutingServiceBackend.summary(params);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`http://localhost:4000/v2/summary?${expectedQueryString}`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

});
