/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Knex } from 'knex';

const tableName = 'users';
const tokensTableName = 'tokens';

// The Facebook login was removed, so the Facebook ID of the users is dropped.
// The users who could only log in with Facebook can no longer log in, so they
// are deleted, with what they own. Rolling back adds the column back, without
// the IDs and users that were dropped.

export async function up(knex: Knex): Promise<void> {
    const facebookOnlyUserIds = (
        await knex(tableName)
            .select('id')
            .whereNotNull('facebook_id')
            .whereNull('username')
            .whereNull('email')
            .whereNull('google_id')
    ).map((user) => user.id);
    if (facebookOnlyUserIds.length > 0) {
        // The tokens do not cascade on delete
        await knex(tokensTableName).whereIn('user_id', facebookOnlyUserIds).del();
        await knex(tableName).whereIn('id', facebookOnlyUserIds).del();
        console.log(
            `Deleted ${facebookOnlyUserIds.length} user(s) who could only log in with Facebook, with IDs ${facebookOnlyUserIds.join(', ')}`
        );
    }
    await knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.dropColumn('facebook_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable(tableName, (table: Knex.TableBuilder) => {
        table.string('facebook_id').unique();
    });
}
