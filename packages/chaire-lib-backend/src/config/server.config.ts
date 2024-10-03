/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import os from 'os';
import _merge from 'lodash/merge';

import config, {
    ProjectConfiguration,
    setProjectConfiguration as setProjectConfigurationCommon
} from 'chaire-lib-common/lib/config/shared/project.config';
import fs from 'fs';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

export type TrRoutingConfig = {
    /**
     * Port to use for this trRouting instance
     */
    port: number;
    /**
     * If set to `true`, enable caching of connections for all scenarios in
     * trRouting. Will use more memory
     */
    cacheAllScenarios: boolean;
    // FIXME Do we need to configure a host here? If so, we need to properly
    // support it in both batch and single calculation
};

// TODO Some project config option depend on the application, so should not be
// typed in chaire-lib. Each app (transition , evolution, etc) should add types
// to the config and should have a project.config file which imports this one
// for common options.
export type ServerSideProjectConfiguration = {
    /** @deprecated Use `routing.transit.engines.trRouting.*.cacheAllScenarios instead */
    trRoutingCacheAllScenarios?: boolean;

    /**
     * Configuration for the various engines used for the routing modes
     *
     * TODO Actually use this configuration in the various calculators, once we
     * support more than a single engine per mode
     */
    routing: {
        transit: {
            defaultEngine: string;
            engines: {
                /**
                 * Configuration for the trRouting engine
                 */
                trRouting?: {
                    /**
                     * Configuration for the single calculation trRouting service
                     */
                    single: TrRoutingConfig;
                    /**
                     * Configuration for the batch calculation trRouting service
                     */
                    batch: TrRoutingConfig;
                };
            };
        };
    } & {
        [key in RoutingMode]?: {
            defaultEngine: string;
            engines: {
                // TODO Type and intialize these configuration for routing modes
                [key: string]: any;
            };
        };
    };

    /**
     * The number of days that a token is valid for. After this time, the token
     * will expire
     */
    tokenLifespanDays: number;
};

const etcConfigFile = '/etc/transition/config.js';
const homeDirConfigFileRelative = '.config/transition/config.js';

// INIT_CWD is the directory from which the script was run (usually root of the
// repo), while PWD would be the chaire-lib-backend directory if run with `yarn
// start`
const workingDir = process.env.INIT_CWD || process.env.PWD;

// Get the config file. The return file path exists, the configuration file can
// come from the PROJECT_CONFIG environment variable, then
// $HOME/.config/transition/config.js, then /etc/transition/config.js
const getConfigFilePath = (): string => {
    // First, check the PROJECT_CONFIG environment variable
    if (typeof process.env.PROJECT_CONFIG === 'string') {
        const projectConfigFile = process.env.PROJECT_CONFIG.startsWith('/')
            ? process.env.PROJECT_CONFIG
            : `${workingDir}/${process.env.PROJECT_CONFIG}`;
        if (fs.existsSync(projectConfigFile)) {
            return path.normalize(projectConfigFile);
        }
        console.log(
            `Configuration file specified by PROJECT_CONFIG environment variable does not exist: ${projectConfigFile}`
        );
    }
    const homeDirConfigFile = path.normalize(`${os.homedir()}/${homeDirConfigFileRelative}`);
    if (fs.existsSync(homeDirConfigFile)) {
        return homeDirConfigFile;
    }
    if (fs.existsSync(etcConfigFile)) {
        return etcConfigFile;
    }
    throw `Configuration file not found. Either set the PROJECT_CONFIG environment variable to point to the config file, or use files ${homeDirConfigFile} or ${etcConfigFile} paths`;
};

const configFileNormalized = getConfigFilePath();

// Initialize default server side configuration
setProjectConfigurationCommon<ServerSideProjectConfiguration>({
    // Initialize runtime directory at the root of the repo
    projectDirectory: path.normalize(`${__dirname}/../../../../runtime/`),
    routing: {
        transit: {
            defaultEngine: 'trRouting',
            engines: {
                trRouting: {
                    single: {
                        port: 4000,
                        cacheAllScenarios: false
                    },
                    batch: {
                        port: 14000,
                        cacheAllScenarios: false
                    }
                }
            }
        }
    }
});

/**
 * Set the project configuration. This method handles deprecated values
 * @param newConfig The additional configuration to set
 */
export const setProjectConfiguration = (newConfig: Partial<ProjectConfiguration<ServerSideProjectConfiguration>>) => {
    // If the configuration file has a `trRoutingCacheAllScenarios` option, but the engine configuration does not have a `cacheAllScenarios` option, set it
    // FIXME Remove once the trRoutingCacheAllScenarios is fully deprecated
    if (
        newConfig.trRoutingCacheAllScenarios !== undefined &&
        newConfig.routing?.transit?.engines?.trRouting?.single?.cacheAllScenarios === undefined
    ) {
        console.warn(
            'The `trRoutingCacheAllScenarios` configuration is deprecated and will be removed in the future. Please use `routing.transit.engines.trRouting.single.cacheAllScenarios` instead.'
        );
        _merge(newConfig, {
            routing: {
                transit: {
                    engines: { trRouting: { single: { cacheAllScenarios: newConfig.trRoutingCacheAllScenarios } } }
                }
            }
        });
    }
    setProjectConfigurationCommon(newConfig);
};

try {
    const configFromFile = require(configFileNormalized);
    console.log(`Read server configuration from ${configFileNormalized}`);
    // Default project directory is `runtime` at the root of the repo
    if (configFromFile.projectDirectory === undefined && configFromFile.projectShortname !== undefined) {
        configFromFile.projectDirectory = path.normalize(
            `${__dirname}/../../../../runtime/${configFromFile.projectShortname}`
        );
    }
    setProjectConfiguration(configFromFile);
} catch (error) {
    console.error(`Error loading server configuration in file ${configFileNormalized}`);
}

/** Application configuration, does not include the server configuration */
export default config as ProjectConfiguration<ServerSideProjectConfiguration>;
