/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Knex } from 'knex';

const tableName = 'tr_transit_node_weights';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.integer('weight_data_source_id').notNullable();
        table.foreign('weight_data_source_id').references('id').inTable('tr_weight_data_sources').onDelete('CASCADE');
        table.uuid('transit_node_id').notNullable();
        table.foreign('transit_node_id').references('id').inTable('tr_transit_nodes').onDelete('CASCADE');
        table.float('weight_value').notNullable();
        table.primary(['weight_data_source_id', 'transit_node_id']);
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
