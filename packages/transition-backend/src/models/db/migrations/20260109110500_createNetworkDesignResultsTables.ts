/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';

const tableName = 'tr_jobs_network_design_results';
const simulationMethodTableName = 'tr_jobs_network_design_simulation_results';
const candidateLinesTableName = 'tr_jobs_network_design_candidate_lines';
const linesTbl = 'tr_transit_lines';
const pathsTbl = 'tr_transit_paths';

/**
 * Adds 3 tables to store the results of the evolutionary algorithm for network design:
 * - tr_jobs_network_design_results: stores the general results of each candidate per generation
 * - tr_jobs_network_design_simulation_results: stores the simulation results per candidate per simulation method
 * - tr_jobs_network_design_candidate_lines: stores the details of each candidate (lines, number of vehicles, etc)
 * @param knex
 * @returns
 */
export async function up(knex: Knex): Promise<unknown> {
    if (!(await knex.schema.hasTable(tableName))) {
        await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
            table.increments('id').primary();
            table.integer('job_id').notNullable().index(); // required
            // Cascade delete the results when the job is deleted
            table.foreign('job_id').references('tr_jobs.id').onDelete('CASCADE');
            table.integer('generation_index').notNullable().index(); // required
            table.integer('candidate_index').notNullable().index(); // required
            table.decimal('total_fitness').notNullable(); // required
            // TODO We add this data field to store any additional information
            // about the candidate as we prototype the functionality. As the
            // algorithm is used more, and after feedback from users, see if
            // some of the fields there should be fields in the table instead.
            table.jsonb('data').defaultTo({}).notNullable();
            table.unique(['job_id', 'generation_index', 'candidate_index']);
        });
    }
    if (!(await knex.schema.hasTable(simulationMethodTableName))) {
        await knex.schema.createTable(simulationMethodTableName, (table: Knex.TableBuilder) => {
            table.integer('candidate_id').notNullable().index(); // required
            // Cascade delete the simulation results when the candidate result is deleted
            table.foreign('candidate_id').references(`${tableName}.id`).onDelete('CASCADE');
            table.string('simulation_method').notNullable(); // required
            table.decimal('fitness_score').notNullable(); // required
            // TODO We add this data field to store any additional information
            // about the simulation results as we prototype the functionality.
            // As the algorithm is used more, and after feedback from users, see
            // if some of the fields there should be fields in the table
            // instead.
            table.jsonb('data').defaultTo({}).notNullable();
        });
    }

    if (!(await knex.schema.hasTable(candidateLinesTableName))) {
        await knex.schema.createTable(candidateLinesTableName, (table: Knex.TableBuilder) => {
            table.integer('candidate_id').notNullable().index(); // required
            // Cascade delete the candidate lines when the candidate result is deleted
            table.foreign('candidate_id').references(`${tableName}.id`).onDelete('CASCADE');
            table.uuid('line_id').notNullable().index(); // required
            // Restrict deletion of lines that are used in candidate results
            table.foreign('line_id').references(`${linesTbl}.id`).onDelete('RESTRICT');
            table.integer('number_of_vehicles').notNullable(); // required
            table.decimal('time_between_passages').notNullable(); // required
            table.uuid('outbound_path_id').notNullable().index(); // required
            // Restrict deletion of lines that are used in candidate results
            table.foreign('outbound_path_id').references(`${pathsTbl}.id`).onDelete('RESTRICT');
            table.uuid('inbound_path_id').nullable().index(); // may not be there for loop lines
            // Restrict deletion of lines that are used in candidate results
            table.foreign('inbound_path_id').references(`${pathsTbl}.id`).onDelete('RESTRICT');
            // TODO We add this data field to store any additional information
            // about the candidate lines as we prototype the functionality. As
            // the algorithm is used more, and after feedback from users, see if
            // some of the fields there should be fields in the table instead.
            table.jsonb('data').defaultTo({}).notNullable();
        });
    }
    return;
}

export async function down(knex: Knex): Promise<unknown> {
    await knex.schema.dropTableIfExists(candidateLinesTableName);
    await knex.schema.dropTableIfExists(simulationMethodTableName);
    return knex.schema.dropTableIfExists(tableName);
}
