/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/* This file contains geometry operations that uses postgis queries instead
   of code libraries */

import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { randomUUID } from 'crypto';
import GeoJSON from 'geojson';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { Knex } from 'knex';

export async function clipPolygon(circles: Array<{ center: [number, number]; radiusKm: number }>): Promise<any> {
    if (circles.length === 0) {
        return [];
    }

    try {
        return await knex.transaction(async (trx) => {
            // Set higher work memory, with the default 4M, the request were swapping
            // to disk. Given them 5 times that seems to work well and still
            // safe when doing many requests in parallel.
            await trx.raw(`
                   SET LOCAL work_mem = '20MB';
                   SET LOCAL maintenance_work_mem = '20MB';
                `);

            // Generate unique table name to prevent conflicts in parallel execution
            // UUID ensures no name clashes even with same-session parallel calls
            const uniqueId = randomUUID().replace(/-/g, '_').substring(0, 16);
            const tableName = `temp_circles_${uniqueId}`;
            const indexName = `idx_circles_${uniqueId}`;

            // Prepare values for bulk insert
            const valuePlaceholders: string[] = [];
            const bindings: number[] = [];

            circles.forEach((circle) => {
                valuePlaceholders.push('(ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)');
                bindings.push(circle.center[0], circle.center[1], circle.radiusKm * 1000);
            });

            // Create temp table and generate circles in one go
            /**
             * Ajusting the quad_segs will have an impact on speed and precision.
             * quad_segs is the number of segment to approximate a quarter of a circle.
             * See https://postgis.net/docs/ST_Buffer.html for more details.
             *
             * PostGIS ST_Buffer Precision for 500m Radius Circles (1km diameter)
             * Formula: max_error = radius × (1 - cos(π/n)) where n = quad_segs × 4
             *
             * quad_segs | segments | points | max_error | area_accuracy
             * ----------|----------|--------|-----------|---------------
             *     1     |    4     |   5    |  146.4m   |    63.7%
             *     2     |    8     |   9    |   38.1m   |    90.0%
             *     3     |   12     |  13    |   17.0m   |    95.5%
             *     4     |   16     |  17    |    9.6m   |    97.5%
             *     5     |   20     |  21    |    6.1m   |    98.4%
             *     6     |   24     |  25    |    4.3m   |    98.9%
             *     8     |   32     |  33    |    2.4m   |    99.5%
             *    12     |   48     |  49    |    1.1m   |    99.8%
             *    16     |   64     |  65    |    0.6m   |    99.9%
             *    20     |   80     |  81    |    0.4m   |    99.9%
             *    32     |  128     |  129   |    0.15m  |    99.99%
             *
             * Performance: Higher quad_segs = more vertices = slower processing
             * quad_segs=12 is ~4x slower than quad_segs=3
             *
             * For variable radius: error scales proportionally with radius
             * Example: 1000m radius with quad_segs=12 → 2.2m error (1.1m × 1000/500)
             *
             * Formula: error ≈ radius × (1 - cos(π/(quad_segs×4)))
             */
            // Based on the table above, we chose a quad_seg of 6, which give a max_error of
            // about 4 meters
            await trx.raw(
                `
                CREATE TEMPORARY TABLE ?? ON COMMIT DROP AS
                    SELECT
                        ROW_NUMBER() OVER () as id,
                        center_point,
                        radius_meters,
                        ST_Buffer(
                            center_point::geography,
                            radius_meters::double precision,
                            'quad_segs=6'
                        )::geometry as circle_geom
                    FROM (VALUES ${valuePlaceholders.join(',\n')}) AS t(center_point, radius_meters)
                `,
                [tableName, ...bindings]
            );

            // Create spatial index
            await trx.raw('CREATE INDEX ?? ON ?? USING GIST (circle_geom)', [indexName, tableName]);

            // Update statistics for optimal query planning
            await trx.raw('ANALYZE ??', [tableName]);

            const result = await trx.raw(
                `
                SELECT ST_AsGeoJSON(
                    ST_MULTI(
                        ST_Union(circle_geom ORDER BY id)
                    )
                ) AS geometry_json
                FROM ??
                `,
                [tableName]
            );

            if (result.rows && result.rows.length > 0 && result.rows[0].geometry_json) {
                const geometry = JSON.parse(result.rows[0].geometry_json);

                if (geometry.type === 'MultiPolygon') {
                    return geometry.coordinates;
                }

                console.error('[PostGIS] Unexpected geometry type:', geometry.type);
                return [];
            }

            console.error('[PostGIS] No geometry returned');
            return [];
        });
    } catch (error) {
        console.error('Error in PostGIS polygon generation:', error);
        throw error;
    }
}

