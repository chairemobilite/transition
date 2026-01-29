/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
import knexPostgis from 'knex-postgis';
import { validate as uuidValidate } from 'uuid';

import {
    exists,
    create,
    createMultiple,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy,
    deleteForDataSourceId
} from './default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { ZoneAttributes } from 'chaire-lib-common/lib/services/zones/Zone';

const tableName = 'tr_zones';
const dataSourceTbl = 'tr_data_sources';
const st = knexPostgis(knex);

const attributesCleaner = function (attributes: Partial<ZoneAttributes>): { [key: string]: any } {
    const { id, internal_id, shortname, name, geography, data, dataSourceId } = attributes;
    const _attributes: any = {
        id,
        internal_id,
        shortname,
        name,
        geography: geography !== undefined ? st.geomFromGeoJSON(JSON.stringify(geography)) : undefined,
        data,
        data_source_id: dataSourceId
    };

    return _attributes;
};

const attributesParser = (dbAttributes: {
    id: string;
    internal_id: string;
    shortname: string;
    name: string;
    geography: GeoJSON.Polygon | GeoJSON.MultiPolygon;
    data_source_id: string;
    data: { [key: string]: unknown };
    created_at: string;
    updated_at: string;
}): ZoneAttributes => ({
    id: dbAttributes.id,
    internal_id: dbAttributes.internal_id || undefined,
    dataSourceId: dbAttributes.data_source_id || undefined,
    geography: dbAttributes.geography,
    shortname: dbAttributes.shortname || undefined,
    name: dbAttributes.name || undefined,
    data: dbAttributes.data,
    created_at: dbAttributes.created_at,
    updated_at: dbAttributes.updated_at
});

const collection = async (options: { dataSourceId?: string } = {}): Promise<ZoneAttributes[]> => {
    try {
        const query = knex(tableName).select(
            '*',
            knex.raw('CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography')
        );
        if (options.dataSourceId !== undefined) {
            query.where('data_source_id', options.dataSourceId);
        }
        query.orderBy('shortname');
        const collection = await query;
        if (collection) {
            return collection.map(attributesParser);
        }
        throw new TrError(
            'cannot fetch data sources collection because database did not return a valid array',
            'DBQDSC0001',
            'DataSourceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch data sources collection because of a database error (knex error: ${error})`,
            'DBQDSC0002',
            'DataSourceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQZONE0001',
                'DatabaseCannotReadZoneBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(`
      SELECT
        *,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName}
      WHERE id = '${id}';
    `);
        const rows = response?.rows;
        if (rows && rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQZONE0003',
                'DatabaseCannotReadZoneBecauseObjectDoesNotExist'
            );
        }
        return attributesParser(rows[0]);
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQZONE0003',
            'DatabaseCannotReadZoneBecauseDatabaseError'
        );
    }
};

const getZonesContaining = async (
    geography: GeoJSON.Feature,
    options?: { dsId?: string }
): Promise<(ZoneAttributes & { dsShortname: string; dsName: string })[]> => {
    try {
        const query = knex(`${tableName} as z`)
            .select(
                'z.*',
                knex.raw('CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography'),
                'ds.shortname as dsShortname',
                'ds.name as dsName'
            )
            .join(`${dataSourceTbl} as ds`, 'z.data_source_id', 'ds.id')
            .where(st.intersects(st.geomFromGeoJSON(JSON.stringify(geography.geometry)), 'z.geography'));
        if (options && options.dsId) {
            query.where('z.data_source_id', options.dsId);
        }
        const response = await query;
        return response.map((zone) => {
            const { dsShortname, dsName, ...zoneAttribs } = zone;
            return {
                dsShortname,
                dsName,
                ...attributesParser(zoneAttribs)
            };
        });
    } catch (error) {
        throw new TrError(
            `Cannot get zones containing feature ${JSON.stringify(
                geography.geometry
            )} from table ${tableName} (knex error: ${error})`,
            'DBQZONE0004',
            'DatabaseGetZonesContainingBecauseDatabaseError'
        );
    }
};

/**
 * Imports the data of a zones array in the database (minus the geography), and then adds the geography after converting to WGS84, the format used by transition.
 *
 * @param inputArray An array of objects with the attributes 'zone', 'spatialReferenceId', and 'geography'.
 * @param inputArray[].zone The attributes of the zone that will be inserted into the database, minus the geography
 * @param inputArray[].spatialReferenceId An identifier representing the coordinate system of the geography we want to insert (see https://epsg.io/).
 * @param inputArray[].geography The geography of the zone that we want to convert to the WGS84 format.
 * Must be formatted as an OGC Well-Known text representation (for example, "POLYGON((0 1, 1 2, 2 3, 0 1))" )
 */
const addZonesAndConvertedGeography = async (
    inputArray: {
        zone: Omit<ZoneAttributes, 'geography'>;
        spatialReferenceId: string;
        geography: string;
    }[]
): Promise<void> => {
    try {
        if (inputArray.length === 0) {
            return;
        }

        await knex.transaction(async (trx) => {
            const zonesBatch = inputArray.map((input) => input.zone);
            const dbIdArray = await createMultiple(knex, tableName, attributesCleaner, zonesBatch, { returning: 'id' });

            const data = dbIdArray.map((id, index) => {
                if (!uuidValidate(id.id)) {
                    throw new TrError(
                        `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                        'DBQZONE0005',
                        'MissingZoneIdWhenAddingConvertedGeography'
                    );
                }
                return [id.id, inputArray[index].spatialReferenceId, inputArray[index].geography];
            });

            //The placeholder syntax allows us to repeat an operation on many rows of data with the same structure, each "(?, ?, ?)"" representing a row containing individual values from the three arrays we enter.
            const placeholders = data.map(() => '(?, ?, ?)').join(',');
            const bindings = data.flat();

            // The ST_Transform function will convert the zone boundary from one coordinate system to an other. The spatialReferenceId is the system used by the input, while 4326 is the id for WGS84, the system we want to convert to.

            // Some zones throw "topologyexception: Ring edge missing" errors when used in the ST_INTERSECTS() function, either due to an SQL bug or the input zone being self-intersecting. Passing them through ST_MAKEVALID() when importing them fixes this.
            // ST_INTERSECTS() is not used here, but in getPopulationInPolygon() of the tr_census table functions, which we use to calculate the population of an accessibility polygon.
            // We could use ST_MAKEVALID in the population calculation function, but we choose to do it here in the import to increase the performance for the user at the cost of making the import slightly slower.
            const query = `
                WITH input(id, spatialReferenceId, boundary) AS (VALUES ${placeholders})
                UPDATE ${tableName} z
                SET geography = ST_Transform(ST_MAKEVALID(ST_GeomFromText(input.boundary, input.spatialReferenceId::integer)), 4326)::geography
                FROM input
                WHERE z.id = input.id::uuid
            `;
            await trx.raw(query, bindings);
        });
    } catch (error) {
        throw new TrError(
            `Problem adding new object to table ${tableName} (knex error: ${error})`,
            'DBQZONE0005',
            'ProblemAddingObject'
        );
    }
};

