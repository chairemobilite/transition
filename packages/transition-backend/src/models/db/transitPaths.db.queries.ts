/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { validate as uuidValidate } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
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
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { PathAttributes } from 'transition-common/lib/services/path/Path';

const tableName = 'tr_transit_paths';
const linesTableName = 'tr_transit_lines';
const schedulesTableName = 'tr_transit_schedules';
const periodsTableName = 'tr_transit_schedule_periods';
const tripsTableName = 'tr_transit_schedule_trips';
const scenariosServicesTableName = 'tr_transit_scenario_services';
const scenariosTableName = 'tr_transit_scenarios';
const st = knexPostgis(knex);

// TODO Type the return values
const attributesCleaner = function (attributes: Partial<PathAttributes>): { [key: string]: any } {
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
        // FIXME: Previously, the feature collection was coalesced by the
        // database with `COALESCE(jsonb_agg(features.feature), '[]'::jsonb)`,
        // but it was not performant. Having typescript handle the coalescing
        // divides by 3 the time to fetch the data for large networks. See if we
        // can improve the query to have the DB do the coalescing
        const features = await featureQuery;
        const geojson = {
            type: 'FeatureCollection' as const,
            features: features.map((f: any) => f.feature)
        };
        return geojson;
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
            .innerJoin(`${periodsTableName} as periods`, 'periods.id', 'trips.schedule_period_id')
            .innerJoin(`${schedulesTableName} as sched`, 'sched.id', 'periods.schedule_id')
            .innerJoin(`${scenariosServicesTableName} as scServ`, 'sched.service_id', 'scServ.service_id')
            .innerJoin(`${scenariosTableName} as sc`, 'scServ.scenario_id', 'sc.id')
            .andWhere('sc.id', params.scenarioId)
            .whereRaw(knex.raw('(sc.only_lines = \'{}\' or l.id = ANY(sc.only_lines))'))
            .whereRaw(knex.raw('(sc.except_lines = \'{}\' or l.id != ALL(sc.except_lines))'))
            .whereRaw(knex.raw('(sc.only_agencies = \'{}\' or l.agency_id = ANY(sc.only_agencies))'))
            .whereRaw(knex.raw('(sc.except_agencies = \'{}\' or l.agency_id != ALL(sc.except_agencies))'))
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
        .innerJoin(`${periodsTableName} as periods`, 'periods.id', 'trips.schedule_period_id')
        .innerJoin(`${schedulesTableName} as sched`, 'sched.id', 'periods.schedule_id')
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

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: async (newObject: PathAttributes, options?: Parameters<typeof create>[4]) =>
        create(knex, tableName, attributesCleaner, newObject, options),
    createMultiple: async (newObjects: PathAttributes[], options?: Parameters<typeof createMultiple>[4]) =>
        createMultiple(knex, tableName, attributesCleaner, newObjects, options),
    update: async (id: string, updatedObject: Partial<PathAttributes>, options?: Parameters<typeof update>[5]) =>
        update(knex, tableName, attributesCleaner, id, updatedObject, options),
    updateMultiple: async (updatedObjects: Partial<PathAttributes>[], options?: Parameters<typeof updateMultiple>[4]) =>
        updateMultiple(knex, tableName, attributesCleaner, updatedObjects, options),
    delete: async (id: string, options?: Parameters<typeof deleteRecord>[3]) =>
        deleteRecord(knex, tableName, id, options),
    deleteMultiple: async (ids: string[], options?: Parameters<typeof deleteMultiple>[3]) =>
        deleteMultiple(knex, tableName, ids, options),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    geojsonCollection,
    geojsonCollectionForServices
};
