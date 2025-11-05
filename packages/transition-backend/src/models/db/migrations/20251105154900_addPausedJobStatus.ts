/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const statusEnumName = 'tr_jobs_status';
const newEnumValue = 'paused';

export async function up(knex: Knex): Promise<unknown> {
    return await knex.raw(`ALTER TYPE ${statusEnumName} ADD VALUE '${newEnumValue}';`);
}

export async function down(): Promise<unknown> {
    // It is not recommended to remove values from an enum type in postgres as
    // it may cause data corruption if rows were using it. We just keep it
    return;
}
