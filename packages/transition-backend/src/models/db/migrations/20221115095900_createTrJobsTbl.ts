import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_jobs';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.increments();
        table
            .integer('user_id')
            .notNullable()
            .index();
        table
            .foreign('user_id')
            .references('users.id')
            .onDelete('CASCADE');
        table.string('name');
        table
            .enu(
                'status',
                [
                    // enum is a js reserved word
                    'pending',
                    'inProgress',
                    'completed',
                    'failed',
                    'cancelled'
                ],
                { useNative: true, enumName: 'tr_jobs_status' }
            )
            .index();
        table.json('data');
        table.json('resources');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName).raw('DROP TYPE tr_jobs_status');
}
