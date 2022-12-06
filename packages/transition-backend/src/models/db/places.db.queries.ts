/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash.clonedeep';
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
import { PlaceAttributes } from 'transition-common/lib/services/places/Place';

const tableName = 'tr_places';
const st = knexPostgis(knex);

const attributesCleaner = function (attributes: Partial<PlaceAttributes>): { [key: string]: any } {
    const _attributes: any = _cloneDeep(attributes);
    if (_attributes.geography) {
        _attributes.geography = st.geomFromGeoJSON(JSON.stringify(_attributes.geography));
    }
    if (_attributes.data) {
        delete _attributes.data.nodes;
        delete _attributes.data.nodesTravelTimes;
        delete _attributes.data.nodesDistances;
    }
    return _attributes;
};

const collection = async (dataSourceIds: string[] = [], sampleSize?: number): Promise<PlaceAttributes[]> => {
    const dataSourceIdsStr = stringifyDataSourceIds(dataSourceIds || []);
    try {
        const response = await knex.raw(`
        SELECT 
        *,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName}
      ${dataSourceIdsStr.length > 0 ? `WHERE data_source_id IN (${dataSourceIdsStr.join(',')})` : ''}
      ORDER BY ${sampleSize !== undefined ? `RANDOM() LIMIT ${sampleSize}` : 'integer_id'};
    `);
        const collection = response?.rows;
        if (collection) {
            return collection;
        }
        throw new TrError(
            'cannot fetch places collection because database did not return a valid array',
            'DBQPLC0001',
            'PlaceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch places collection because of a database error (knex error: ${error})`,
            'DBQPLC0002',
            'PlaceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const geojsonCollection = async (
    dataSourceIds: string[] = [],
    sampleSize?: number
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point, PlaceAttributes>> => {
    // TODO: we should not fetch the whole data content, we should read place when modifying one instead of creating a Place from the geojson
    const dataSourceIdsStr = stringifyDataSourceIds(dataSourceIds);
    try {
        const response = await knex.raw(`
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
          ) as geojson
          FROM (
            SELECT jsonb_build_object(
              'type'      , 'Feature',
              'id'        , inputs.integer_id,
              'geometry'  , ST_AsGeoJSON(inputs.geography)::jsonb,
              'properties', inputs.properties
            ) AS feature
            FROM (
              SELECT 
                id,
                geography,
                integer_id,
                json_build_object(
                  'id'                , id,
                  'data_source_id'    , data_source_id,
                  'internal_id'       , internal_id,
                  'integer_id'        , integer_id,
                  'shortname'         , shortname,
                  'name'              , name,
                  'is_frozen'         , is_frozen,
                  'description'       , description,
                  'data'              , data,
                  'walking_5min_accessible_nodes_count', walking_5min_accessible_nodes_count,
                  'walking_10min_accessible_nodes_count', walking_10min_accessible_nodes_count,
                  'walking_15min_accessible_nodes_count', walking_15min_accessible_nodes_count,
                  'walking_20min_accessible_nodes_count', walking_20min_accessible_nodes_count
                ) AS properties
              FROM ${tableName}
              ${
    dataSourceIdsStr && dataSourceIdsStr.length > 0
        ? `WHERE data_source_id IN (${dataSourceIdsStr.join(',')})`
        : ''
}
              ORDER BY ${sampleSize !== undefined ? `RANDOM() LIMIT ${sampleSize}` : 'integer_id'}
            ) inputs
          ) features;
    `);
        const geojson = response.rows[0]?.geojson;
        if (geojson) {
            return geojson;
        }
        throw new TrError(
            'cannot fetch places geojson collection because database did not return a valid geojson',
            'DBQHGC0001',
            'PlaceGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch places geojson collection because of a database error (knex error: ${error})`,
            'DBQDGH0002',
            'PlaceGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const countForDataSources = async (dataSourceIds: string[] = []): Promise<{ [key: string]: number }> => {
    const dataSourceIdsStr = stringifyDataSourceIds(dataSourceIds);
    try {
        const query = knex(tableName).select('data_source_id', knex.raw('count(id)'));
        if (dataSourceIdsStr && dataSourceIdsStr.length > 0) {
            query.whereRaw(`data_source_id IN (${dataSourceIdsStr.join(',')})`);
        }
        query.groupBy('data_source_id');

        const rows = await query;

        const countByDataSourceId = {};
        rows.forEach((row) => (countByDataSourceId[row.data_source_id] = Number.parseInt(row.count)));
        return countByDataSourceId;
    } catch (error) {
        throw new TrError(
            `cannot get places count by data source because of a database error (knex error: ${error})`,
            'DBQDGH0003',
            'PlaceCountByDsCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRDPLC0001',
                'DatabaseCannotReadPlaceBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(`
      SELECT
        *,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName}
      WHERE id = '${id}'
      ORDER BY integer_id;
    `);
        const rows = response?.rows;
        if (rows && rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDPLC0002',
                'DatabaseCannotReadPlaceBecauseObjectDoesNotExist'
            );
        }
        return rows[0];
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRDPLC0003',
            'DatabaseCannotReadPlaceBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: PlaceAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: PlaceAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<PlaceAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<PlaceAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    deleteForDataSourceId: deleteForDataSourceId.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    geojsonCollection,
    countForDataSources
};