/**
 * Create and populate temporary POIs table
 * Prepares POI data and creates a temporary table with spatial index
 * @param trx Knex transaction object
 * @param uniqueId Unique identifier for table naming
 * @param poisFeatureCollection GeoJSON FeatureCollection of POI Point features
 * @param errorCodePrefix Error code prefix for error handling
 * @param idColumnName Name of the ID column (defaults to 'poi_id')
 * @returns Temporary POIs table name
 */
async function createAndPopulatePOIsTable(
    trx: Knex.Transaction,
    uniqueId: string,
    poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>,
    errorCodePrefix: string,
    idColumnName: string = 'poi_id'
): Promise<string> {
    const tempPoisTableName = `temp_pois_${uniqueId}`;
    const poisIndexName = `idx_pois_${uniqueId}`;

    // Prepare POI data for bulk insert
    const poiValuePlaceholders: string[] = [];
    const poiBindings: (string | number)[] = [];

    poisFeatureCollection.features.forEach((poi) => {
        // POI id must be a number (required by database schema)
        const poiId = typeof poi.id === 'number' ? poi.id : poi.id !== undefined ? Number(poi.id) : null;
        if (poiId === null || isNaN(poiId)) {
            throw new TrError(
                `POI feature must have a numeric id, got: ${poi.id}`,
                `${errorCodePrefix}0002`,
                'CannotGetPOIsInBirdDistanceBecauseInvalidPOIId'
            );
        }
        const poiWeight = poi.properties?.weight ?? 0;
        poiValuePlaceholders.push('(?, ST_GeomFromGeoJSON(?)::geography, ?)');
        poiBindings.push(poiId, JSON.stringify(poi.geometry), poiWeight);
    });

    // Create temporary table with POIs
    await trx.raw(
        `
        CREATE TEMPORARY TABLE ?? (
            ?? INTEGER,
            geography GEOGRAPHY(POINT, 4326),
            weight NUMERIC
        ) ON COMMIT DROP
        `,
        [tempPoisTableName, idColumnName]
    );

    // Insert POIs into temporary table
    await trx.raw(
        `
        INSERT INTO ?? (??, geography, weight)
        VALUES ${poiValuePlaceholders.join(', ')}
        `,
        [tempPoisTableName, idColumnName, ...poiBindings]
    );

    // Create spatial index on POIs temporary table
    await trx.raw('CREATE INDEX ?? ON ?? USING GIST (geography)', [poisIndexName, tempPoisTableName]);

    // Update statistics for optimal query planning
    await trx.raw('ANALYZE ??', [tempPoisTableName]);

    return tempPoisTableName;
}

type QueryResultRow = {
    poi_id: number;
    weight: number | null;
    distance: number;
    geography: GeoJSON.Point;
    [key: string]: string | number | null | GeoJSON.Point | undefined;
};

/**
 * Group query results by entity ID (place_id or node_id)
 * @param rows Query result rows
 * @param idColumnName Name of the ID column in the query results
 * @returns Grouped results dictionary
 */
function groupResultsByEntityId(
    rows: QueryResultRow[],
    idColumnName: string
): { [entityId: string]: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }> } {
    const results: {
        [entityId: string]: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }>;
    } = {};

    rows.forEach((row) => {
        const entityId = String(row[idColumnName]);
        if (!results[entityId]) {
            results[entityId] = [];
        }
        results[entityId].push({
            id: Number(row.poi_id),
            weight: row.weight !== null ? Number(row.weight) : 0,
            distance: Number(row.distance),
            geography: row.geography as GeoJSON.Point
        });
    });

    return results;
}

/**
 * Get all POIs within a given bird distance from multiple places
 * Uses a single temporary PostGIS table for all places and POIs
 * Here a place could be any location, including a POI, a stop node, a home, etc.
 * However, a POI is a place where an activity can be done (trip destination).
 * POIs should also have an intrinsic weight, which could be equivalent to the
 * amount of trips generated to reach this POI.
 *
 * @param placesFeatureCollection GeoJSON FeatureCollection of Point features with place id as the feature id
 * @param distanceMeters The maximum bird distance in meters
 * @param poisFeatureCollection GeoJSON FeatureCollection of POI Point features with weight in properties and id as feature id
 * @returns A map/dictionary where keys are place IDs and values are arrays of POIs with id, weight, bird distance, and geography
 */
