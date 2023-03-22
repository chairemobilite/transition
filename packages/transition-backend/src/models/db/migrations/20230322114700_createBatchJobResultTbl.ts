import { Knex } from 'knex';

const tableName = 'tr_batch_route_results';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    return knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.integer('job_id').notNullable().index(); // required
        table.foreign('job_id').references('tr_jobs.id').onDelete('CASCADE');
        table.integer('trip_index').notNullable().index(); // required
        table.json('data');
        table.unique(['job_id', 'trip_index']);
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
