/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tokens';

// The tokens table was built with the onUpdateTrigger rules, but it didn't have
// the updated_at column. We add it and rename the creation_date to created_at
// to match other tables.

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.renameColumn('creation_date', 'created_at');
        table.timestamp('updated_at');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.renameColumn('created_at', 'creation_date');
        table.dropColumn('updated_at');
    });
}
