import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_garages';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.specificType('integer_id', 'serial').unique().index();
        table.string('internal_id').index();
        table.uuid('agency_id').index();
        table.foreign('agency_id').references('tr_transit_agencies.id').onDelete('CASCADE');
        table.string('name');
        table.specificType('geography', 'geography(POINT)');
        table.boolean('is_enabled').index().defaultTo(true);
        table.text('description');
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
