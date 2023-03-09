/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_jobs';

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.json('internal_data').defaultTo({}).notNullable();
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.dropColumn('internal_data');
    });
}
