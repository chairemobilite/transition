import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_simulation_run_scenario';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    return knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table
            .uuid('simulation_run_id')
            .notNullable()
            .index(); // required
        table
            .foreign('simulation_run_id')
            .references('tr_simulation_runs.id')
            .onDelete('CASCADE');
        table
            .uuid('scenario_id')
            .notNullable()
            .index(); // required
        table
            .foreign('scenario_id')
            .references('tr_transit_scenarios.id')
            .onDelete('CASCADE');
        table.unique(['simulation_run_id', 'scenario_id']);
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
