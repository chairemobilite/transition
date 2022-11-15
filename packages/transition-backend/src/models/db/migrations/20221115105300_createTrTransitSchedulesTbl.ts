import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_schedules';

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
            .uuid('line_id')
            .notNullable()
            .index(); // required
        table
            .foreign('line_id')
            .references('tr_transit_lines.id')
            .onDelete('CASCADE');
        table
            .uuid('service_id')
            .notNullable()
            .index(); // required
        table
            .foreign('service_id')
            .references('tr_transit_services.id')
            .onDelete('CASCADE');
        table
            .string('periods_group_shortname')
            .notNullable()
            .index(); // required, for schedules with no associated periods, choose all_day as periods group shortname and all_day as period shortname
        table
            .boolean('allow_seconds_based_schedules')
            .defaultTo(false)
            .index();
        table.boolean('is_frozen').index();
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
        table.unique(['service_id', 'line_id']);
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
