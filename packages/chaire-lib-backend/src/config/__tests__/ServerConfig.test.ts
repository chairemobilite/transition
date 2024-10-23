/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { setProjectConfiguration } from '../server.config';
import ServerConfig from '../ServerConfig';


describe('get routing mode and engine configs', () => {

    beforeEach(() => {
        setProjectConfiguration({
            routing: {
                transit: {
                    defaultEngine: 'trRouting',
                    engines: {
                        trRouting: { single: { port: 5000 } } as any 
                    }
                }
            }
        });
    });

    test('getRoutingModeConfig, mode exists', () => {
        expect(ServerConfig.getRoutingModeConfig('transit')).toEqual({
            defaultEngine: 'trRouting',
            engines: {
                trRouting: {
                    single: { port: 5000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } },
                    batch: { port: 14000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } }
                }
            }
        });
    });

    test('getRoutingModeConfig, mode does not exist', () => {
        expect(ServerConfig.getRoutingModeConfig('walking_way_data_as_name')).toBeUndefined();
    });

    test('getRoutingEngineConfigForMode, mode and engine exist', () => {
        expect(ServerConfig.getRoutingEngineConfigForMode('transit', 'trRouting')).toEqual({
            single: { port: 5000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } }, 
            batch: { port: 14000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } }
        });
    });

    test('getRoutingEngineConfigForMode, engine does not exist', () => {
        expect(ServerConfig.getRoutingEngineConfigForMode('transit', 'valhalla')).toBeUndefined();
    });

    test('getRoutingEngineConfigForMode, mode does not exist', () => {
        expect(ServerConfig.getRoutingEngineConfigForMode('walking_way_data_as_name', 'osrmRouting')).toBeUndefined();
    });

    test('getAllModesForEngine, at least one mode uses engine', () => {
        expect(ServerConfig.getAllModesForEngine('trRouting')).toEqual(['transit']);
        expect(ServerConfig.getAllModesForEngine('osrmRouting')).toEqual([
            'driving',
            'driving_congestion',
            'cycling',
            'walking',
            'bus_suburb',
            'bus_urban',
            'bus_congestion',
            'rail',
            'tram',
            'tram_train',
            'metro',
            'monorail',
            'cable_car'
        ]);
    });

    test('getAllModesForEngine, no mode uses engine', () => {
        expect(ServerConfig.getAllModesForEngine('valhalla')).toEqual([]);
    });
});
