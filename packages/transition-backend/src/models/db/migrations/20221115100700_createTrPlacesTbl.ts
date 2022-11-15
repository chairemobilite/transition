import * as Knex from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_places';

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
        table.specificType('integer_id', 'serial').index(); // unique per data source uuid
        table.string('internal_id').index();
        table.uuid('data_source_id').index();
        table
            .foreign('data_source_id')
            .references('tr_data_sources.id')
            .onDelete('CASCADE');
        table.string('shortname').index();
        table.string('name').index();
        table.specificType('geography', 'geography(POINT)');
        table.index('geography', undefined, 'gist');
        table.string('description');
        table.integer('walking_20min_accessible_nodes_count');
        table.integer('walking_15min_accessible_nodes_count');
        table.integer('walking_10min_accessible_nodes_count');
        table.integer('walking_5min_accessible_nodes_count');
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
