/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Knex } from 'knex';

const tableName = 'tr_transit_schedules';
const schemaName = 'demo_transition';

/**
 * This migration adds a new "calculation_mode" column to the transit schedules table.
 *
 * The "calculation_mode" column is used to define how the schedule is generated.
 * For now, two modes are supported:
 *  - "Symmetric": the default behavior where buses alternate in both directions.
 *  - "Asymmetric": a new mode allowing more flexible scheduling, where
 *    outbound and inbound trips can follow different intervals and patterns.
 *
 * This change lays the foundation for supporting additional scheduling strategies
 * in the future, such as:
 *  - peak-only directions
 *  - custom direction patterns
 *  - dynamic intervals...
 *
 * @param knex The database connection
 * @returns A promise to alter the table
 */
export async function up(knex: Knex): Promise<unknown> {
    const hasColumn = await knex.schema.withSchema(schemaName).hasColumn(tableName, 'calculation_mode');
    if (!hasColumn) {
        return knex.schema.withSchema(schemaName).alterTable(tableName, (table: Knex.TableBuilder) => {
            table.string('calculation_mode', 255);
        });
    }
    return Promise.resolve();
}

/**
 * Remove the "calculation_mode" column from the transit schedules table.
 *
 * @param knex The database connection
 * @returns A promise to alter the table
 */
export async function down(knex: Knex): Promise<unknown> {
    const hasColumn = await knex.schema.withSchema(schemaName).hasColumn(tableName, 'calculation_mode');
    if (hasColumn) {
        return knex.schema.withSchema(schemaName).alterTable(tableName, (table: Knex.TableBuilder) => {
            table.dropColumn('calculation_mode');
        });
    }
    return Promise.resolve();
}
