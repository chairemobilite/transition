/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_transit_node_transferable';

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('origin_node_id').notNullable().index(); // required
        table.foreign('origin_node_id').references('tr_transit_nodes.id').onDelete('CASCADE');
        table.uuid('destination_node_id').notNullable().index(); // required
        table.foreign('destination_node_id').references('tr_transit_nodes.id').onDelete('CASCADE');
        table.integer('walking_travel_time_seconds').index();
        table.integer('walking_travel_distance_meters');
        table.primary(['origin_node_id', 'destination_node_id']);
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
