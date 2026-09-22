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
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

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

/**
 * Duplicate paths, possibly for a specific line mapping for lines.
 * Either an array of path, or a lineMapping must be specified.
 *
 * @param param The parameter object
 * @param param.pathIds The path IDs to duplicate
 * @param param.lineIdMapping The mapping of original line IDs to new line IDs
 * @param param.transaction The transaction to use for the duplication, if any
 * @returns A mapping of the ID of the paths copied to the ID of the copy.
 */
const duplicate = async ({
    pathIds: requestedPathIds = [],
    lineIdMapping = {},
    newPathSuffix = '',
    transaction
}: {
    pathIds?: string[];
    lineIdMapping?: { [key: string]: string };
    newPathSuffix?: string;
    transaction?: Knex.Transaction;
}): Promise<{ [originalPathId: string]: string }> => {
    try {
        // Deduplicate path ids, in case a path is requested twice
        const pathIds = [...new Set(requestedPathIds)];
        if (Object.keys(lineIdMapping).length === 0 && pathIds.length === 0) {
            throw new Error(
                'There needs to be either a line mapping or an array of path ids to duplicate, none provided.'
            );
        }
        // Validate that mappings and arrays are all uuids
        Object.entries(lineIdMapping).forEach(([originalId, mappedId]) => {
            if (!uuidValidate(originalId) || !uuidValidate(mappedId)) {
                throw new Error('Line mappings must be valid uuids');
            }
        });
        pathIds.forEach((pathId) => {
            if (!uuidValidate(pathId)) {
                throw new Error('Path ids must be valid uuids');
            }
        });

        // Group query parts according to mappings values, if there are any or
        // not. `mappingWith` is the `with` sql query part that creates the
        // mapping table, `mappedField` is the field to use in the select/insert
        // query, `mappedJoin` is the join to use in the select query,
        // `whereClause` is the where clause to use in the query to select the
        // schedules to duplicate, and `bindings` are the values to bind in the
        // where clause
        const getMappingQueries = (
            objectIdMapping: { [key: string]: string },
            mappedKey: string,
            tblName: string,
            canBeNull = false
        ) => {
            return Object.keys(objectIdMapping).length === 0
                ? {
                    mappingWith: '',
                    mappedField: `${mappedKey}_id`,
                    mappedJoin: '',
                    whereClause: undefined,
                    bindings: []
                }
                : {
                    mappingWith: `${mappedKey}_mapping (original_id, new_id) as (\
                values \
                    ${Object.entries(objectIdMapping)
        .map(([originalId, mappedId]) => `('${originalId}'::uuid, '${mappedId}'::uuid)`)
        .join(',')} \
                )`,
                    mappedField: `${mappedKey}_mapping.new_id`,
                    mappedJoin: `${canBeNull ? 'left ' : ''}join ${mappedKey}_mapping on ${mappedKey}_mapping.original_id = ${tblName}.${mappedKey}_id`,
                    whereClause: `${mappedKey}_id in (${Object.keys(objectIdMapping)
                        .map((_) => '?')
                        .join(',')})`,
                    bindings: Object.keys(objectIdMapping)
                };
        };
        const lineMappingQuery = getMappingQueries(lineIdMapping, 'line', tableName);
        // Not a mapping, but for sake of simplicity when creating the query,
        // we'll also use a `with` clause, so those queries can all be merged
        // together
        const pathSelectionQuery =
            pathIds.length === 0
                ? {
                    mappingWith: '',
                    mappedJoin: '',
                    whereClause: undefined,
                    bindings: []
                }
                : {
                    mappingWith: `path_selection(id) as (
                    values ${pathIds.map((pathId) => `('${pathId}'::uuid)`).join(', ')}
                )`,
                    mappedJoin: `join path_selection on path_selection.id = ${tableName}.id`,
                    whereClause: `id in (${pathIds.map((_) => '?').join(',')})`,
                    bindings: pathIds
                };

        // Nested function to require a transaction around the duplication
        const duplicateWithTransaction = async (trx: Knex.Transaction) => {
            // These queries are inspired by both
            // https://stackoverflow.com/questions/29256888/insert-into-from-select-returning-id-mappings
            // and
            // https://dba.stackexchange.com/questions/46410/how-do-i-insert-a-row-which-contains-a-foreign-key
            // so that a single query can copy for many lines and path ids

            // Query to copy the requested paths for the requested lines if any.
            // Using raw as it is complex to put in knex
            const pathName = _isBlank(newPathSuffix) ? 'name' : 'name || ?';
            const duplicatePathsQuery = `with ${[lineMappingQuery.mappingWith, pathSelectionQuery.mappingWith].filter((query) => query !== '').join(', ')} \
                insert into ${tableName}(internal_id, direction, line_id, name, is_enabled, geography, nodes, stops, segments, description, data, is_frozen) \
                    select internal_id, direction, ${lineMappingQuery.mappedField}, ${pathName}, is_enabled, geography, nodes, stops, segments, description, data, is_frozen
                    from ${tableName} \
                    ${lineMappingQuery.mappedJoin} \
                    ${pathSelectionQuery.mappedJoin} \
                    order by integer_id returning id, integer_id`;

            // Put the where queries and bindings for lines and services in arrays to better join them if necessary in the query
            const pathWhereQueries: { whereClauses: string[]; bindings: any[] } = {
                whereClauses: [],
                bindings: []
            };
            if (lineMappingQuery.whereClause) {
                pathWhereQueries.whereClauses.push(lineMappingQuery.whereClause);
                pathWhereQueries.bindings.push(...lineMappingQuery.bindings);
            }
            if (pathSelectionQuery.whereClause) {
                pathWhereQueries.whereClauses.push(pathSelectionQuery.whereClause);
                pathWhereQueries.bindings.push(...pathSelectionQuery.bindings);
            }

            // The `sel` part selects the original schedule IDs and row numbers
            // for services and lines, if specified and order them by row ID,
            // the `ins` part duplicates the schedules, also ordered by ID and
            // returns the new IDs. Both `sel` and `ins` have the same number of
            // rows and the same order of elements. The last select matches the
            // original and new IDs from the row number, effectively giving the
            // mapping between old and new schedules.
            const pathIdMapping = await knex
                .raw(
                    `with sel as (select id, integer_id, row_number() over (order by integer_id) as rn from ${tableName} where ${pathWhereQueries.whereClauses.join(' and ')} order by integer_id), \
                ins as (${duplicatePathsQuery}) \
                select i.id, i.integer_id, s.id as from_id, s.integer_id as from_integer_id from (select id, integer_id, row_number() over (order by integer_id) as rn from ins) i\
                join sel s using(rn)`,
                    [...pathWhereQueries.bindings, ...(_isBlank(newPathSuffix) ? [] : [newPathSuffix])]
                )
                .transacting(trx);

            if (pathIdMapping.rows.length === 0) {
                return {};
            }

            return pathIdMapping.rows.reduce((acc, row) => {
                acc[row.from_id] = row.id;
                return acc;
            }, {});
        };
        // Make sure the update is done in a transaction, use the one in the options if available
        return transaction
            ? await duplicateWithTransaction(transaction)
            : await knex.transaction(duplicateWithTransaction);
    } catch (error) {
        throw new TrError(
            `Cannot duplicate paths for lines ${JSON.stringify(lineIdMapping)} and path ids ${requestedPathIds} in database (knex error: ${error})`,
            'DBPATH0003',
            'TransitPathCannotUpdateBecauseDatabaseError'
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
    geojsonCollectionForServices,
    duplicate
};
