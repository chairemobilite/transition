/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Knex } from 'knex';

const scheduleTable = 'tr_transit_schedules';
const schedulePeriodTable = 'tr_transit_schedule_periods';

/**
 * This migration adds:
 * - a "calculation_mode" column to the transit schedules table
 * - an "inbound_interval_seconds" column to the schedule periods table
 *
 * These changes support new scheduling modes, such as:
 * - "Symmetric": traditional alternating trips
 * - "Asymmetric": different intervals and patterns for each direction
 */
export async function up(knex: Knex): Promise<void> {
    // Add "calculation_mode" column to tr_transit_schedules
    const hasCalculationMode = await knex.schema.hasColumn(scheduleTable, 'calculation_mode');
    if (!hasCalculationMode) {
        await knex.schema.alterTable(scheduleTable, (table) => {
            table.string('calculation_mode', 255);
        });
    }

    // Add "inbound_interval_seconds" to tr_transit_schedule_periods
    const hasInboundInterval = await knex.schema.hasColumn(schedulePeriodTable, 'inbound_interval_seconds');
    if (!hasInboundInterval) {
        await knex.schema.alterTable(schedulePeriodTable, (table) => {
            table.integer('inbound_interval_seconds');
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasCalculationMode = await knex.schema.hasColumn(scheduleTable, 'calculation_mode');
    if (hasCalculationMode) {
        await knex.schema.alterTable(scheduleTable, (table) => {
            table.dropColumn('calculation_mode');
        });
    }

    const hasInboundInterval = await knex.schema.hasColumn(schedulePeriodTable, 'inbound_interval_seconds');
    if (hasInboundInterval) {
        await knex.schema.alterTable(schedulePeriodTable, (table) => {
            table.dropColumn('inbound_interval_seconds');
        });
    }
}
