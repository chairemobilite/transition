/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
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
    deleteForDataSourceId,
    truncate,
    destroy,
    stringifyDataSourceIds
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { BaseOdTripAttributes } from 'transition-common/lib/services/odTrip/BaseOdTrip';

const tableName = 'tr_od_pairs';
const st = knexPostgis(knex);

const attributesCleaner = function(attributes: Partial<BaseOdTripAttributes>): { [key: string]: any } {
    const {
        id,
        integer_id,
        internal_id,
        origin_geography,
        destination_geography,
        data,
        dataSourceId,
        timeOfTrip,
        timeType
    } = attributes;
    const _attributes: any = {
        data_source_id: dataSourceId,
        time_of_trip: timeOfTrip,
        time_type: timeType === 'departure' ? 0 : timeType === 'arrival' ? 1 : undefined,
        id,
        integer_id,
        internal_id,
        origin_geography,
        destination_geography,
        data
    };

    if (_attributes.origin_geography) {
        _attributes.origin_geography = st.geomFromGeoJSON(JSON.stringify(_attributes.origin_geography));
    }
    if (_attributes.destination_geography) {
        _attributes.destination_geography = st.geomFromGeoJSON(JSON.stringify(_attributes.destination_geography));
    }
    return _attributes;
};

const attributesParser = (dbAttributes: {
    id: string;
    integer_id: number;
    internal_id: string;
    origin_geography: GeoJSON.Point;
    destination_geography: GeoJSON.Point;
    data_source_id: string;
    time_of_trip: number;
    time_type: number;
    data: { [key: string]: unknown };
}): Partial<BaseOdTripAttributes> => ({
    id: dbAttributes.id,
    integer_id: dbAttributes.integer_id,
    internal_id: dbAttributes.internal_id || undefined,
    origin_geography: dbAttributes.origin_geography,
    destination_geography: dbAttributes.destination_geography,
    dataSourceId: dbAttributes.data_source_id || undefined,
    timeOfTrip: dbAttributes.time_of_trip,
    timeType: dbAttributes.time_type === 0 ? 'departure' : 'arrival',
    data: dbAttributes.data
});

const collection = async (dataSourceIds?: string[], sampleSize?: number): Promise<BaseOdTripAttributes[]> => {
    const dataSourceIdsStr = stringifyDataSourceIds(dataSourceIds || []);
    try {
        const response = await knex.raw(`
      SELECT 
        *,
        CASE origin_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(origin_geography)::jsonb END as origin_geography,
        CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(destination_geography)::jsonb END as destination_geography
      FROM ${tableName}
      ${dataSourceIdsStr.length > 0 ? `WHERE data_source_id IN (${dataSourceIdsStr.join(',')})` : ''}
      ORDER BY ${sampleSize !== undefined ? `RANDOM() LIMIT ${sampleSize}` : 'integer_id'};
    `);
        const collection = response?.rows;
        if (collection) {
            return collection.map(attributesParser);
        }
        throw new TrError(
            'cannot fetch od pairs collection because database did not return a valid array',
            'DBQPLC0001',
            'OdPairCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch od pairs collection because of a database error (knex error: ${error})`,
            'DBQPLC0002',
            'OdPairCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRDPLC0001',
                'DatabaseCannotReadOdPairBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(`
      SELECT
        *,
        CASE origin_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(origin_geography)::jsonb END as origin_geography,
        CASE destination_geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(destination_geography)::jsonb END as destination_geography
      FROM ${tableName}
      WHERE id = '${id}';
    `);
        const rows = response?.rows;
        if (rows && rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDPLC0002',
                'DatabaseCannotReadOdPairBecauseObjectDoesNotExist'
            );
        }
        return attributesParser(rows[0]);
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRDPLC0003',
            'DatabaseCannotReadOdPairBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: BaseOdTripAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: BaseOdTripAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<BaseOdTripAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<BaseOdTripAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    deleteForDataSourceId: deleteForDataSourceId.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
