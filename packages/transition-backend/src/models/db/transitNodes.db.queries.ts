/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
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
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

const tableName = 'tr_transit_nodes';
const pathTableName = 'tr_transit_paths';
const st = knexPostgis(knex);

const attributesCleaner = function (attributes: Partial<NodeAttributes>): { [key: string]: any } {
    //console.log('attributes', attributes);
    const _attributes: any = _cloneDeep(attributes);
    if (_attributes.geography) {
        _attributes.geography = st.geomFromGeoJSON(JSON.stringify(_attributes.geography));
    }
    //console.log(_attributes.geography);
    if (_attributes.data && _attributes.data.transferableNodes) {
        delete _attributes.data.transferableNodes;
    }
    delete _attributes._routingRadiusPixelsAtMaxZoom;
    delete _attributes._250mRadiusPixelsAtMaxZoom;
    delete _attributes._500mRadiusPixelsAtMaxZoom;
    delete _attributes._750mRadiusPixelsAtMaxZoom;
    delete _attributes._1000mRadiusPixelsAtMaxZoom;
    return _attributes;
};

const collection = async () => {
    try {
        const response = await knex.raw(`
      SELECT
        *,
        COALESCE(color, '${Preferences.current.transit.nodes.defaultColor}') as color,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName}
      WHERE is_enabled IS TRUE
      ORDER BY integer_id;
    `);
        const collection = response.rows;
        if (collection) {
            return collection;
        }
        throw new TrError(
            'cannot fetch transit nodes collection because database did not return a valid geojson',
            'TNQC0001',
            'TransitNodesCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit nodes collection because of a database error (knex error: ${error})`,
            'TNQC0002',
            'TransitNodesCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const geojsonCollection = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point, NodeAttributes>> => {
    // TODO: we should not fetch the whole data content, we should read node when modifying one instead of creating a Node from the geojson
    try {
        const response = await knex.raw(`
      SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) as geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'id',         inputs.integer_id,
          'geometry',   ST_AsGeoJSON(inputs.geography)::jsonb,
          'properties', inputs.properties
        ) AS feature
        FROM (
          SELECT 
            id,
            geography,
            integer_id,
            json_build_object(
              'id', id,
              'station_id', station_id,
              'internal_id', internal_id,
              'is_frozen', is_frozen,
              'code', code,
              'name', name,
              'description', description,
              'geography', ST_AsGeoJSON(geography)::jsonb, /* we should remove this, verify in code if we use geography in geojson collection */
              'data', data,
              'is_enabled', is_enabled,
              /*'created_at', created_at,
              'updated_at', updated_at,*/
              'integer_id', integer_id,
              'routing_radius_meters', routing_radius_meters,
              'default_dwell_time_seconds', default_dwell_time_seconds,
              'color', COALESCE(color, '${Preferences.current.transit.nodes.defaultColor}')
            ) AS properties
          FROM tr_transit_nodes 
          WHERE is_enabled IS TRUE
          ORDER BY integer_id
        ) inputs
      ) features;
    `);
        const geojson = response.rows[0]?.geojson;
        if (geojson) {
            return geojson;
        }
        throw new TrError(
            'cannot fetch transit nodes geojson collection because database did not return a valid geojson',
            'TNQGC0001',
            'TransitNodesGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit nodes geojson collection because of a database error (knex error: ${error})`,
            'TNQGC0002',
            'TransitNodesGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRDN0001',
                'DatabaseCannotReadTransitNodeBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(`
      SELECT
        *,
        COALESCE(color, '${Preferences.current.transit.nodes.defaultColor}') as color,
        CASE geography WHEN NULL THEN NULL ELSE ST_AsGeoJSON(geography)::jsonb END as geography
      FROM ${tableName}
      WHERE id = '${id}' AND is_enabled IS TRUE
      ORDER BY integer_id;
    `);
        const rows = response.rows;
        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDN0002',
                'DatabaseCannotReadTransitNodeBecauseObjectDoesNotExist'
            );
        }
        return rows[0];
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRDN0003',
            'DatabaseCannotReadTransitNodeBecauseDatabaseError'
        );
    }
};

// get path ids associated with provided node ids:
const getAssociatedPathIds = async (nodeIds: string[]): Promise<{ [key: string]: string[] }> => {
    // key: node id, value: array of path ids
    const pathsTableName = 'tr_transit_paths';
    try {
        for (let i = 0, count = nodeIds.length; i < count; i++) {
            if (!uuidValidate(nodeIds[i])) {
                throw new TrError(
                    'At least one node id is not a valid uuid',
                    'DBQNGAP0001',
                    'DatabaseCannotGetNodesAssociatedPathsBecauseInvalidUuidNodeId'
                );
            }
        }
        if (nodeIds.length === 0) {
            throw new TrError(
                'Node ids array is empty (You must provide at least one node id)',
                'DBQNGAP0002',
                'DatabaseCannotGetNodesAssociatedPathsBecauseNodeIdsEmpty'
            );
        }
        const response = await knex.raw(`
            SELECT
              n.id AS node_id,
              ARRAY_REMOVE(COALESCE(ARRAY_AGG(p.id), '{}'), NULL) AS path_ids
            FROM ${tableName} n LEFT JOIN ${pathsTableName} p ON n.id = ANY(p.nodes)
            WHERE n.id IN (${nodeIds.map((nodeId) => `'${nodeId}'`).join(',')})
            GROUP BY n.id
            ORDER BY n.integer_id;
        `);
        const rows: { node_id: string; path_ids: string[] }[] = response.rows;
        if (rows.length !== nodeIds.length) {
            throw new TrError(
                'The number of nodes received do not match the number of nodes sent in the query',
                'DBQNGAP0003',
                'DatabaseCannotGetNodesAssociatedPathsBecauseNodesCountMismatchQueryResponse'
            );
        }
        return rows.reduce((o, n) => ({ ...o, [n.node_id]: n.path_ids }), {}) as { [key: string]: string[] }; // convert to object with node id as key
    } catch (error) {
        throw new TrError(
            `Cannot get nodes associated path ids from tables ${tableName} and ${pathsTableName} (error: ${error})`,
            'DBQNGAP0004',
            'DatabaseCannotGetNodesAssociatedPathsBecauseDatabaseError'
        );
    }
};

const deleteIfUnused = async (id: string): Promise<string | undefined> => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot verify if object exists in table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQDL0001',
                'ObjectCannotDeleteBecauseIdIsMissingOrInvalid'
            );
        }
        const notInQuery = knex.distinct(knex.raw('unnest(nodes)')).from(pathTableName);
        const response = await knex(tableName).where('id', id).whereNotIn('id', notInQuery).del().returning('id');
        return response.length === 1 ? response[0]['id'] : undefined;
    } catch (error) {
        throw new TrError(
            `Cannot delete object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQDL0002',
            'ObjectCannotDeleteBecauseDatabaseError'
        );
    }
};

const deleteMultipleUnused = function (ids: string[] | 'all'): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const notInQuery = knex.distinct(knex.raw('unnest(nodes)')).from(pathTableName);
        const deleteQuery = knex(tableName).whereNotIn('id', notInQuery);
        if (ids !== 'all') {
            deleteQuery.whereIn('id', ids);
        }
        return deleteQuery
            .del()
            .returning('id')
            .then((ret) => {
                //const numberOfDeletedObjects = parseInt(response);
                resolve(ret.map((delId) => delId.id));
            })
            .catch((error) => {
                reject(
                    new TrError(
                        `Cannot delete objects with ids ${ids} from table ${tableName} (knex error: ${error})`,
                        'DBQDLM0001',
                        'ObjectsCannotDeleteBecauseDatabaseError'
                    )
                );
            });
    });
};

