/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

/**
 * Add 'propertyRegistry' to the tr_data_source_types enum so that
 * imported property / land-role registry data can be associated with
 * a typed data source.
 */
export async function up(knex: Knex): Promise<unknown> {
    return knex.raw('ALTER TYPE tr_data_source_types ADD VALUE IF NOT EXISTS \'propertyRegistry\'');
}

export async function down(_knex: Knex): Promise<unknown> {
    // PostgreSQL does not support removing individual enum values.
    // The value will remain in the enum but will not be used once
    // the corresponding table and data are deleted.
    return;
}
