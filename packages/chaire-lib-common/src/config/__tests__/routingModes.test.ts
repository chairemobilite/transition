/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as modes from '../routingModes';

test('Test routing modes', () => {
    // Just assign all possible values, this should simply compile
    let mode: modes.RoutingMode = 'walking';
    mode = 'driving';
    mode = 'driving_congestion';
    mode = 'cycling';
    mode = 'bus_urban';
    mode = 'bus_suburb';
    mode = 'bus_congestion';
    mode = 'rail';
    mode = 'tram';
    mode = 'tram_train';
    mode = 'metro';
    mode = 'monorail';
    mode = 'cable_car';
    expect(mode).toBeTruthy();

    // Test an array
    let modeArray: modes.RoutingMode[] = ['walking', 'driving'];
    expect(modeArray.length).toEqual(2);
});

test('Test all routing modes', () => {
    // Just assign all possible values, this should simply compile
    let mode: modes.RoutingOrTransitMode = 'walking';
    mode = 'driving';
    mode = 'driving_congestion';
    mode = 'cycling';
    mode = 'bus_urban';
    mode = 'bus_suburb';
    mode = 'bus_congestion';
    mode = 'rail';
    mode = 'tram';
    mode = 'tram_train';
    mode = 'metro';
    mode = 'monorail';
    mode = 'cable_car';
    mode = 'transit';
    expect(mode).toBeTruthy();

    // Test an array
    let modeArray: modes.RoutingOrTransitMode[] = ['walking', 'driving', 'transit'];
    expect(modeArray.length).toEqual(3);
});