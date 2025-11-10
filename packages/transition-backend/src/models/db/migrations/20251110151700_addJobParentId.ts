/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_jobs';

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.integer('parent_job_id').nullable().unsigned();
        table.foreign('parent_job_id').references('id').inTable(tableName).onDelete('RESTRICT');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.dropColumn('parent_job_id');
    });
}
