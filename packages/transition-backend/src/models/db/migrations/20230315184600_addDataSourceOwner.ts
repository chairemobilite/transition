import { Knex } from 'knex';

const tableName = 'tr_data_sources';

export async function up(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.integer('owner').nullable().index();
        table.foreign('owner').references('users.id').onDelete('CASCADE');
    });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.dropColumn('owner');
    });
}
