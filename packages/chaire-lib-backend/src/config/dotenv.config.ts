/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import fs from 'fs';

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

// INIT_CWD is the directory from which the script was run (usually root of the
// repo), while PWD would be the chaire-lib-backend directory if run with `yarn
// start`
const workingDir = process.env.INIT_CWD || process.env.PWD;

// Get the .env file. The return file path exists, the .env file can come from
// the TRANSITION_DOTENV environment variable, or is expected to be at the root
// of the directory
const getDotEnvFile = (): string | null => {
    // First, check the PROJECT_CONFIG environment variable
    if (typeof process.env.TRANSITION_DOTENV === 'string') {
        const dotEnvFile = process.env.TRANSITION_DOTENV.startsWith('/')
            ? process.env.TRANSITION_DOTENV
            : `${workingDir}/${process.env.TRANSITION_DOTENV}`;
        if (fs.existsSync(dotEnvFile)) {
            return path.normalize(dotEnvFile);
        }
        console.log(`.env file specified by TRANSITION_DOTENV environment variable does not exist: ${dotEnvFile}`);
    }
    const defaultDotEnv = `${workingDir}/.env`;
    if (fs.existsSync(defaultDotEnv)) {
        return defaultDotEnv;
    }
    console.log(
        `.env file not found. You can set the TRANSITION_DOTENV environment variable to point to the .env file. The default path is ${defaultDotEnv}`
    );
    return null;
};

const dotEnvPath = getDotEnvFile();
if (dotEnvPath !== null) {
    console.log(`Using .env file from ${dotEnvPath}`);
}

/* eslint-disable-next-line */
export default require('dotenv').config({ path: dotEnvPath });