export async function getPOIsWithinBirdDistanceFromPlaces(
    placesFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point>,
    distanceMeters: number,
    poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>
): Promise<{ [placeId: string]: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }> }> {
    try {
        return await knex.transaction(async (trx) => {
            // Generate unique table names to prevent conflicts in parallel execution
            const uniqueId = randomUUID().replace(/-/g, '_').substring(0, 16);
            const tempPlacesTableName = `temp_places_${uniqueId}`;
            const placesIndexName = `idx_places_${uniqueId}`;

            if (placesFeatureCollection.features.length === 0 || poisFeatureCollection.features.length === 0) {
                return {};
            }

            // Prepare values for bulk insert into temporary places table
            const placeValuePlaceholders: string[] = [];
            const placeBindings: (string | number)[] = [];

            placesFeatureCollection.features.forEach((place) => {
                const placeId = typeof place.id === 'string' ? place.id : String(place.id);
                placeValuePlaceholders.push('(?, ST_GeomFromGeoJSON(?)::geography)');
                placeBindings.push(placeId, JSON.stringify(place.geometry));
            });

            // Create and populate POIs table using common helper
            const tempPoisTableName = await createAndPopulatePOIsTable(
                trx,
                uniqueId,
                poisFeatureCollection,
                'DBQPOIBDP'
            );

            // Create temporary table with places
            await trx.raw(
                `
                CREATE TEMPORARY TABLE ?? (
                    place_id TEXT,
                    geography GEOGRAPHY(POINT, 4326)
                ) ON COMMIT DROP
                `,
                [tempPlacesTableName]
            );

            // Insert places into temporary table
            await trx.raw(
                `
                INSERT INTO ?? (place_id, geography)
                VALUES ${placeValuePlaceholders.join(', ')}
                `,
                [tempPlacesTableName, ...placeBindings]
            );

            // Create spatial index on places table
            await trx.raw('CREATE INDEX ?? ON ?? USING GIST (geography)', [placesIndexName, tempPlacesTableName]);

            // Update statistics for optimal query planning
            await trx.raw('ANALYZE ??', [tempPlacesTableName]);

            // Query POIs within bird distance for all places in a single query
            const queryResult = await trx.raw(
                `
                SELECT
                    pl.place_id,
                    p.poi_id,
                    p.weight,
                    ST_Distance(pl.geography, p.geography) as distance,
                    ST_AsGeoJSON(p.geography)::jsonb as geography
                FROM ?? pl
                CROSS JOIN ?? p
                WHERE ST_DWithin(pl.geography, p.geography, ?)
                ORDER BY pl.place_id, distance
                `,
                [tempPlacesTableName, tempPoisTableName, distanceMeters]
            );

            // Group results by place_id using common helper
            return groupResultsByEntityId(queryResult.rows, 'place_id');
        });
    } catch (error) {
        if (error instanceof TrError) {
            throw error;
        }
        throw new TrError(
            `Cannot get POIs in bird distance of ${distanceMeters} meters from places (knex error: ${error})`,
            'DBQPOIBDP0001',
            'CannotGetPOIsInBirdDistanceFromPlacesBecauseDatabaseError'
        );
    }
}

/**
 * Get all POIs within a given bird distance from multiple transit nodes
 * Uses the existing tr_transit_nodes table and creates only a temporary POIs table
 *
 * @param distanceMeters The maximum bird distance in meters
 * @param poisFeatureCollection GeoJSON FeatureCollection of POI Point features with weight in properties and id as feature id
 * @param nodeIds Optional array of transit node UUIDs. If undefined, calculates for all enabled nodes. If an empty array, returns empty result immediately without database query.
 * @returns A map/dictionary where keys are node UUIDs and values are arrays of POIs with id, weight, bird distance, and geography
 */
