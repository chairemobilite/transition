/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import config, { TrRoutingConfig } from './server.config';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';

/**
 * Helper class to manage accesses to server configuration
 */
class ServerConfig {
    constructor() {
        // Nothing to do
        // TODO Currently, the `server.config` file sets the default value,
        // because there is not that many we want to set, but as we add more,
        // this class should be responsible to set them
    }

    /**
     * Get the routing mode configuration
     * @param mode The mode to get the configuration for
     * @returns the project configuration, or undefined if the mode is not configured
     */
    getRoutingModeConfig = (mode: RoutingOrTransitMode) => {
        if (config.routing[mode] === undefined) {
            console.error('Configuration for routing mode %s not found', mode);
        }
        return config.routing[mode];
    };

    /**
     * Get the routing engine configuration for a given mode
     *
     * TODO See if we can type the return value better as each engine should
     * have their own config type
     *
     * @param mode The mode to get the configuration for
     * @param engine The engine to use
     * @returns
     */
    getRoutingEngineConfigForMode = (mode: RoutingOrTransitMode, engine: string) => {
        if (config.routing[mode] === undefined) {
            console.error('Configuration for routing mode %s not found', mode);
        }
        if (config.routing[mode] !== undefined && config.routing[mode]!.engines[engine] === undefined) {
            console.error('Configuration for engine %s for routing mode %s not found', engine, mode);
        }
        return config.routing[mode]?.engines[engine];
    };

    getTrRoutingConfig = (instance: 'single' | 'batch'): TrRoutingConfig => {
        const engineConfiguration = this.getRoutingEngineConfigForMode('transit', 'trRouting');
        // The configuration should be defined, throw an error if it is not, we have a problem
        if (engineConfiguration === undefined) {
            throw new Error('trRouting configuration not found');
        }
        return engineConfiguration[instance] || { port: 4000, cacheAllScenarios: false };
    };

    getAllModesForEngine = (engine: string): string[] => {
        const modesForEngine: string[] = [];
        for (const modeName in config.routing) {
            if (config.routing[modeName].engines[engine] !== undefined) {
                modesForEngine.push(modeName);
            }
        }

        return modesForEngine;
    };
}

const instance = new ServerConfig();
export default instance;
