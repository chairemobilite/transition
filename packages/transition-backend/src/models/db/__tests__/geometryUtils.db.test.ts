/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { clipPolygon } from '../geometryUtils.db.queries';

/**
 * Integration tests for geometry utility functions using live PostgreSQL/PostGIS database
 */

beforeAll(async () => {
    jest.setTimeout(30000);
});

afterAll(async () => {
    await knex.destroy();
});

describe('clipPolygon', () => {

    test('should return empty array for empty circles input', async () => {
        const circles: Array<{ center: [number, number]; radiusKm: number }> = [];
        const result = await clipPolygon(circles);

        expect(result).toEqual([]);
    });

    test('should generate valid polygon coordinates for single circle', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 }
        ];

        const result = await clipPolygon(circles);

        // Should return MultiPolygon coordinates array
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1); // One polygon in MultiPolygon

        // Check structure: MultiPolygon -> Polygon -> Ring -> Points
        const polygon = result[0];
        expect(Array.isArray(polygon)).toBe(true);
        expect(polygon.length).toBeGreaterThan(0);

        const ring = polygon[0]; // Exterior ring
        expect(Array.isArray(ring)).toBe(true);

        // With quad_segs=6, should have 25 points (24 segments + 1 closure)
        expect(ring.length).toBe(25);

        // First and last coordinates should be identical (closed ring)
        expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0], 10);
        expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1], 10);

        // Verify coordinates are numbers in valid range
        ring.forEach((coord: number[]) => {
            expect(coord.length).toBe(2);
            expect(typeof coord[0]).toBe('number'); // longitude
            expect(typeof coord[1]).toBe('number'); // latitude
            expect(coord[0]).toBeGreaterThan(-180);
            expect(coord[0]).toBeLessThan(180);
            expect(coord[1]).toBeGreaterThan(-90);
            expect(coord[1]).toBeLessThan(90);
        });

        // Verify exact values of the coordinates
        ring.forEach((coord: number[]) => {
            expect(coord[0]).toBeGreaterThan(-73.5064);
            expect(coord[0]).toBeLessThan(-73.4936);
            expect(coord[1]).toBeGreaterThan(45.4955);
            expect(coord[1]).toBeLessThan(45.5045);
        });
    });

    test('should merge overlapping circles into single polygon', async () => {
        // Two circles with significant overlap
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 },
            { center: [-73.505, 45.505] as [number, number], radiusKm: 0.5 }
        ];

        const result = await clipPolygon(circles);

        // Should merge into 1 polygon
        expect(result.length).toBe(1);
        expect(Array.isArray(result[0])).toBe(true);
        expect(result[0].length).toBeGreaterThan(0);

        // Merged polygon should have more points than a simple circle
        const ring = result[0][0];
        expect(ring.length).toBeGreaterThan(25); // More than single circle's 25 points
    });

    test('should keep non-overlapping circles as separate polygons', async () => {
        // Three circles far apart
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.2 },
            { center: [-73.6, 45.6] as [number, number], radiusKm: 0.2 },
            { center: [-73.7, 45.7] as [number, number], radiusKm: 0.2 }
        ];

        const result = await clipPolygon(circles);

        // Should have 3 separate polygons
        expect(result.length).toBe(3);

        // Each polygon should be valid
        result.forEach((polygon: number[][][]) => {
            expect(Array.isArray(polygon)).toBe(true);
            expect(polygon.length).toBeGreaterThan(0);

            const ring = polygon[0];
            expect(ring.length).toBe(25); // Each circle should have 25 points
        });
    });

    test('should handle multiple circles with partial overlaps', async () => {
        // At latitude 45, 1 degree longitude ≈ 78.8 km
        // So 0.01 degrees ≈ 788m, 0.005 degrees ≈ 394m, 0.003 degrees ≈ 236m
        // For 300m radius circles to overlap, they need to be < 600m apart
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.3 },
            { center: [-73.503, 45.5] as [number, number], radiusKm: 0.3 },  // ~236m apart, will overlap
            { center: [-73.506, 45.5] as [number, number], radiusKm: 0.3 }   // ~236m from second, will overlap
        ];

        const result = await clipPolygon(circles);

        // Three overlapping circles should merge into 1 polygon
        expect(result.length).toBe(1);
        expect(Array.isArray(result[0])).toBe(true);

        // Verify the merged polygon is valid
        const ring = result[0][0];
        expect(Array.isArray(ring)).toBe(true);
        expect(ring.length).toBeGreaterThan(0);
    });

    test('should handle circles with different radii', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 1.0 },
            { center: [-73.502, 45.501] as [number, number], radiusKm: 0.2 }, // ~220m from center, inside 1km circle
            { center: [-73.53, 45.53] as [number, number], radiusKm: 0.5 }  // ~3km away, separate
        ];

        const result = await clipPolygon(circles);

        // Small circle inside large merges, medium circle separate = 2 polygons
        expect(result.length).toBe(2);

        // Verify both polygons are valid
        result.forEach((polygon: number[][][]) => {
            expect(Array.isArray(polygon)).toBe(true);
            expect(polygon.length).toBeGreaterThan(0);
            expect(polygon[0].length).toBeGreaterThan(0);
        });
    });

    test('should handle many circles efficiently', async () => {
        // Generate 50 circles in a pattern
        const circles: Array<{ center: [number, number]; radiusKm: number }> = [];
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 10; j++) {
                circles.push({
                    center: [-73.5 + i * 0.01, 45.5 + j * 0.01] as [number, number],
                    radiusKm: 0.3
                });
            }
        }

        const startTime = Date.now();
        const result = await clipPolygon(circles);
        const duration = Date.now() - startTime;

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);

        console.log(`Processed ${circles.length} circles in ${duration}ms`);
        console.log(`Result: ${result.length} polygon(s)`);
    });

    test('should handle circles near coordinate boundaries', async () => {
        const circles = [
            { center: [-179.5, 85] as [number, number], radiusKm: 0.5 },  // Near north pole
            { center: [179.5, -85] as [number, number], radiusKm: 0.5 },  // Near south pole
            { center: [0, 0] as [number, number], radiusKm: 0.5 }          // Equator/prime meridian
        ];

        const result = await clipPolygon(circles);

        // Should have 3 separate polygons
        expect(result.length).toBe(3);

        // Verify all are valid
        result.forEach((polygon: number[][][]) => {
            expect(Array.isArray(polygon)).toBe(true);
            const ring = polygon[0];
            expect(ring.length).toBe(25);
        });
    });

    test('should handle very small circles', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.01 } // 10m radius
        ];

        const result = await clipPolygon(circles);

        expect(result.length).toBe(1);
        expect(result[0][0].length).toBe(25);
    });

    test('should handle very large circles', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 10 } // 10km radius
        ];

        const result = await clipPolygon(circles);

        expect(result.length).toBe(1);
        expect(result[0][0].length).toBe(25);

        // Verify the circle is actually large
        const ring = result[0][0];
        const firstPoint = ring[0];

        // Should be significantly offset from center
        expect(Math.abs(firstPoint[0] - (-73.5))).toBeGreaterThan(0.05);
    });

    test('should produce consistent results for same input', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 },
            { center: [-73.6, 45.6] as [number, number], radiusKm: 0.3 }
        ];

        const result1 = await clipPolygon(circles);
        const result2 = await clipPolygon(circles);

        expect(result1.length).toBe(result2.length);

        // Coordinates should be identical (or very close due to floating point)
        result1.forEach((polygon1: number[][][], idx: number) => {
            const polygon2 = result2[idx];
            expect(polygon1.length).toBe(polygon2.length);

            polygon1[0].forEach((coord1: number[], coordIdx: number) => {
                const coord2 = polygon2[0][coordIdx];
                expect(coord1[0]).toBeCloseTo(coord2[0], 10);
                expect(coord1[1]).toBeCloseTo(coord2[1], 10);
            });
        });
    });

    test('should verify geometry can be used in PostGIS queries', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 }
        ];

        const result = await clipPolygon(circles);

        // Create a MultiPolygon GeoJSON and verify it's valid in PostGIS
        const multiPolygon = {
            type: 'MultiPolygon',
            coordinates: result
        };

        const validation = await knex.raw(`
            SELECT
                ST_IsValid(ST_GeomFromGeoJSON(?)) as is_valid,
                ST_GeometryType(ST_GeomFromGeoJSON(?)) as geom_type,
                ST_Area(ST_GeomFromGeoJSON(?)::geography) as area_sqm
        `, [JSON.stringify(multiPolygon), JSON.stringify(multiPolygon), JSON.stringify(multiPolygon)]);

        expect(validation.rows[0].is_valid).toBe(true);
        expect(validation.rows[0].geom_type).toBe('ST_MultiPolygon');

        const areaSqM = parseFloat(validation.rows[0].area_sqm);
        // Area should be approximately π * 500²
        const expectedArea = Math.PI * 500 * 500;
        expect(areaSqM).toBeGreaterThan(expectedArea * 0.95);
        expect(areaSqM).toBeLessThan(expectedArea * 1.05);
    });

    test('should handle concurrent calls without conflicts', async () => {
        const circles1 = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 }
        ];
        const circles2 = [
            { center: [-73.6, 45.6] as [number, number], radiusKm: 0.3 }
        ];
        const circles3 = [
            { center: [-73.7, 45.7] as [number, number], radiusKm: 0.4 }
        ];

        // Call multiple times in parallel
        const results = await Promise.all([
            clipPolygon(circles1),
            clipPolygon(circles2),
            clipPolygon(circles3)
        ]);

        // All should succeed
        expect(results.length).toBe(3);
        results.forEach((result) => {
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
        });
    });

    test('should handle transaction properly and clean up temp tables', async () => {
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 }
        ];

        // Execute multiple times
        await clipPolygon(circles);
        await clipPolygon(circles);
        await clipPolygon(circles);

        // Check that no temp tables are left behind
        // Note: temp tables auto-drop on commit, so there should be none or very few
        const tempTables = await knex.raw(`
            SELECT COUNT(*) as count
            FROM pg_tables
            WHERE schemaname LIKE 'pg_temp%'
            AND tablename LIKE 'temp_circles_%'
        `);

        // Should be 0
        expect(parseInt(tempTables.rows[0].count)).toBe(0);
    });

    test.todo('should throw error when db connection fails');

    test('should handle circle at origin coordinates', async () => {
        const circles = [
            { center: [0, 0] as [number, number], radiusKm: 0.5 }
        ];

        const result = await clipPolygon(circles);

        expect(result.length).toBe(1);
        expect(result[0][0].length).toBe(25);

        // Verify center is roughly at origin
        const ring = result[0][0];
        const avgLon = ring.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / ring.length;
        const avgLat = ring.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / ring.length;

        expect(avgLon).toBeCloseTo(0, 2);
        expect(avgLat).toBeCloseTo(0, 2);
    });

    test('should throw error for invalid coordinates', async () => {
        // Test error handling by passing invalid data that would cause DB error
        // For example, NaN or invalid coordinates
        const invalidCircles = [
            { center: [NaN, 45.5] as [number, number], radiusKm: 0.5 }
        ];

        await expect(clipPolygon(invalidCircles)).rejects.toThrow();
    });

    test('should handle circles that touch but do not overlap', async () => {
        // Two circles with 0.5km radius each
        // At latitude 45.5°, 1 degree longitude ≈ 78.8 km
        // For circles to touch: distance = 2 * radius = 1.0 km
        // In degrees: 1.0 / 78.8 ≈ 0.0127 degrees
        const circles = [
            { center: [-73.5, 45.5] as [number, number], radiusKm: 0.5 },
            { center: [-73.5 + 0.0127, 45.5] as [number, number], radiusKm: 0.5 }
        ];

        const result = await clipPolygon(circles);

        // Touching circles might merge into 1 polygon or stay as 2, depending on precision
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result.length).toBeLessThanOrEqual(2);
    });

    test('should maintain precision for coordinates', async () => {
        const circles = [
            { center: [-73.123456789, 45.987654321] as [number, number], radiusKm: 0.5 }
        ];

        const result = await clipPolygon(circles);

        // Check that coordinates have reasonable precision (not excessive decimals)
        const ring = result[0][0];
        ring.forEach((coord: number[]) => {
            // Coordinates should have precision but not be excessive
            const lonStr = coord[0].toString();
            const latStr = coord[1].toString();

            // Should have decimal places
            expect(lonStr).toContain('.');
            expect(latStr).toContain('.');

            // But not more than ~15 decimal places (reasonable for float64)
            expect(lonStr.length).toBeLessThan(25);
            expect(latStr.length).toBeLessThan(25);
        });
    });
});
