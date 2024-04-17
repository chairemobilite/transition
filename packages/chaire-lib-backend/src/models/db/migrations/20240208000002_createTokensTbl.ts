/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tokens';

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.timestamp('creation_date');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.timestamp('creation_date');
    });
}
