/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Make sure environment has been read first
import 'chaire-lib-backend/lib/config/dotenv.config';
import { initializeConfig } from 'chaire-lib-backend/lib/config/config';

export { serverConfig, projectConfig } from 'chaire-lib-backend/lib/config/config';

initializeConfig();

// TODO Add the server's and project's specific configurations.
