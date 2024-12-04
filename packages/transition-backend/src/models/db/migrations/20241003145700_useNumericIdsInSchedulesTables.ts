/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const scheduleTblName = 'tr_transit_schedules';
const schedulePeriodTblName = 'tr_transit_schedule_periods';
const scheduleTripTblName = 'tr_transit_schedule_trips';

/**
 * This migration changes the primary key column of the 3 tables describing
 * schedules to be a numeric auto-increment ID. It is not necessary to have a
 * uuid and numeric auto-increment IDs will allow more performant duplication
 * operations, among other things.
 *
 * We keep the uuid columns, but it will not be used as primary or foreign keys
 * anymore, just for json2capnp conversion.
 *
 * After this migration, the currently named *_id columns in the 3 schedule
 * tables will now be integers instead of uuid, the trip does not force a link
 * to the schedule anymore as we have this link through the period.
 *
 * @param knex The database configuration object
 * @returns
 */
export async function up(knex: Knex): Promise<unknown> {
    // Rename the current uuid columns, and drop the foreign key constraints for now
    await knex.schema.alterTable(scheduleTblName, (table: Knex.TableBuilder) => {
        table.renameColumn('id', 'uuid');
    });
    await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.renameColumn('id', 'uuid');
        table.renameColumn('schedule_id', 'schedule_uuid');
        table.dropForeign('schedule_id');
    });
    await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.renameColumn('id', 'uuid');
        table.renameColumn('schedule_id', 'schedule_uuid');
        table.renameColumn('schedule_period_id', 'schedule_period_uuid');
        table.dropForeign('schedule_id');
        table.dropForeign('schedule_period_id');
    });

    // Drop all primary keys from table, to better recreate them
    await knex.schema.alterTable(scheduleTblName, (table: Knex.TableBuilder) => {
        table.dropPrimary();
    });
    await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.dropPrimary();
    });
    await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.dropPrimary();
    });

    // Add the new auto-incrementing primary key id columns and columns for
    // foreign key with nullable values
    await knex.schema.alterTable(scheduleTblName, (table: Knex.TableBuilder) => {
        table.increments();
    });
    await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.increments();
        table.integer('schedule_id').nullable();
    });
    await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.increments();
        table.integer('schedule_period_id').nullable();
    });

    // Set the values for the foreign key columns
    await knex.raw(`
        UPDATE ${schedulePeriodTblName} sp
        SET schedule_id = s.id
        FROM ${scheduleTblName} s
        WHERE sp.schedule_uuid = s.uuid;
    `);
    await knex.raw(`
        UPDATE ${scheduleTripTblName} st
        SET schedule_period_id = sp.id
        FROM ${schedulePeriodTblName} sp
        WHERE st.schedule_period_uuid = sp.uuid;
    `);

    // Drop the previous foreign uuid key columns, make the new foreign key
    // columns not nullable and add foreign key constraints
    await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.dropColumns('schedule_uuid', 'schedule_period_uuid');
        table.integer('schedule_period_id').notNullable().index().alter();
        table.foreign('schedule_period_id').references(`${schedulePeriodTblName}.id`).onDelete('CASCADE');
    });
    return await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.dropColumns('schedule_uuid');
        table.integer('schedule_id').notNullable().index().alter();
        table.foreign('schedule_id').references(`${scheduleTblName}.id`).onDelete('CASCADE');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    // Create the uuid foreign key columns in tables
    await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.uuid('schedule_uuid').nullable();
    });
    await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.uuid('schedule_uuid').nullable();
        table.uuid('schedule_period_uuid').nullable();
    });

    // Set the values of the uuid columns from current id columns
    await knex.raw(`
        UPDATE ${schedulePeriodTblName} sp
        SET schedule_uuid = s.uuid
        FROM ${scheduleTblName} s
        WHERE sp.schedule_id = s.id;
    `);
    await knex.raw(`
        UPDATE ${scheduleTripTblName} st
        SET schedule_period_uuid = sp.uuid, schedule_uuid = s.uuid
        FROM ${schedulePeriodTblName} sp
        INNER JOIN ${scheduleTblName} s ON sp.schedule_id = s.id
        WHERE st.schedule_period_id = sp.id;
    `);

    // Delete the id columns, set uuids as primary keys and make foreign key columns not nullable and indexed
    await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.dropColumns('id', 'schedule_period_id');
        table.uuid('uuid').primary().alter();
        table.uuid('schedule_period_uuid').notNullable().index().alter();
        table.uuid('schedule_uuid').notNullable().index().alter();
    });
    await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.dropColumns('id', 'schedule_id');
        table.uuid('uuid').primary().alter();
        table.uuid('schedule_uuid').notNullable().index().alter();
    });
    await knex.schema.alterTable(scheduleTblName, (table: Knex.TableBuilder) => {
        table.dropColumn('id');
        table.uuid('uuid').primary().alter();
    });

    // Revert name change and add foreign key constraints
    await knex.schema.alterTable(scheduleTblName, (table: Knex.TableBuilder) => {
        table.renameColumn('uuid', 'id');
    });
    await knex.schema.alterTable(schedulePeriodTblName, (table: Knex.TableBuilder) => {
        table.renameColumn('uuid', 'id');
        table.renameColumn('schedule_uuid', 'schedule_id');
        table.foreign('schedule_id').references('tr_transit_schedules.id').onDelete('CASCADE');
    });
    return await knex.schema.alterTable(scheduleTripTblName, (table: Knex.TableBuilder) => {
        table.renameColumn('uuid', 'id');
        table.renameColumn('schedule_uuid', 'schedule_id');
        table.renameColumn('schedule_period_uuid', 'schedule_period_id');
        table.foreign('schedule_id').references('tr_transit_schedules.id').onDelete('CASCADE');
        table.foreign('schedule_period_id').references('tr_transit_schedule_periods.id').onDelete('CASCADE');
    });
}
