/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Knex from 'knex';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { validate as uuidValidate } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';
import knexPostgis from 'knex-postgis';

import {
    exists,
    create,
    createMultiple,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { PathAttributes } from 'transition-common/lib/services/path/Path';

const tableName = 'tr_transit_paths';
const linesTableName = 'tr_transit_lines';
const schedulesTableName = 'tr_transit_schedules';
const tripsTableName = 'tr_transit_schedule_trips';
const scenariosServicesTableName = 'tr_transit_scenario_services';
const st = knexPostgis(knex);

// TODO Type the return values
const attributesCleaner = function(attributes: Partial<PathAttributes>): { [key: string]: any } {
    const _attributes: any = _cloneDeep(attributes);
    if (_attributes.geography) {
        _attributes.geography = st.geomFromGeoJSON(JSON.stringify(attributes.geography));
    }
    delete _attributes.color;
    delete _attributes.mode;
    return _attributes;
};

const collection = async () => {
    try {
        const response = await knex.raw(
            `
      SELECT 
        p.*,
        /*l.agency_id,*/
        COALESCE(p.nodes,    '{}') as nodes,
        COALESCE(p.stops,    '{}') as stops,
        COALESCE(p.segments, '{}') as segments,
        COALESCE(l.color,    '${Preferences.current.transit.lines.defaultColor}') as color,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName} p
      LEFT JOIN tr_transit_lines l ON l.id = p.line_id
      WHERE p.is_enabled IS TRUE
      ORDER BY integer_id;
    `
        );
        const collection = response.rows;
        if (collection) {
            return collection;
        }
        throw new TrError(
            'cannot fetch transit paths collection because database did not return a valid geojson',
            'TPQC0001',
            'TransitPathsCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit paths collection because of a database error (knex error: ${error})`,
            'TPQC0002',
            'TransitPathsCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const getGeojsonBaseQuery = (noNullGeo?: boolean): Knex.QueryBuilder => {
    const query = knex(`${tableName} as p`)
        .leftJoin(`${linesTableName} as l`, 'p.line_id', 'l.id')
        .select(
            knex.raw(`
                p.id,
                p.geography,
                p.integer_id,
                json_build_object(
                  'id', p.id,
                  'internal_id', p.internal_id,
                  'direction', p.direction,
                  /*'agency_id', l.agency_id,*/
                  'line_id', p.line_id,
                  'name', p.name,
                  'is_frozen', p.is_frozen,
                  /*'geography', ST_AsGeoJSON(geography)::jsonb,*/
                  'data', p.data,
                  'description', p.description,
                  'is_enabled', p.is_enabled,
                  'created_at', p.created_at,
                  'updated_at', p.updated_at,
                  'integer_id', integer_id,
                  'nodes', COALESCE(p.nodes, '{}'),
                  'stops', COALESCE(p.stops, '{}'),
                  'segments', COALESCE(p.segments, '{}'),
                  'color', COALESCE(l.color, '${Preferences.current.transit.lines.defaultColor}'),
                  'mode', l.mode
                ) AS properties`)
        )
        .where('p.is_enabled', true)
        .orderBy('p.integer_id');
    if (noNullGeo === true) {
        query.whereNotNull('p.geography');
    }
    return query;
};

const geojsonCollectionFromQuery = async (query: Knex.QueryBuilder) => {
    // TODO: we should not fetch the whole data content, we should read path when modifying one instead of creating a Path from the geojson
    try {
        const featureQuery = knex
            .from(query.as('inputs'))
            .select(
                knex.raw(`
        jsonb_build_object(
            'type',       'Feature',
            'id',         inputs.integer_id,
            'geometry',   ST_AsGeoJSON(inputs.geography)::jsonb,
            'properties', inputs.properties
        ) as feature
        `)
            )
            .as('features');
        const response = await knex.from(featureQuery).select(
            knex.raw(`
        jsonb_build_object(
            'type',     'FeatureCollection',
            'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
        ) as geojson
        `)
        );
        const geojson = response.length === 1 ? response[0].geojson : undefined;
        if (geojson) {
            return geojson;
        }
        throw new TrError(
            'cannot fetch transit paths geojson collection because database did not return a valid geojson',
            'TPQPGC0001',
            'TransitPathsGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit paths geojson collection because of a database error (knex error: ${error})`,
            'TPQPGC0002',
            'TransitPathsGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

// TODO The noNullGeo should be the default, as null geography should not be acceptable, but the application's PathCollection expects all paths to be there. We'll need to update quite a few things before having noNullGeo by default and always. See #1740
const geojsonCollection = async (
    params: { scenarioId?: string; noNullGeo?: boolean } = {}
): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> => {
    const baseQuery = getGeojsonBaseQuery(params.noNullGeo);
    // TODO Replace those params by eventual calls to more specific methods like getPathsForScenario
    if (params.scenarioId) {
        baseQuery
            .innerJoin(`${tripsTableName} as trips`, 'trips.path_id', 'p.id')
            .innerJoin(`${schedulesTableName} as sched`, 'sched.id', 'trips.schedule_id')
            .innerJoin(`${scenariosServicesTableName} as sc`, 'sched.service_id', 'sc.service_id')
            .andWhere('sc.scenario_id', params.scenarioId)
            .groupBy('p.id', 'l.color', 'l.mode');
    }
    return await geojsonCollectionFromQuery(baseQuery);
};

const geojsonCollectionForServices = async (
    serviceIds: string[]
): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> => {
    if (serviceIds.length === 0) {
        return { type: 'FeatureCollection' as const, features: [] };
    }
    const baseQuery = getGeojsonBaseQuery(true);
    baseQuery
        .innerJoin(`${tripsTableName} as trips`, 'trips.path_id', 'p.id')
        .innerJoin(`${schedulesTableName} as sched`, 'sched.id', 'trips.schedule_id')
        .whereIn('sched.service_id', serviceIds)
        .groupBy('p.id', 'l.color', 'l.mode');
    return await geojsonCollectionFromQuery(baseQuery);
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRDP0001',
                'DatabaseCannotReadTransitPathBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(
            `
      SELECT
        p.*,
        /*l.agency_id,*/
        COALESCE(p.nodes,    '{}') as nodes,
        COALESCE(p.stops,    '{}') as stops,
        COALESCE(p.segments, '{}') as segments,
        COALESCE(l.color,    '${Preferences.current.transit.lines.defaultColor}') as color,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName} p
      LEFT JOIN tr_transit_lines l ON l.id = p.line_id
      WHERE p.id = '${id}' AND p.is_enabled IS TRUE
      ORDER BY integer_id;
    `
        );
        const rows = response.rows;
        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDP0002',
                'DatabaseCannotReadTransitPathBecauseObjectDoesNotExist'
            );
        }
        return rows[0];
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRDP0003',
            'DatabaseCannotReadTransitPathBecauseDatabaseError'
        );
    }
};

const deleteForLines = async (lineIds: string[]): Promise<string[]> => {
    try {
        if (_isBlank(lineIds) && lineIds.length > 0) {
            throw new TrError(
                'Cannot verify if transit paths exist because the required parameter lineIds is missing, blank or not a valid id/uuid',
                'DBQDLP0001',
                'TransitPathsCannotDeleteBecauseLineIdsIsMissingOrInvalid'
            );
        }
        const numberOfDeleteObjects = await knex('tr_transit_paths')
            .whereIn('line_id', lineIds)
            .del();
        if (numberOfDeleteObjects >= 0) {
            return lineIds;
        }
        throw new TrError(`Error while deleting transit paths with line ids ${lineIds} in database`, 'DBQDLP0002');
    } catch (error) {
        throw new TrError(
            `Cannot delete transit paths with for line ids ${lineIds} in database (knex error: ${error})`,
            'DBQDLP0003',
            'TransitPathsCannotDeleteBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: PathAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: PathAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<PathAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<PathAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    geojsonCollection,
    deleteForLines,
    geojsonCollectionForServices
};
