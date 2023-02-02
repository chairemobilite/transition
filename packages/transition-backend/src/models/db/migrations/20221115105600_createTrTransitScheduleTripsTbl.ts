import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_transit_schedule_trips';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.uuid('schedule_id').notNullable().index(); // required
        table.foreign('schedule_id').references('tr_transit_schedules.id').onDelete('CASCADE');
        table.uuid('schedule_period_id').index(); // optional for trips not associated with periods
        table.foreign('schedule_period_id').references('tr_transit_schedule_periods.id').onDelete('CASCADE');
        table.uuid('path_id').notNullable().index(); // required
        table.foreign('path_id').references('tr_transit_paths.id').onDelete('CASCADE');
        table.uuid('unit_id').index(); // optional
        table.foreign('unit_id').references('tr_transit_units.id').onDelete('CASCADE');
        table.uuid('block_id').index(); // optional
        table.integer('departure_time_seconds').notNullable().index(); // required
        table.integer('arrival_time_seconds').notNullable().index(); // required
        table.integer('seated_capacity').index(); // optional
        table.integer('total_capacity').index(); // optional
        table.specificType('node_arrival_time_seconds', 'integer[]'); // must match path nodes array indexes
        table.specificType('node_departure_time_seconds', 'integer[]'); // must match path nodes array indexes
        table.specificType('nodes_can_board', 'boolean[]'); // must match path nodes array indexes
        table.specificType('nodes_can_unboard', 'boolean[]'); // must match path nodes array indexes
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
