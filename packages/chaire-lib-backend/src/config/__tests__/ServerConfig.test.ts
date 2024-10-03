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
                trRouting: { single: { port: 5000, cacheAllScenarios: false }, batch: { port: 14000, cacheAllScenarios: false } }
            }
        });
    });

    test('getRoutingModeConfig, mode does not exist', () => {
        expect(ServerConfig.getRoutingModeConfig('walking')).toBeUndefined();
    });

    test('getRoutingEngineConfigForMode, mode and engine exist', () => {
        expect(ServerConfig.getRoutingEngineConfigForMode('transit', 'trRouting')).toEqual({
            single: { port: 5000, cacheAllScenarios: false }, 
            batch: { port: 14000, cacheAllScenarios: false }
        });
    });

    test('getRoutingEngineConfigForMode, engine does not exist', () => {
        expect(ServerConfig.getRoutingEngineConfigForMode('transit', 'valhalla')).toBeUndefined();
    });

    test('getRoutingEngineConfigForMode, mode does not exist', () => {
        expect(ServerConfig.getRoutingEngineConfigForMode('walking', 'osrm')).toBeUndefined();
    });

});
