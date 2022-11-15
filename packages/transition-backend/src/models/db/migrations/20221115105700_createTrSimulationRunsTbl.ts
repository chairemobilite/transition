import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_simulation_runs';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table
            .uuid('id')
            .unique()
            .notNullable()
            .defaultTo(knex.raw('gen_random_uuid()'))
            .primary();
        table.specificType('integer_id', 'serial').index(); // unique per data source uuid
        table.string('internal_id');
        table.uuid('simulation_id').index();
        table
            .foreign('simulation_id')
            .references('tr_simulations.id')
            .onDelete('CASCADE');
        table.string('seed');
        table
            .enu(
                'status',
                [
                    // enum is a js reserved word
                    'notStarted',
                    'pending',
                    'inProgress',
                    'completed',
                    'failed'
                ],
                { useNative: true, enumName: 'tr_simulation_runs_status' }
            )
            .index();
        table.json('data');
        table.json('options');
        table.json('results');
        table.timestamp('started_at');
        table.timestamp('completed_at');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName).raw('DROP TYPE tr_simulation_runs_status');
}
