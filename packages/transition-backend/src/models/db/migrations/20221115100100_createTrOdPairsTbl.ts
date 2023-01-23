import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_od_pairs';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.specificType('integer_id', 'serial').index(); // unique per data source uuid
        table.string('internal_id');
        table.uuid('data_source_id').index();
        table.foreign('data_source_id').references('tr_data_sources.id').onDelete('CASCADE');
        table.integer('time_of_trip');
        table.integer('time_type');
        table.specificType('origin_geography', 'geography(POINT)');
        table.specificType('destination_geography', 'geography(POINT)');
        table.index('origin_geography', undefined, 'gist');
        table.index('destination_geography', undefined, 'gist');
        table.json('data');
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
