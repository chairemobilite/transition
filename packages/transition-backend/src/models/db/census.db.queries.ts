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

const getPopulationInPolygon = async (
    accessibilityPolygon: GeoJSON.MultiPolygon | GeoJSON.Polygon
): Promise<number | null> => {
    try {
        // Find all the zones that intersect the input polygon, and fetch their population, area, and the area of the intersection.
        // We multiply the population of each zone by the ratio between the area  of its intersection with the input polygon and its total area, to estimate the true population of zones that aren't entirely contained within the input polygon.
        // TO avoid division by zero in the edge case of a degenerate zone with no area, we use the NULLIF function.
        const populationResponse = await knex.raw(
            `
                SELECT COUNT(*) as row_count,
                ROUND(SUM(
                    population * 
                    ST_AREA(ST_INTERSECTION(ST_GeomFromGeoJSON(:polygon), geography::geometry)) / 
                    NULLIF(ST_AREA(geography::geometry), 0)
                )) as weighted_population
                FROM ${tableName} c JOIN ${parentTable} z ON c.zone_id = z.id
                WHERE ST_INTERSECTS(geography::geometry, ST_GeomFromGeoJSON(:polygon));
            `,
            { polygon: JSON.stringify(accessibilityPolygon) }
        );

        const result = populationResponse.rows[0];
        return Number(result.row_count) === 0 ? null : Number(result.weighted_population);
    } catch (error) {
        throw new TrError(`Problem getting population (knex error: ${error})`, 'CSDB0003', 'ProblemGettingPopulation');
    }
};

export default {
    collection,
    truncate: truncate.bind(null, knex, tableName),
    addPopulationBatch,
    getPopulationInPolygon
};
