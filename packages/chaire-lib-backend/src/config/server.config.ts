/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import os from 'os';

import config, { setProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';
import fs from 'fs';

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
setProjectConfiguration({
    // Initialize runtime directory at the root of the repo
    projectDirectory: path.normalize(`${__dirname}/../../../../runtime/`)
});

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
export default config;