export async function getPOIsWithinBirdDistanceFromNodes(
    distanceMeters: number,
    poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>,
    nodeIds?: string[]
): Promise<{ [nodeId: string]: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }> }> {
    // Explicit empty array means "no nodes" - return empty result immediately
    if (Array.isArray(nodeIds) && nodeIds.length === 0) {
        return {};
    }

    try {
        return await knex.transaction(async (trx) => {
            // Generate unique table name to prevent conflicts in parallel execution
            const uniqueId = randomUUID().replace(/-/g, '_').substring(0, 16);

            if (poisFeatureCollection.features.length === 0) {
                return {};
            }

            // Create and populate POIs table using common helper
            const tempPoisTableName = await createAndPopulatePOIsTable(
                trx,
                uniqueId,
                poisFeatureCollection,
                'DBQPOIBDN'
            );

            // Query POIs within bird distance for all nodes in a single query
            // Join with existing tr_transit_nodes table
            // If nodeIds is provided and non-empty, filter by those IDs; otherwise, query all enabled nodes
            const query = trx('tr_transit_nodes as n')
                .joinRaw('CROSS JOIN ?? as p', [tempPoisTableName])
                .select(
                    'n.id as node_id',
                    'p.poi_id',
                    'p.weight',
                    trx.raw('ST_Distance(n.geography, p.geography) as distance'),
                    trx.raw('ST_AsGeoJSON(p.geography)::jsonb as geography')
                )
                .where('n.is_enabled', true)
                .whereRaw('ST_DWithin(n.geography, p.geography, ?)', [distanceMeters])
                .orderBy('n.id')
                .orderBy('distance');

            // Add optional filter for specific node IDs
            if (nodeIds !== undefined && nodeIds.length > 0) {
                query.whereIn('n.id', nodeIds);
            }

            const queryResult = await query;

            // Group results by node_id using common helper
            return groupResultsByEntityId(queryResult, 'node_id');
        });
    } catch (error) {
        if (error instanceof TrError) {
            throw error;
        }
        throw new TrError(
            `Cannot get POIs in bird distance of ${distanceMeters} meters from transit nodes (knex error: ${error})`,
            'DBQPOIBDN0001',
            'CannotGetPOIsInBirdDistanceFromNodesBecauseDatabaseError'
        );
    }
}

/**
 * Get all POIs within a given bird distance from a point
 * Uses a temporary PostGIS table created from the provided POIs
 *
 * @param point The reference point (GeoJSON.Point)
 * @param distanceMeters The maximum bird distance in meters
 * @param pois Array of POIs (GeoJSON points with optional weights)
 * @returns An array of POI id, weight, bird distance, and geography
 */
export async function getPOIsWithinBirdDistanceFromPoint(
    point: GeoJSON.Point,
    distanceMeters: number,
    poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>
): Promise<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }[]> {
    try {
        return await knex.transaction(async (trx) => {
            // TODO: Set higher work memory for better performance if needed.
            // For now, let's keep the default at 4MB (see above)

            // Generate unique table name using timestamp to prevent conflicts in parallel execution
            const uniqueId = randomUUID().replace(/-/g, '_').substring(0, 16);

            if (poisFeatureCollection.features.length === 0) {
                return [];
            }

            // Create and populate POIs table using common helper (using 'id' column name)
            const tempTableName = await createAndPopulatePOIsTable(
                trx,
                uniqueId,
                poisFeatureCollection,
                'DBQPOIBD',
                'id'
            );

            // Query POIs within bird distance from the temporary table
            const pointGeometryStr = JSON.stringify(point);
            const queryResult = await trx.raw(
                `
                SELECT
                    id,
                    weight,
                    ST_Distance(geography, ST_GeomFromGeoJSON(?)::geography) as distance,
                    ST_AsGeoJSON(geography)::jsonb as geography
                FROM ??
                WHERE ST_DWithin(geography, ST_GeomFromGeoJSON(?)::geography, ?)
                ORDER BY distance
                `,
                [pointGeometryStr, tempTableName, pointGeometryStr, distanceMeters]
            );

            const results = queryResult.rows;
            return results.map((row) => ({
                id: Number(row.id),
                weight: row.weight !== null ? Number(row.weight) : 0,
                distance: Number(row.distance),
                geography: row.geography as GeoJSON.Point
            }));
        });
    } catch (error) {
        if (TrError.isTrError(error)) {
            throw error;
        }
        throw new TrError(
            `Cannot get POIs in bird distance of ${distanceMeters} meters from point ${JSON.stringify(point)} (knex error: ${error})`,
            'DBQPOIBD0001',
            'CannotGetPOIsInBirdDistanceFromPointBecauseDatabaseError'
        );
    }
}
