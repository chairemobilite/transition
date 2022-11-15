import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_scenarios';

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
        table.string('name').index();
        table.string('color');
        table
            .boolean('is_enabled')
            .index()
            .defaultTo(true);
        table.text('description');
        table.specificType('only_agencies', 'uuid[]');
        table.specificType('only_lines', 'uuid[]');
        table.specificType('only_nodes', 'uuid[]');
        table.specificType('only_modes', 'varchar[]');
        table.specificType('except_agencies', 'uuid[]');
        table.specificType('except_lines', 'uuid[]');
        table.specificType('except_nodes', 'uuid[]');
        table.specificType('except_modes', 'varchar[]');
        table.index('only_agencies', undefined, 'GIN');
        table.index('only_lines', undefined, 'GIN');
        table.index('only_nodes', undefined, 'GIN');
        table.index('only_modes', undefined, 'GIN');
        table.index('except_agencies', undefined, 'GIN');
        table.index('except_lines', undefined, 'GIN');
        table.index('except_nodes', undefined, 'GIN');
        table.index('except_modes', undefined, 'GIN');
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
        table.boolean('is_frozen').index();
        table.uuid('simulation_id').index();
        table
            .foreign('simulation_id')
            .references('tr_simulations.id')
            .onDelete('CASCADE');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
