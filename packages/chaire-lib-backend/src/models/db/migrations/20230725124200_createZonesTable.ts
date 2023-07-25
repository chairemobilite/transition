/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_zones';

export async function up(knex: Knex): Promise<unknown> {
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.string('internal_id');
        table.string('shortname', 30).index();
        table.string('name');
        table.uuid('data_source_id').index();
        table.foreign('data_source_id').references('tr_data_sources.id').onDelete('CASCADE');
        table.specificType('geography', 'geography(GEOMETRY)');
        table.index('geography', undefined, 'gist');
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
