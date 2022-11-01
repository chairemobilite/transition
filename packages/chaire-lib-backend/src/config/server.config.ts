/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';

import config, { setProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';
import fs from 'fs';

// TODO Add a default path for the project configuration file. Now, it fails
if (typeof process.env.PROJECT_CONFIG !== 'string') {
    throw 'You must set the PROJECT_CONFIG environment variable in the .env file with the path to the config file.';
}

const projectConfigFile = process.env.PROJECT_CONFIG.replace('${rootDir}', `${__dirname}/../../../../`);

const configFileNormalized = path.normalize(projectConfigFile);
if (!fs.existsSync(configFileNormalized)) {
    throw `Configuration file '${configFileNormalized}' does not exist`;
}

// Initialize default server side configuration
setProjectConfiguration({
    // Initialize runtime directory at the root of the repo
    projectDirectory: path.normalize(`${__dirname}/../../../../runtime/`)
});

try {
    const configFromFile = require(configFileNormalized);
    // Default project directory is `runtime` at the root of the repo
    if (configFromFile.projectDirectory === undefined && configFromFile.projectShortname !== undefined) {
        configFromFile.projectDirectory = path.normalize(
            `${__dirname}/../../../../runtime/${configFromFile.projectShortname}`
        );
    }
    setProjectConfiguration(configFromFile);
} catch (error) {
    console.error('Error loading server configuration from the PROJECT_CONFIG environment variable');
}

/** Application configuration, does not include the server configuration */
export default config;
