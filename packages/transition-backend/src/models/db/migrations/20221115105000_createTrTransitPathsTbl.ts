import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_paths';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.specificType('integer_id', 'serial').unique().index();
        table.string('internal_id').index();
        table.string('direction').index(); // outbound, inbound, loop or other
        table.uuid('line_id').index();
        table.foreign('line_id').references('tr_transit_lines.id').onDelete('CASCADE');
        table.string('name').index();
        table.boolean('is_enabled').index().defaultTo(true);
        table.specificType('geography', 'geography(LINESTRING)');
        table.specificType('nodes', 'uuid[]');
        table.specificType('stops', 'uuid[]');
        table.index('nodes', undefined, 'GIN');
        table.index('stops', undefined, 'GIN');
        table.specificType('segments', 'integer[]');
        table.text('description').index();
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
        table.boolean('is_frozen').index();
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
