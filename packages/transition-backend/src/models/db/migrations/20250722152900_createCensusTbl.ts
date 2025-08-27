/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_census';

/**
 * Creates the `tr_census` table if it does not already exist.
 *
 * The migration adds an auto-incrementing primary key, a UUID `zone_id` (indexed)
 * that references `tr_zones.id` with `ON DELETE CASCADE`, and an integer
 * `population` column. After creation, an update trigger is applied to the table.
 *
 * This function is idempotent: it returns immediately when the table already exists.
 *
 * @returns A promise that resolves when the migration and trigger installation complete.
 */
export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.increments();
        table.uuid('zone_id').index();
        table.foreign('zone_id').references('tr_zones.id').onDelete('CASCADE');
        table.integer('population');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

/**
 * Drops the tr_census table.
 *
 * Reverses the corresponding `up` migration by removing the `tr_census` table from the database.
 *
 * @returns A promise that resolves when the table drop operation completes.
 */
export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
