/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-common/lib/config/shared/dotenv.config'; // Unused, but must be imported
import config from '../../config/server.config';
import knex from 'knex';

import knexRootCfg from './knexfile.root';
import knexPublicCfg from './knexfile.public';
const knexRoot = knex(knexRootCfg);
const knexPublic = knex(knexPublicCfg);

const databaseName = process.env[`PG_DATABASE_${(process.env.NODE_ENV || 'development').toUpperCase()}`];
const createExtensionsAndSchemaQuery = `
  CREATE EXTENSION IF NOT EXISTS "plpgsql"   SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS "pgcrypto"  SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS "postgis"   SCHEMA public;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
  CREATE SCHEMA    IF NOT EXISTS "${process.env.PG_DATABASE_SCHEMA || config.projectShortname}";
  DROP OPERATOR CLASS IF EXISTS public._uuid_ops USING gin CASCADE;
  DROP OPERATOR FAMILY IF EXISTS public._uuid_ops USING gin CASCADE;
  CREATE OPERATOR CLASS public._uuid_ops DEFAULT 
    FOR TYPE _uuid USING gin AS 
    OPERATOR 1 &&(anyarray, anyarray), 
    OPERATOR 2 @>(anyarray, anyarray), 
    OPERATOR 3 <@(anyarray, anyarray), 
    OPERATOR 4 =(anyarray, anyarray), 
    FUNCTION 1 uuid_cmp(uuid, uuid), 
    FUNCTION 2 ginarrayextract(anyarray, internal, internal), 
    FUNCTION 3 ginqueryarrayextract(anyarray, internal, smallint, internal, internal, internal, internal), 
    FUNCTION 4 ginarrayconsistent(internal, smallint, anyarray, integer, internal, internal, internal, internal), 
    STORAGE uuid;
`;

console.log('create and setup database and schema');

// check if database exists already:
knexRoot('pg_catalog.pg_database')
    .count('*')
    .where('datname', databaseName)
    .then(async (resp) => {
        try {
            const count = resp.length > 0 ? resp[0].count : 0;
            if ((typeof count === 'string' ? parseInt(count) : count) === 0) {
                // Database does not exist, create it
                await knexRoot.raw(`CREATE DATABASE ${databaseName}`);
            }
            knexRoot.destroy();
            /*createExtensionsAndSchemaQueryArr.forEach(async (query) => {
                try {
                    await knexPublic.raw(query);
                } catch(error){
                    console.log('An error occurred when creating the database or the schema:', query, error);
                }
            })*/
            await knexPublic.raw(createExtensionsAndSchemaQuery);
            knexPublic.destroy();
        } catch (error) {
            console.log('An error occurred when creating the database or the schema:', error);
            // eslint-disable-next-line no-process-exit
            process.exit(1);
        }
    });
