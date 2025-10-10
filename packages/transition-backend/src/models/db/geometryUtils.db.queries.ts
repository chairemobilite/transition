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
