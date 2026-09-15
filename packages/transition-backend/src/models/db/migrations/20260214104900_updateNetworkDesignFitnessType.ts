/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_jobs_network_design_results';
const simulationMethodTableName = 'tr_jobs_network_design_simulation_results';

/**
 * Update the fitness score type from decimal to float to avoid large
 * fitnesses scores causing database errors.
 * @param knex
 * @returns
 */
export async function up(knex: Knex): Promise<unknown> {
    await knex.schema.alterTable(simulationMethodTableName, (table: Knex.TableBuilder) => {
        table.double('fitness_score').notNullable().alter();
    });
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.double('total_fitness').notNullable().alter();
    });
}

export async function down(knex: Knex): Promise<unknown> {
    await knex.schema.alterTable(simulationMethodTableName, (table: Knex.TableBuilder) => {
        table.decimal('fitness_score').notNullable().alter();
    });
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.decimal('total_fitness').notNullable().alter();
    });
}
