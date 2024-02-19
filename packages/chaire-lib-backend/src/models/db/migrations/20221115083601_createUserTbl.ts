import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable('users')) {
        return;
    }
    await knex.schema.createTable('users', (table: Knex.TableBuilder) => {
        table.increments().unique();
        table.uuid('uuid').notNullable().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('username').unique().index();
        table.text('password');
        table.string('generated_password');
        table.string('email').unique().index();
        table.string('first_name');
        table.string('last_name');
        table.boolean('is_valid').index();
        table.boolean('is_admin').index();
        table.boolean('is_test').index();
        table.boolean('is_confirmed');
        table.text('confirmation_token');
        table.string('password_reset_token');
        table.timestamp('password_reset_expire_at');
        table.json('permissions');
        table.json('profile');
        table.json('preferences');
        table.string('google_id').unique();
        table.string('facebook_id').unique();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('batch_shortname').index();
    });
    return knex.raw(onUpdateTrigger('users'));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable('users');
}
