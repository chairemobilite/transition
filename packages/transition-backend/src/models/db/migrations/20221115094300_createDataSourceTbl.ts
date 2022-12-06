import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_data_sources';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        table.uuid('id').unique().notNullable().defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.string('shortname').index();
        table.string('name').index();
        table.text('description').index();
        table.json('data');
        table
            .enu(
                'type',
                [
                    // enum is a js reserved word
                    'none',
                    'other',
                    'gtfs',
                    'odTrips',
                    'transitSmartCardData',
                    'transitOperationalData',
                    'taxiTransactions',
                    'carSharingTransactions',
                    'bikeSharingTransactions',
                    'gpsTraces',
                    'streetSegmentSpeeds',
                    'zones',
                    'osmData',
                    'places'
                ],
                { useNative: true, enumName: 'tr_data_source_types' }
            )
            .index();
        table.timestamp('created_at').defaultTo(knex.raw('NOW()'));
        table.timestamp('updated_at');
        table.boolean('is_frozen');
    });
    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName).raw('DROP TYPE tr_data_source_types');
}
