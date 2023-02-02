import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_units';

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
        table.uuid('garage_id').index();
        table.foreign('garage_id').references('tr_transit_garages.id').onDelete('SET NULL');
        table.uuid('line_id').index();
        table.foreign('line_id').references('tr_transit_lines.id').onDelete('SET NULL');
        table.string('mode').index();
        table.integer('manufacturer').index();
        table.integer('model').index();
        table.integer('capacity_seated').index();
        table.integer('capacity_standing').index();
        table.integer('number_of_vehicles').index(); // number of trailers or cars
        table.integer('number_of_doors').index();
        table.integer('number_of_door_channels').index();
        table.string('license_number');
        table.string('serial_number');
        table.float('length_m');
        table.float('width_m');
        table.json('data');
        table.boolean('is_enabled').index().defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
        table.boolean('is_frozen').index();
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
