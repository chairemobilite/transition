/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import OSRMRoutingService from '../OSRMRoutingService';
import serviceLocator from '../../../utils/ServiceLocator';
import TestUtils from '../../../test/TestUtils';
import { EventEmitter } from 'events';
import * as Status from '../../../utils/Status';
import { TripRoutingQueryAttributes } from '../types';

// Setup a fresh routingService and eventManager for each tests
const routingService = new OSRMRoutingService();
const eventManager = new EventEmitter();
serviceLocator.socketEventManager = eventManager;

beforeEach(() => {
    jest.clearAllMocks();
    eventManager.removeAllListeners();
});

test('Table from', async () => {
    const response = {query: '', durations: [30, 32.1], distances: [1000, 1004.2]};
    const mockTableFrom = jest.fn().mockImplementation((params, callback) => callback(Status.createOk({query: '', durations: [30, 32.1], distances: [1000, 1004.2]})));
    eventManager.on('service.osrmRouting.tableFrom', mockTableFrom);
    // Dummy test so this file passes, we should have a place to put stub classes
    const origin = TestUtils.makePoint([-73, 45]);
    const destination1 = TestUtils.makePoint([-73.1, 45.1]);
    const destination2 =TestUtils.makePoint([-73.1, 44.9]);
    const tableFrom = await routingService.tableFrom({mode: 'walking', origin: origin, destinations: [destination1, destination2]});
    expect(mockTableFrom).toHaveBeenCalledTimes(1);
    expect(mockTableFrom).toHaveBeenCalledWith({mode: 'walking', origin: origin, destinations: [destination1, destination2]}, expect.anything())
    expect(tableFrom).toEqual(response);
});

test('Table to', async () => {
    const response = {query: '', durations: [30, 32.1], distances: [1000, 1004.2]};
    const mockTableTo = jest.fn().mockImplementation((params, callback) => callback(Status.createOk(response)));
    eventManager.on('service.osrmRouting.tableTo', mockTableTo);
    // Dummy test so this file passes, we should have a place to put stub classes
    const destination = TestUtils.makePoint([-73, 45]);
    const origin1 = TestUtils.makePoint([-73.1, 45.1]);
    const origin2 =TestUtils.makePoint([-73.1, 44.9]);
    const tableTo = await routingService.tableTo({mode: 'walking', origins: [origin1, origin2], destination: destination});
    expect(mockTableTo).toHaveBeenCalledTimes(1);
    expect(mockTableTo).toHaveBeenCalledWith({mode: 'walking', origins: [origin1, origin2], destination: destination }, expect.anything())
    expect(tableTo).toEqual(response);
});

// TODO Put this object in a Stub file
const stubPlaces = [{
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [ 1, 1 ] },
    properties: {
        name: 'stub Object 1',
        geography: { type: 'Point' as const, coordinates: [ 1, 1 ] },
        data: {
            test: 'abc'
        }
    }
},
{
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [ 2, 2 ] },
    properties: {
        name: 'stub Object 2',
        geography: { type: 'Point' as const, coordinates: [ 2, 2 ] },
        description: 'This is a description',
        data: { }
    }
}]

describe('Route', () => {
    test('Route success', async () => {
        const point1 = TestUtils.makePoint([-73.1, 45.1]);
        const point2 =TestUtils.makePoint([-73.1, 44.9]);
    
        const osrmWaypoint1 = {location: [-73.1, 45.1]}
        const osrmWaypoint2 = {location: [-73.1, 44.9]}
    
        const osrmResponse = {waypoints: [osrmWaypoint1, osrmWaypoint2], routes: [{
           distance: 5000,
           duration: 3600,
           geometry: { type: 'LineString', coordinates: [[-73.1, 45.1], [-73.1, 44.9]] },
           weight: 50,
           weight_name: 'testWeight',
           legs: [{
                distance: 5000,
                duration: 3600,
                weight: 50,
                summary: 'something',
                steps: [{
                    distance: 500,
                    duration: 360,
                    geometry: { type: 'LineString', coordinates: [[-73.1, 45.1], [-73.1, 44.9]] }
                }],
                annotation: {
                    distance: [100, 500],
                    duration: [50, 250]
                }
           }]
        }]};
        const expectedResponse = {waypoints: [point1.geometry, point2.geometry], routes: [{
            distance: osrmResponse.routes[0].distance,
            duration: osrmResponse.routes[0].duration,
            legs: [{
                distance: osrmResponse.routes[0].legs[0].distance,
                duration: osrmResponse.routes[0].legs[0].duration,
                steps: [{
                    distance: osrmResponse.routes[0].legs[0].steps[0].distance,
                    duration: osrmResponse.routes[0].legs[0].steps[0].duration,
                    geometry: osrmResponse.routes[0].legs[0].steps[0].geometry
                }]
            }],
            geometry: osrmResponse.routes[0].geometry
        }]};
        const mockRoute = jest.fn().mockImplementation((params, callback) => callback(Status.createOk(osrmResponse)));
        eventManager.on('service.osrmRouting.route', mockRoute);
        
        const routeResult = await routingService.route({ mode: 'walking', points: { type: 'FeatureCollection', features: stubPlaces}, withAlternatives: true });
        expect(mockRoute).toHaveBeenCalledTimes(1);
        expect(mockRoute).toHaveBeenCalledWith({mode: 'walking', points: stubPlaces, annotations: true, steps: false, continue_straight: undefined, overview: "full", withAlternatives: true }, expect.any(Function))
        expect(routeResult).toEqual(expectedResponse);
    });
    
    test('Route fail', async () => {
    
        const mockRoute = jest.fn().mockImplementation((params, callback) => callback(Status.createError("BAD RESULTS")));
        eventManager.on('service.osrmRouting.route', mockRoute);
    
        // TODO Could use the Jest expect.toThrow(), but it's a bit complex to implement with async and parameters
        let routeResult;
        let haveThrown = false;
        try {
            routeResult = await routingService.route({mode: 'walking', points: { type: 'FeatureCollection', features: stubPlaces}});
        } catch {
            haveThrown = true;
        }
        expect(mockRoute).toHaveBeenCalledTimes(1);
        expect(mockRoute).toHaveBeenCalledWith({ mode: 'walking', points: stubPlaces, annotations: true, steps: false, continue_straight: undefined, overview: "full", withAlternatives: false }, expect.any(Function))
        expect(routeResult).toBeUndefined();
        expect(haveThrown).toBe(true);
    });
})


