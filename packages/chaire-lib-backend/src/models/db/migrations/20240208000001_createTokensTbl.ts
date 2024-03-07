/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable('tokens')) {
        return;
    }
    await knex.schema.createTable('tokens', (table: Knex.TableBuilder) => {
        table.increments('user_id').references('id').inTable('users').unique().primary();
        table.string('api_token').unique().index();
        table.timestamp('creation_date')
        table.timestamp('expiry_date')
    });
    return knex.raw(onUpdateTrigger('tokens'));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable('tokens');
}
