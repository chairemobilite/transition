/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

/**
 * This migration adds:
 * - a "calculation_mode" column to the transit schedules table
 * - an "inbound_interval_seconds" column to the schedule periods table
 *
 * These changes support new scheduling modes, such as:
 * - "SymmetricSchedule": traditional alternating trips
 * - "AsymmetricSchedule": different intervals and patterns for each direction
 */
const scheduleTable = 'tr_transit_schedules';
const schedulePeriodTable = 'tr_transit_schedule_periods';
const calculationModeEnumName = 'tr_transit_schedules_calculation_mode';

export async function up(knex: Knex): Promise<void> {
    // Add "calculation_mode" as ENUM to tr_transit_schedules
    const hasCalculationMode = await knex.schema.hasColumn(scheduleTable, 'calculation_mode');
    if (!hasCalculationMode) {
        await knex.schema.alterTable(scheduleTable, (table) => {
            table.enu('calculation_mode', ['SymmetricSchedule', 'AsymmetricSchedule'], {
                useNative: true,
                enumName: calculationModeEnumName
            });
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
    // Remove "calculation_mode" column and enum type
    const hasCalculationMode = await knex.schema.hasColumn(scheduleTable, 'calculation_mode');
    if (hasCalculationMode) {
        await knex.schema.alterTable(scheduleTable, (table) => {
            table.dropColumn('calculation_mode');
        });
        await knex.raw(`DROP TYPE IF EXISTS ${calculationModeEnumName}`);
    }

    // Remove "inbound_interval_seconds" column
    const hasInboundInterval = await knex.schema.hasColumn(schedulePeriodTable, 'inbound_interval_seconds');
    if (hasInboundInterval) {
        await knex.schema.alterTable(schedulePeriodTable, (table) => {
            table.dropColumn('inbound_interval_seconds');
        });
    }
}
