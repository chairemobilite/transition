/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_transit_nodes';

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.index('geography', 'tr_transit_nodes_geography', 'gist');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.dropIndex('tr_transit_nodes_geography');
    });
}
