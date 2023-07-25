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

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: ZoneAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: ZoneAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<ZoneAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<ZoneAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    deleteForDataSourceId: deleteForDataSourceId.bind(null, knex, tableName)
};
