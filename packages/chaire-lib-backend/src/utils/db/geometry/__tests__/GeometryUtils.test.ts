/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knexPostgis from 'knex-postgis';
import type { Knex } from 'knex';
import { geometryToPostgis } from '../GeometryUtils';

jest.mock('knex-postgis', () => {
    return jest.fn(() => ({
        geomFromGeoJSON: jest.fn((json: GeoJSON.Geometry) => ({
            type: 'raw',
            value: `ST_GeomFromGeoJSON('${JSON.stringify(json)}')`
        }))
    }));
});

describe('GeometryUtils', () => {
    let mockSt: ReturnType<typeof knexPostgis>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSt = knexPostgis({} as Knex<any, any[]>);
    });

    describe('geometryToPostgis', () => {
        describe('nullish input', () => {
            test.each([undefined, null])(
                'should return undefined and not call geomFromGeoJSON when geometry is %p',
                (value) => {
                    const result = geometryToPostgis(value, mockSt);
                    expect(result).toBeUndefined();
                    expect(mockSt.geomFromGeoJSON).not.toHaveBeenCalled();
                }
            );
        });

        describe('Valid geometry', () => {
            test('should convert a valid Point geometry', () => {
                const point: GeoJSON.Point = {
                    type: 'Point',
                    coordinates: [-73.567, 45.501]
                };

                const result = geometryToPostgis(point, mockSt);

                expect(result).toBeDefined();
                expect(mockSt.geomFromGeoJSON).toHaveBeenCalledTimes(1);
                expect(mockSt.geomFromGeoJSON).toHaveBeenCalledWith(point);
            });
        });

        // No need to test all geometry types here as this is internal to KnexPostgis.

    });
});