/**
 * Updates the table, adding json data to the 'data' column on rows with specific 'internal_id'.
 *
 * @param inputArray An array of objects with the attributes 'internalId', and 'json'.
 * @param inputArray[].internalId The internal_id value of the row we want to modify.
 * @param inputArray[].json An object with the data we want to add to the row.
 */
const addJsonDataBatch = async (inputArray: { internalId: string; json: { [key: string]: any } }[]): Promise<void> => {
    try {
        if (inputArray.length === 0) {
            return;
        }

        await knex.transaction(async (trx) => {
            const data = inputArray.map((input) => [input.internalId, JSON.stringify(input.json)]);
            const placeholders = data.map(() => '(?, ?)').join(',');
            const bindings = data.flat();
            const query = `
                WITH input(internal_id, data) AS (VALUES ${placeholders})
                UPDATE ${tableName} z
                SET data = input.data::json
                FROM input
                WHERE z.internal_id = input.internal_id
            `;
            await trx.raw(query, bindings);
        });
    } catch (error) {
        throw new TrError(
            `Problem updating object in table ${tableName} (knex error: ${error})`,
            'DBQZONE0006',
            'ProblemUpdatingObject'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: ZoneAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, { returning });
    },
    createMultiple: (newObjects: ZoneAttributes[], returning?: string | string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, { returning });
    },
    update: (id: string, updatedObject: Partial<ZoneAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, { returning });
    },
    updateMultiple: (updatedObjects: Partial<ZoneAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, { returning });
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    deleteForDataSourceId: deleteForDataSourceId.bind(null, knex, tableName),
    getZonesContaining,
    addZonesAndConvertedGeography,
    addJsonDataBatch
};