/**
 * Get all nodes within a given distance of a reference node
 *
 * @param nodeId The ID of the reference node
 * @param distanceMeters The maximum distance of the nodes, in meters
 * @returns An array of the id and distances for each node within distance.
 */
const getNodesInBirdDistance = async (
    nodeId: string,
    distanceMeters: number
): Promise<{ id: string; distance: number }[]> => {
    try {
        if (!uuidValidate(nodeId)) {
            throw `Getting nodes in bird distance, invalid node ID ${nodeId}`;
        }
        const innerSelect = knex(tableName).where('id', nodeId).select('geography').as('n2');
        const nodesInBirdDistance = knex(`${tableName} as n1`)
            .join(innerSelect, st.dwithin('n1.geography', 'n2.geography', distanceMeters))
            .select('id', st.distance('n1.geography', 'n2.geography').as('distance'))
            .whereNot('n1.id', nodeId)
            .orderBy('distance');
        return await nodesInBirdDistance;
    } catch (error) {
        throw new TrError(
            `Cannot get nodes in bird distance of ${distanceMeters} meters from node ${nodeId} (knex error: ${error})`,
            'DBTNBD0002',
            'CannotGetNodesInBirdDistanceBecauseDatabaseError'
        );
    }
};

// TODO: export each separately so we can import a single function at a time
export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: NodeAttributes, returning?: string | string[]) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: NodeAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<NodeAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<NodeAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteIfUnused,
    deleteMultipleUnused,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    geojsonCollection,
    getAssociatedPathIds,
    getNodesInBirdDistance
};
