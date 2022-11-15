import * as Knex from 'knex';

const tableName = 'tr_transit_scenario_services';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    return knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table
            .uuid('scenario_id')
            .notNullable()
            .index(); // required
        table
            .foreign('scenario_id')
            .references('tr_transit_scenarios.id')
            .onDelete('CASCADE');
        table
            .uuid('service_id')
            .notNullable()
            .index(); // required
        table
            .foreign('service_id')
            .references('tr_transit_services.id')
            .onDelete('CASCADE');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
