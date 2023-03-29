/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import os from 'os';
import _cloneDeep from 'lodash.clonedeep';

import config, { setProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';
import fs from 'fs';

export type BaseServerConfig = {
    /**
     * Absolute directory where project data will be stored (import files, osrm data, user data, caches, etc)
     */
    projectDirectory: string;
    /**
     * The default disk usage quota for a user. The string is a number suffixed
     * with the units, kb, mb or gb
     */
    userDiskQuota: string;
    /**
     * Maximum file upload size, in megabytes. Defaults to 256MB
     */
    maxFileUploadMB: number;
    maxParallelCalculators: number;
};

export type ServerConfiguration<AdditionalServerConfig> = BaseServerConfig & AdditionalServerConfig;

// Initialize default server side configuration
export const serverConfig: ServerConfiguration<unknown> = {
    userDiskQuota: '1gb',
    maxFileUploadMB: 256,
    maxParallelCalculators: 1,
    // Initialize runtime directory at the root of the repo
    projectDirectory: path.normalize(`${__dirname}/../../../../runtime/`)
};

/**
 * Set the server configuration options.
 *
 * @param config The configuration options to set
 * @returns
 */
export const setServerConfiguration = <AdditionalServerConfig>(
    config: Partial<ServerConfiguration<AdditionalServerConfig>>
) => Object.keys(config).forEach((configKey) => (serverConfig[configKey] = config[configKey]));

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

const parseServerConfig = (configFromFile: { [key: string]: any }): Partial<BaseServerConfig> => {
    // Split server configuration from other configuration
    const serverConfigFromFile: Partial<BaseServerConfig> = {};

    // Extract the server configuration from the rest of the config
    // TODO Validate the fields individually before setting them
    const fieldsForServer = ['projectDirectory', 'userDiskQuota', 'maxFileUploadMB', 'maxParallelCalculators'];
    fieldsForServer.forEach((field) => {
        if (configFromFile[field] !== undefined) {
            serverConfigFromFile[field] = configFromFile[field];
            delete configFromFile[field];
        }
    });

    // Default project directory is `runtime` at the root of the repo
    if (serverConfigFromFile.projectDirectory === undefined && configFromFile.projectShortname !== undefined) {
        serverConfigFromFile.projectDirectory = path.normalize(
            `${__dirname}/../../../../runtime/${configFromFile.projectShortname}`
        );
    }
    return serverConfigFromFile;
};

let configInitialized = false;

export const initializeConfig = <ServerC, ProjectC>(
    parseServer?: (configFromFile: { [key: string]: any }) => ServerC,
    parseProject?: (configFromFile: { [key: string]: any }) => ProjectC,
    forceReload = false
) => {
    if (configInitialized === true && !forceReload) {
        return;
    }
    const configFileNormalized = getConfigFilePath();

    try {
        const configFileContent = require(configFileNormalized);
        const configFromFile = _cloneDeep(configFileContent);
        console.log(`Read server configuration from ${configFileNormalized}`);

        const serverConfigFromFile = parseServerConfig(configFromFile);

        const appServerconfig = parseServer !== undefined ? parseServer(configFromFile) : {};
        const appProjectConfig = parseProject !== undefined ? parseProject(configFromFile) : {};
        // TODO Validate the serverConfigFromFile and configFromFile objects before setting it
        setServerConfiguration<ServerC>(
            Object.assign({}, serverConfigFromFile, appServerconfig) as ServerConfiguration<ServerC>
        );
        setProjectConfiguration<ProjectC>(Object.assign({}, configFromFile, appProjectConfig));
        configInitialized = true;
    } catch (error) {
        console.error(`Error loading server configuration in file ${configFileNormalized}`);
    }
};

/** Application configuration, does not include the server configuration */
export const projectConfig = config;
