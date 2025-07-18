/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { truncate } from 'chaire-lib-backend/lib/models/db/default.db.queries';

interface CensusAttributes {
    id: number;
    zone_id: string;
    population: number;
}

const tableName = 'tr_census';
const parentTable = 'tr_zones';

const collection = async (): Promise<CensusAttributes[]> => {
    try {
        const response = await knex(tableName).select();
        return response;
    } catch (error) {
        throw new TrError(
            `cannot fetch census collection because of a database error (knex error: ${error})`,
            'CSDB0001',
            'CensusCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const addPopulationBatch = async (inputArray: { internalId: string; population: number }[]): Promise<void> => {
    try {
        if (inputArray.length === 0) {
            return;
        }

        await knex.transaction(async (trx) => {
            const data = inputArray.map((input) => [input.internalId, Number(input.population ?? 0)]); //In case of a nullish population value, insert a 0 instead.
            const placeholders = data.map(() => '(?, ?)').join(',');
            const bindings = data.flat();

            const query = `
                INSERT INTO ${tableName} (zone_id, population)
                SELECT z.id, v.population::integer
                FROM (VALUES ${placeholders}) AS v(internal_id, population)
                JOIN ${parentTable} z ON z.internal_id = v.internal_id
                ON CONFLICT (zone_id) DO UPDATE
                SET population = EXCLUDED.population
            `;

            await trx.raw(query, bindings);
        });
    } catch (error) {
        throw new TrError(
            `Problem adding new object to table ${tableName} (knex error: ${error})`,
            'CSDB0002',
            'ProblemAddingObject'
        );
    }
};

export default {
    collection,
    truncate: truncate.bind(null, knex, tableName),
    addPopulationBatch
};
