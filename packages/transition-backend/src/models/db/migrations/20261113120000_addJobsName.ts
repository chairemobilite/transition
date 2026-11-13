/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Knex } from 'knex';

const tableName = 'tr_jobs';

export async function up(knex: Knex): Promise<unknown> {
    await knex.schema.alterTable(tableName, (table) => {
        table.text('name').nullable();
    });
    // The batch accessibility map jobs already have a name typed by the user,
    // saved with their parameters. It is copied, not moved: the parameters
    // of a job stay as they were when it was run.
    return knex(tableName)
        .where('type', 'batchAccessMap')
        .update({
            name: knex.raw('nullif(trim(data->\'parameters\'->\'batchAccessMapAttributes\'->>\'calculationName\'), \'\')')
        });
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.alterTable(tableName, (table) => {
        table.dropColumn('name');
    });
}
