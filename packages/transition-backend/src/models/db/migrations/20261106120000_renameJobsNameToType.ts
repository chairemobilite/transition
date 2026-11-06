/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Knex } from 'knex';

const tableName = 'tr_jobs';

// The `name` column holds the type of job (e.g. batchRoute), so it is renamed
// to `type`, leaving `name` available for a user-defined job name.
export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.renameColumn('name', 'type');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.renameColumn('type', 'name');
    });
}
