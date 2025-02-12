/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_transit_schedule_periods';

/**
 * This migration sets the foreign key constraint on inbound and outbound path
 * id to null on delete instead of cascade. Otherwise, deleting a single path
 * used as inbound or outbound would delete the schedule period and all other
 * trips associated with this service. We want to keep the trips that are not
 * deleted
 *
 * @param knex The database configuration object
 * @returns
 */
export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.dropForeign('outbound_path_id');
        table.dropForeign('inbound_path_id');
        table.foreign('outbound_path_id').references('tr_transit_paths.id').onDelete('SET NULL');
        table.foreign('inbound_path_id').references('tr_transit_paths.id').onDelete('SET NULL');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.dropForeign('outbound_path_id');
        table.dropForeign('inbound_path_id');
        table.foreign('outbound_path_id').references('tr_transit_paths.id').onDelete('CASCADE');
        table.foreign('inbound_path_id').references('tr_transit_paths.id').onDelete('CASCADE');
    });
}
