import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_schedule_periods';

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
        table
            .uuid('schedule_id')
            .notNullable()
            .index(); // required
        table
            .foreign('schedule_id')
            .references('tr_transit_schedules.id')
            .onDelete('CASCADE');
        table.uuid('outbound_path_id').index(); // optional, eventually make it required, but gtfs sets both path to null
        table
            .foreign('outbound_path_id')
            .references('tr_transit_paths.id')
            .onDelete('CASCADE');
        table.uuid('inbound_path_id').index(); // optional for loops or single direction
        table
            .foreign('inbound_path_id')
            .references('tr_transit_paths.id')
            .onDelete('CASCADE');
        table
            .string('period_shortname')
            .notNullable()
            .index(); // required
        table.integer('interval_seconds').index(); // interval_seconds or number_of_units must be set
        table.integer('number_of_units').index(); // interval_seconds or number_of_units must be set
        table
            .integer('period_start_at_seconds')
            .notNullable()
            .index(); // required
        table
            .integer('period_end_at_seconds')
            .notNullable()
            .index(); // required
        table.integer('custom_start_at_seconds').index(); // optional
        table.integer('custom_end_at_seconds').index(); // optional
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
