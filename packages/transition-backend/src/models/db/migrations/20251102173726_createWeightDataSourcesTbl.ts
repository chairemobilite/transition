/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_weight_data_sources';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.integer('weighting_model_id').index();
        table.foreign('weighting_model_id').references('id').inTable('tr_weighting_models').onDelete('SET NULL');
        table.integer('max_access_time_seconds').defaultTo(1200).index(); // 20 minutes
        table.integer('max_bird_distance_meters').defaultTo(1250).index(); // 15 min at 5 km/h, must be less than max_access_time which is network travel time, with detours.
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
