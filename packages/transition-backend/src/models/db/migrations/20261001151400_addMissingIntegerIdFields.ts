/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const lineTableName = 'tr_transit_lines';
const agencyTableName = 'tr_transit_agencies';

/**
 * Add integer_id fields to the line and agency tables. An integer ID is a
 * pre-requisite for insuring insertion ID sort order when inserting multiple
 * elements in the table and matching the new/original IDs
 *
 * @param knex
 * @returns
 */
export async function up(knex: Knex): Promise<unknown> {
    await knex.schema.alterTable(lineTableName, (table) => {
        table.increments('integer_id', { primaryKey: false });
    });
    return knex.schema.alterTable(agencyTableName, (table) => {
        table.increments('integer_id', { primaryKey: false });
    });
}

export async function down(knex: Knex): Promise<unknown> {
    await knex.schema.alterTable(lineTableName, (table) => {
        table.dropColumn('integer_id');
    });
    return knex.schema.alterTable(agencyTableName, (table) => {
        table.dropColumn('integer_id');
    });
}
