/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
require('./dotenv.config'); // dotenv is required to get the connection strings
import config from './server.config';
// TODO Let this data be in the config file instead, but only when the server config is separate from project config to not leak data
if (
    !process.env['PG_CONNECTION_STRING_PREFIX'] ||
    !process.env.NODE_ENV ||
    !process.env[`PG_DATABASE_${process.env.NODE_ENV.toUpperCase()}`]
)
    throw 'database is not set';

export const onUpdateTrigger = function (table: string) {
    return `
  CREATE TRIGGER ${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW
  EXECUTE PROCEDURE ${process.env.PG_DATABASE_SCHEMA || config.projectShortname}.on_update_timestamp();
`;
};

export default {
    client: 'pg',
    connection:
        process.env['PG_CONNECTION_STRING_PREFIX'] + process.env[`PG_DATABASE_${process.env.NODE_ENV.toUpperCase()}`],
    searchPath: [process.env.PG_DATABASE_SCHEMA || config.projectShortname || 'public', 'public'],
    migrations: {
        directory: __dirname + '/../models/db/migrations',
        tableName: 'knex_migrations_lib',
        loadExtensions: ['.js']
    }
};
