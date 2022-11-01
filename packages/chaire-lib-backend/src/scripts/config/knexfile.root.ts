/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-common/lib/config/shared/dotenv.config';

// TODO Refactor knex files (#426)
export default {
    client: 'pg',
    connection: process.env['PG_CONNECTION_STRING_PREFIX'] + 'postgres'
};
