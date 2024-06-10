/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import each from 'jest-each';
import { ParamsValidatorUtils } from '../ParamsValidatorUtils';
import { v4 as uuidV4 } from 'uuid';

class TestClass { }

describe('ParamsValidatorUtils', () => {

    describe('isObject', () => {
        test('should return no errors for a valid object', () => {
            const errors = ParamsValidatorUtils.isObject('attr', {}, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isObject('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an null value', () => {
            const errors = ParamsValidatorUtils.isObject('attr', null, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an non-empty object', () => {
            const errors = ParamsValidatorUtils.isObject('attr', { foo: 'bar' }, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-object value', () => {
            const errors = ParamsValidatorUtils.isObject('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an object');
        });
    });

    describe('isRequired', () => {
        test('should return no errors for a defined value', () => {
            const errors = ParamsValidatorUtils.isRequired('attr', 'value', 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an undefined value', () => {
            const errors = ParamsValidatorUtils.isRequired('attr', undefined, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('is required');
        });
    });

    describe('isInstanceOf', () => {

        class ParentClass {}
        class ChildClass extends ParentClass {}

        test('should return no errors for an instance of TestClass', () => {
            const instance = new TestClass();
            const errors = ParamsValidatorUtils.isInstanceOf('attr', instance, 'TestClass', TestClass
            );
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isInstanceOf('attr', undefined, 'TestClass', TestClass);
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-instance of TestClass', () => {
            const errors = ParamsValidatorUtils.isInstanceOf('attr', {}, 'TestClass', TestClass);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an instance of TestClass');
        });

        test('should return no errors for an instance of a child class', () => {
            const instance = new ChildClass();
            const errors = ParamsValidatorUtils.isInstanceOf('attr', instance, 'ParentClass', ParentClass);
            expect(errors).toEqual([]);
        });
    });

    describe('isString', () => {
        test('should return no errors for a valid string', () => {
            const errors = ParamsValidatorUtils.isString('attr', 'string', 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isString('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-string value', () => {
            const errors = ParamsValidatorUtils.isString('attr', 123, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a string');
        });
    });

    describe('isNonEmptyString', () => {
        test('should return no errors for a non-empty string', () => {
            const errors = ParamsValidatorUtils.isNonEmptyString('attr', 'string', 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isNonEmptyString('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an empty string', () => {
            const errors = ParamsValidatorUtils.isNonEmptyString('attr', '', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a non-empty string');
        });
    });

    describe('isBoolean', () => {
        test('should return no errors for a valid boolean', () => {
            const errors = ParamsValidatorUtils.isBoolean('attr', true, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isBoolean('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-boolean value', () => {
            const errors = ParamsValidatorUtils.isBoolean('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a boolean');
        });
    });

    describe('isUuid', () => {
        test('should return no errors for a valid uuid', () => {
            const errors = ParamsValidatorUtils.isUuid('attr', '123e4567-e89b-12d3-a456-426614174000', 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isUuid('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid uuid', () => {
            const errors = ParamsValidatorUtils.isUuid('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid uuid');
        });
    });

    describe('isPositiveInteger', () => {
        test('should return no errors for a positive integer', () => {
            const errors = ParamsValidatorUtils.isPositiveInteger('attr', 123, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isPositiveInteger('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a negative integer', () => {
            const errors = ParamsValidatorUtils.isPositiveInteger('attr', -123, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a positive integer');
        });
    });

    describe('isInteger', () => {
        each([
            [123],
            [0],
            [-123],
            [undefined]
        ]).test('should return no errors for %s', (number) => {
            const errors = ParamsValidatorUtils.isInteger('attr', number, 'TestClass');
            expect(errors).toEqual([]);
        });

        each([
            ['a string'],
            ['123'],
            [[0, 1, 3]],
            [1.23],
            [Number.NaN]
        ]).test('should return an error for %s', (number) => {
            const errors = ParamsValidatorUtils.isInteger('attr', number, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an integer');
        });
    });

    describe('isPositiveNumber', () => {
        test('should return no errors for a positive number', () => {
            const errors = ParamsValidatorUtils.isPositiveNumber('attr', 123.45, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isPositiveNumber('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a negative number', () => {
            const errors = ParamsValidatorUtils.isPositiveNumber('attr', -123.45, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a positive number');
        });
    });

    describe('isNumber', () => {
        each([
            [123],
            [0],
            [-123],
            [1.23],
            [undefined]
        ]).test('should return no errors for %s', (number) => {
            const errors = ParamsValidatorUtils.isNumber('attr', number, 'TestClass');
            expect(errors).toEqual([]);
        });

        each([
            ['a string'],
            ['123'],
            [[0, 1, 3]],
            [Number.NaN]
        ]).test('should return an error for %s', (number) => {
            const errors = ParamsValidatorUtils.isNumber('attr', number, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a number');
        });
    });

    describe('isDateString', () => {
        test('should return no errors for a date string', () => {
            const errors = ParamsValidatorUtils.isDateString('attr', '2024-01-01', 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined date string', () => {
            const errors = ParamsValidatorUtils.isDateString('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid date string', () => {
            const errors = ParamsValidatorUtils.isDateString('attr', '12345', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid date string');
        });
    });

    describe('isIn', () => {
        test('should return no errors for a value in the array', () => {
            const errors = ParamsValidatorUtils.isIn('attr', 'value1', 'TestClass', ['value1', 'value2']);
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isIn('attr', undefined, 'TestClass', ['value1', 'value2']);
            expect(errors).toEqual([]);
        });

        test('should return an error for a value not in the array', () => {
            const errors = ParamsValidatorUtils.isIn('attr', 'value3', 'TestClass', ['value1', 'value2']);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('is invalid');
        });

        test('should return an error for a value not in the array with type name', () => {
            const errors = ParamsValidatorUtils.isIn('attr', 'value3', 'TestClass', ['value1', 'value2'], 'typeName');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be one of the valid typeName values');
        });
    });

    describe('isArray', () => {
        test('should return no errors for an array', () => {
            const errors = ParamsValidatorUtils.isArray('attr', ['test1', 'test2'], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an empty array', () => {
            const errors = ParamsValidatorUtils.isArray('attr', [], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isArray('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-array value', () => {
            const errors = ParamsValidatorUtils.isArray('attr', 'invalid', 'TestClass'); expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array');
        });
    });

    describe('isArrayOfStrings', () => {
        test('should return no errors for an array of strings', () => {
            const errors = ParamsValidatorUtils.isArrayOfStrings('attr', ['value1', 'value2'], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isArrayOfStrings('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an empty array', () => {
            const errors = ParamsValidatorUtils.isArrayOfStrings('attr', [], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-array value', () => {
            const errors = ParamsValidatorUtils.isArrayOfStrings('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of strings');
        });

        test('should return an error for an array with non-string values', () => {
            const errors = ParamsValidatorUtils.isArrayOfStrings('attr', ['value1', 123], 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of strings');
        });
    });

    describe('isArrayOfDateStrings', () => {
        test('should return no errors for an array of date strings', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', ['2023-01-01', '2023-01-02'], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an empty array', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', [], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-array value', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array');
        });

        test('should return an error for an array with invalid date strings', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', ['2023-01-01', 'invalid'], 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of date strings');
        });

        test('should return an error for an array with invalid date strings with a non-string value', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', [123], 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of strings');
        });

        test('should return an error for an array with invalid date strings with at least one non-string value (object)', () => {
            const errors = ParamsValidatorUtils.isArrayOfDateStrings('attr', ['2023-01-01', {}], 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of strings');
        });
    });

    describe('isArrayOfNumbers', () => {
        test('should return no errors for an array of numbers', () => {
            const errors = ParamsValidatorUtils.isArrayOfNumbers('attr', [1, 2, 3], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isArrayOfNumbers('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an empty array', () => {
            const errors = ParamsValidatorUtils.isArrayOfNumbers('attr', [], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-array value', () => {
            const errors = ParamsValidatorUtils.isArrayOfNumbers('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of numbers');
        });

        test('should return an error for an array with non-number values', () => {
            const errors = ParamsValidatorUtils.isArrayOfNumbers('attr', [1, 'invalid', 3], 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of numbers');
        });
    });

    describe('isArrayOfUuids', () => {
        test('should return no errors for an array of valid UUIDs', () => {
            const errors = ParamsValidatorUtils.isArrayOfUuids('attr', [uuidV4(), uuidV4()], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isArrayOfUuids('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an empty array', () => {
            const errors = ParamsValidatorUtils.isArrayOfUuids('attr', [], 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-array value', () => {
            const errors = ParamsValidatorUtils.isArrayOfUuids('attr', 'invalid', 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of valid uuids');
        });

        test('should return an error for an array with invalid UUIDs', () => {
            const errors = ParamsValidatorUtils.isArrayOfUuids('attr', ['valid-uuid', 'invalid'], 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of valid uuids');
        });
    });

    describe('isArrayOf', () => {
        test('should return no errors for an array of instances of the specified class', () => {
            const errors = ParamsValidatorUtils.isArrayOf('attr', [new TestClass(), new TestClass()], 'TestClass', TestClass);
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isArrayOf('attr', undefined, 'TestClass', TestClass);
            expect(errors).toEqual([]);
        });

        test('should return no errors for an empty array', () => {
            const errors = ParamsValidatorUtils.isArrayOf('attr', [], 'TestClass', TestClass);
            expect(errors).toEqual([]);
        });

        test('should return an error for a non-array value', () => {
            const errors = ParamsValidatorUtils.isArrayOf('attr', 'invalid', 'TestClass', TestClass);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of TestClass');
        });

        test('should return an error for an array with non-instances of the specified class', () => {
            const errors = ParamsValidatorUtils.isArrayOf('attr', [new TestClass(), 'invalid'], 'TestClass', TestClass);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be an array of TestClass');
        });
    });

    describe('isGeojsonPoint', () => {
        test('should return no errors for a valid GeoJSON Point', () => {
            const point: GeoJSON.Feature<GeoJSON.Point> = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                }
            };
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', point, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON Point', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', { type: 'Feature', geometry: { type: 'Invalid' } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson point');
        });

        test('should return an error for an empty GeoJSON Point coordinates', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', { type: 'Feature', geometry: { type: 'Point', coordinates: [] } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson point');
        });

        test('should return an error for an undefined GeoJSON Point coordinates', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', { type: 'Feature', geometry: { type: 'Point', coordinates: undefined } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson point');
        });
    });

    describe('isGeojsonLineString', () => {
        test('should return no errors for a valid GeoJSON LineString', () => {
            const lineString: GeoJSON.Feature<GeoJSON.LineString> = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [1, 1]]
                }
            };
            const errors = ParamsValidatorUtils.isGeojsonLineString('attr', lineString, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON LineString', () => {
            const errors = ParamsValidatorUtils.isGeojsonLineString('attr', { type: 'Feature', geometry: { type: 'Invalid' } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson line string');
        });
    });

    describe('isGeojsonPolygon', () => {
        test('should return no errors for a valid GeoJSON Polygon', () => {
            const polygon: GeoJSON.Feature<GeoJSON.Polygon> = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon', coordinates: [
                        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
                    ]
                }
            };
            const errors = ParamsValidatorUtils.isGeojsonPolygon('attr', polygon, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON Polygon', () => {
            const errors = ParamsValidatorUtils.isGeojsonPolygon('attr', { type: 'Feature', geometry: { type: 'Invalid' } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson polygon');
        });
    });

    describe('isGeojsonMultiPoint', () => {
        test('should return no errors for a valid GeoJSON MultiPoint', () => {
            const multiPoint: GeoJSON.Feature<GeoJSON.MultiPoint> = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'MultiPoint',
                    coordinates: [[0, 0], [1, 1]]
                }
            };
            const errors = ParamsValidatorUtils.isGeojsonMultiPoint('attr', multiPoint, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON MultiPoint', () => {
            const errors = ParamsValidatorUtils.isGeojsonMultiPoint('attr', { type: 'Feature', geometry: { type: 'Invalid' } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson multi point');
        });
    });

    describe('isGeojsonMultiLineString', () => {
        test('should return no errors for a valid GeoJSON MultiLineString', () => {
            const multiLineString: GeoJSON.Feature<GeoJSON.MultiLineString> = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'MultiLineString',
                    coordinates: [
                        [[0, 0], [1, 1]],
                        [[2, 2], [3, 3]]
                    ]
                }
            };
            const errors = ParamsValidatorUtils.isGeojsonMultiLineString('attr', multiLineString, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON MultiLineString', () => {
            const errors = ParamsValidatorUtils.isGeojsonMultiLineString('attr', { type: 'Feature', geometry: { type: 'Invalid' } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson multi line string');
        });
    });

    describe('isGeojsonMultiPolygon', () => {
        test('should return no errors for a valid GeoJSON MultiPolygon', () => {
            const multiPolygon: GeoJSON.Feature<GeoJSON.MultiPolygon> = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'MultiPolygon',
                    coordinates: [
                        [
                            [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
                        ],
                        [
                            [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]
                        ]
                    ]
                }
            };
            const errors = ParamsValidatorUtils.isGeojsonMultiPolygon('attr', multiPolygon, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON MultiPolygon', () => {
            const errors = ParamsValidatorUtils.isGeojsonMultiPolygon('attr', { type: 'Feature', geometry: { type: 'Invalid' } }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson multi polygon');
        });
    });

    describe('isGeojsonFeatureCollection', () => {
        test('should return no errors for a valid GeoJSON FeatureCollection', () => {
            const featureCollection: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [0, 0]
                        },
                        properties: {}
                    }
                ]
            };
            const errors = ParamsValidatorUtils.isGeojsonFeatureCollection('attr', featureCollection, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for an undefined value', () => {
            const errors = ParamsValidatorUtils.isGeojsonPoint('attr', undefined, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return no errors for a valid empty GeoJSON FeatureCollection', () => {
            const featureCollection: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: []
            };
            const errors = ParamsValidatorUtils.isGeojsonFeatureCollection('attr', featureCollection, 'TestClass');
            expect(errors).toEqual([]);
        });

        test('should return an error for an invalid GeoJSON FeatureCollection', () => {
            const errors = ParamsValidatorUtils.isGeojsonFeatureCollection('attr', { type: 'Invalid' }, 'TestClass');
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain('should be a valid geojson feature collection');
        });
    });
});
