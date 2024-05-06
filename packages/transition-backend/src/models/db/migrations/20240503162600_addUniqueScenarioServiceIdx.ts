/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_transit_scenario_services';

/**
 * This migration adds a unique index on the scenario_id, service_id, which
 * should have been added from the beginning. This will allow to leverage upsert
 * queries instead of having the check the existence of individual
 * scenario/service pairs before adding new ones.
 *
 * @param knex The database configuration object
 * @returns
 */
export async function up(knex: Knex): Promise<unknown> {
    // Remove duplicates before adding the unique constraint on scenario_id, service_id
    const countServiceQuery = knex
        .select('scenario_id', 'service_id')
        .from(tableName)
        .count()
        .groupBy('scenario_id', 'service_id')
        .as('servCount');
    const duplicates = await knex(countServiceQuery).where('count', '>', 1);
    // For each duplicate, delete all then add again one record
    for (let dupIdx = 0; dupIdx < duplicates.length; dupIdx++) {
        const { scenario_id, service_id } = duplicates[dupIdx];
        await knex(tableName).where('scenario_id', scenario_id).andWhere('service_id', service_id).del();
        await knex(tableName).insert({ scenario_id, service_id });
    }
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.unique(['scenario_id', 'service_id']);
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.dropUnique(['scenario_id', 'service_id']);
    });
}
