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

export const DEFAULT_LOG_FILE_COUNT = 3; // 3 files
export const DEFAULT_LOG_FILE_SIZE_KB = 5 * 1024; // 5MB

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
    /**
     * Whether to run trRouting in debug mode. Defaults to `false`
     */
    debug: boolean;
    /**
     * Allow to configure the amount of logging to do for the trRouting process
     */
    logs: {
        // FIXME Add more logging options, for say, something else than files
        /**
         * The number of log files to keep. Defaults to 3
         */
        nbFiles?: number;
        /**
         * The maximum size of a log file in KB. Defaults to 5120 (5MB)
         */
        maxFileSizeKB?: number;
    };
    // FIXME Do we need to configure a host here? If so, we need to properly
    // support it in both batch and single calculation
};

export type OsrmRoutingConfig = {
    /**
     * Port used to access OSRM, either locally or remotely.
     */
    port: number | null;
    /**
     * If set to null, localhost will be used. Ignored if autoStart set to true.
     * Do not prefix with the protocol (ex: 'some.osrm.site.com')
     */
    host: string | null;
    /**
     * If true, a local instance of OSRM will be started when launching transition (client).
     */
    autoStart: boolean;
    /**
     * If true, this mode will be configured, otherwise it will be left out. Usable when routing paths.
     */
    enabled: boolean;
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
                osrmRouting?: OsrmRoutingConfig;
            };
        };
    };

    /**
     * The number of days that a token is valid for. After this time, the token
     * will expire
     */
    tokenLifespanDays: number;
    /**
     * Maximum number of parallel calculations that can be run at the same time.
     * It will default to the OS's number of available CPUs
     */
    maxParallelCalculators: number;
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
                        cacheAllScenarios: false,
                        debug: false,
                        logs: {
                            nbFiles: DEFAULT_LOG_FILE_COUNT,
                            maxFileSizeKB: DEFAULT_LOG_FILE_SIZE_KB
                        }
                    },
                    batch: {
                        port: 14000,
                        cacheAllScenarios: false,
                        debug: false,
                        logs: {
                            nbFiles: DEFAULT_LOG_FILE_COUNT,
                            maxFileSizeKB: DEFAULT_LOG_FILE_SIZE_KB
                        }
                    }
                }
            }
        },
        driving: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 7000,
                    host: null,
                    autoStart: true,
                    enabled: true
                }
            }
        },
        driving_congestion: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 7500,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        cycling: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 8000,
                    host: null,
                    autoStart: true,
                    enabled: true
                }
            }
        },
        walking: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 5000,
                    host: null,
                    autoStart: true,
                    enabled: true
                }
            }
        },
        bus_suburb: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 7200,
                    host: null,
                    autoStart: true,
                    enabled: true
                }
            }
        },
        bus_urban: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 7300,
                    host: null,
                    autoStart: true,
                    enabled: true
                }
            }
        },
        bus_congestion: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 7400,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        rail: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 9000,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        tram: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 9100,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        tram_train: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 9200,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        metro: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 9300,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        monorail: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 9400,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        },
        cable_car: {
            defaultEngine: 'osrmRouting',
            engines: {
                osrmRouting: {
                    port: 9500,
                    host: null,
                    autoStart: false,
                    enabled: false
                }
            }
        }
    },
    maxParallelCalculators: os.cpus().length
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

    // Make sure the maximum number of parallel calculators is a positive value, but does not exceed the CPU count
    if (newConfig.maxParallelCalculators !== undefined) {
        const availableCPUs = os.cpus().length;
        if (newConfig.maxParallelCalculators <= 0) {
            console.warn(
                `maxParallelCalculators (${newConfig.maxParallelCalculators}) must be a positive number. Using the number of CPUs instead: ${availableCPUs}`
            );
            newConfig.maxParallelCalculators = availableCPUs;
        } else if (newConfig.maxParallelCalculators > availableCPUs) {
            console.warn(
                `maxParallelCalculators (${newConfig.maxParallelCalculators}) should not exceed the number of CPUs: ${availableCPUs}. This may cause performance issues.`
            );
        }
    }

    // If osrmRouting is configured using the old defaultPreferences format and not the new one in server.config, set it to the new format
    // FIXME Remove once the old osrmRouting format is fully deprecated. See issue #1137
    const osrmModesInDeprecatedFormat = (newConfig as any)?.defaultPreferences?.osrmRouting?.modes;
    if (osrmModesInDeprecatedFormat !== undefined) {
        console.warn(
            'The `osrmRouting` configuration in defaultPreferences is deprecated and will be removed in the future. Please insert the orsm configs in `routing.*.engines.osrmRouting` in server.config.ts, using a similar format as `routing.transit` instead.'
        );
        for (const osrmMode in osrmModesInDeprecatedFormat) {
            if (newConfig.routing?.[osrmMode] === undefined) {
                _merge(newConfig, {
                    routing: {
                        [osrmMode]: {
                            defaultEngine: 'osrmRouting',
                            engines: {
                                osrmRouting: {
                                    port: osrmModesInDeprecatedFormat[osrmMode].port,
                                    host:
                                        osrmModesInDeprecatedFormat[osrmMode].host ||
                                        osrmModesInDeprecatedFormat[osrmMode].osrmPath,
                                    autoStart: osrmModesInDeprecatedFormat[osrmMode].autoStart,
                                    enabled: osrmModesInDeprecatedFormat[osrmMode].enabled
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    // If there are still section configurations in the defaultPreferences section of the project config, set it as section config.
    // FIXME Remove this if a reasonable time after march 2025, to give time to instances to update their configuration
    const defaultPreferences = (newConfig as any)?.defaultPreferences;
    if (defaultPreferences && defaultPreferences.sections) {
        console.warn(
            'The `defaultPreferences`\'s `sections` configuration is deprecated and will be removed in the future. Please use `sections.[sectionName]` configuration options instead, with the same format as the defaultPreferences.'
        );
        Object.keys(defaultPreferences.sections).forEach((appName) => {
            Object.keys(defaultPreferences.sections[appName]).forEach((sectionName) => {
                _merge(newConfig, {
                    sections: { [sectionName]: defaultPreferences.sections[appName][sectionName] }
                });
            });
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
} catch (error: unknown) {
    console.error(`Failed to load server configuration from ${configFileNormalized}:`);

    // Type guard for Error objects
    if (error instanceof Error) {
        console.error(`Error: ${error.message}`);

        if (error.stack) {
            console.error('Stack trace:');
            console.error(error.stack);
        }

        // Check for specific error types
        if ('code' in error && error.code === 'MODULE_NOT_FOUND') {
            console.error('The configuration file does not exist or cannot be accessed');
        } else if (error instanceof SyntaxError) {
            console.error('The configuration file contains invalid JSON or JavaScript syntax');
        }

        // Application-specific error handling
        if (process.env.NODE_ENV === 'production') {
            // In production, you might want to use a default configuration
            // or terminate the process
            process.exit(1);
        } else {
            // In development, rethrow for better debugging
            throw error;
        }
    } else {
        // Handle cases where the caught value isn't an Error object
        console.error('An unknown error occurred:', error);
        throw new Error('Configuration loading failed: Unknown error');
    }
}

/** Application configuration, does not include the server configuration */
export default config as ProjectConfiguration<ServerSideProjectConfiguration>;
