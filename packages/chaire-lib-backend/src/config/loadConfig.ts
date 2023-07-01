/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * This file can be included from backend tasks that do not require
 * application-specific configuration, or other main backend files, like running
 * servers, unit tests, etc. ie files that can be run out of the application
 * context. For application files requiring configuration data, include
 * preferably the chaire-lib-backend's `app.config` file, which should have
 * been initialized at the application startup. Or if in an application package,
 * prefer the application specific config file.
 * */
// dotenv is required to load configuration data
import './dotenv.config';
export { serverConfig, projectConfig } from './config';
import { initializeConfig } from './config';

initializeConfig();

console.log(
    'Loading configuration from chaire-lib-backend. This should only happen in tasks and unit tests. If it happens when the server starts, a wrong file is imported somewhere.'
);
