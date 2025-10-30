/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Knex } from 'knex';

const tableName = 'tr_weighting_models';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('calculation');
        table.text('notes').nullable();
        table.text('references').nullable();
    });

    // Populate with available weighting models
    await knex(tableName).insert([
        {
            name: 'Weight Only',
            calculation: 'weight_only',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Walking, exponent 1)',
            calculation: 'gravity_walking_1',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Walking, exponent 2)',
            calculation: 'gravity_walking_2',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Cycling, exponent 1)',
            calculation: 'gravity_cycling_1',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Cycling, exponent 2)',
            calculation: 'gravity_cycling_2',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Driving, exponent 1)',
            calculation: 'gravity_driving_1',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Driving, exponent 2)',
            calculation: 'gravity_driving_2',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Distance, exponent 1)',
            calculation: 'gravity_distance',
            notes: null,
            references: null
        },
        {
            name: 'Gravity Model (Distance, exponent 2)',
            calculation: 'gravity_distance_squared',
            notes: null,
            references: null
        }
    ]);
}

export async function down(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        // Delete seeded weighting models before dropping the table
        await knex(tableName)
            .whereIn('calculation', [
                'weight_only',
                'gravity_walking_1',
                'gravity_walking_2',
                'gravity_cycling_1',
                'gravity_cycling_2',
                'gravity_driving_1',
                'gravity_driving_2',
                'gravity_distance',
                'gravity_distance_squared'
            ])
            .delete();
        return knex.schema.dropTable(tableName);
    }
}
