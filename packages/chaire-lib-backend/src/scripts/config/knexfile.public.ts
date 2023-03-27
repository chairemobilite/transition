/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// TODO Typesafe the connection when refactoring knex files (#426)
export default {
    client: 'pg',
    connection:
        (process.env['PG_CONNECTION_STRING_PREFIX'] as string) +
        process.env[`PG_DATABASE_${(process.env.NODE_ENV as string).toUpperCase()}`],
    searchPath: ['public']
};
