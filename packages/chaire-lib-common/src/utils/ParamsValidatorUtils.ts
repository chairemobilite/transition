/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { validate as uuidValidate } from 'uuid';
import {
    isFeature,
    isPoint,
    isLineString,
    isPolygon,
    isMultiPoint,
    isMultiLineString,
    isMultiPolygon,
    isFeatureCollection
} from 'geojson-validation';

// type for a class: https://stackoverflow.com/a/64985108
declare type Class<T = unknown> = new (...args: unknown[]) => T;

export class ParamsValidatorUtils {
    static isObject(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && typeof value !== 'object') {
            return [new Error(`${displayName} validateParams: ${attribute} should be an object`)];
        } else {
            return [];
        }
    }

    static isRequired(attribute: string, value: unknown, displayName: string): Error[] {
        if (value === undefined) {
            return [new Error(`${displayName} validateParams: ${attribute} is required`)];
        } else {
            return [];
        }
    }

    static isInstanceOf(attribute: string, value: unknown, displayName: string, _class: Class): Error[] {
        if (value !== undefined && !(value instanceof _class)) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an instance of ${_class.name}`)];
        } else {
            return [];
        }
    }

    static isString(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && typeof value !== 'string') {
            return [new Error(`${displayName} validateParams: ${attribute} should be a string`)];
        } else {
            return [];
        }
    }

    static isNonEmptyString(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (typeof value !== 'string' || value.trimStart().trim() === '')) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a non-empty string`)];
        } else {
            return [];
        }
    }

    static isBoolean(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && typeof value !== 'boolean') {
            return [new Error(`${displayName} validateParams: ${attribute} should be a boolean`)];
        } else {
            return [];
        }
    }

    static isUuid(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (typeof value !== 'string' || !uuidValidate(value))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a valid uuid`)];
        } else {
            return [];
        }
    }

    static isPositiveInteger(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!Number.isInteger(value) || Number(value) < 0)) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a positive integer`)];
        } else {
            return [];
        }
    }

    static isInteger(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && !Number.isInteger(value)) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an integer`)];
        } else {
            return [];
        }
    }

    static isPositiveNumber(attribute: string, value: unknown, displayName: string): Error[] {
        if ((value !== undefined && typeof value !== 'number') || Number(value) < 0) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a positive number`)];
        } else {
            return [];
        }
    }

    static isNumber(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a number`)];
        } else {
            return [];
        }
    }

    // a date string is a string of format 'YYYY-MM-DD'
    static isDateString(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined) {
            const date = new Date(value + 'T00:00:00');
            if (!(date instanceof Date) || isNaN(date.getDate())) {
                return [new Error(`${displayName} validateParams: ${attribute} should be a valid date string`)];
            }
        }
        return [];
    }

    static isIn(attribute: string, value: unknown, displayName: string, inArray: unknown[], typeName?: string) {
        if (value !== undefined && !inArray.includes(value)) {
            return [
                new Error(
                    `${displayName} validateParams: ${attribute} ${
                        typeName ? `should be one of the valid ${typeName} values` : 'is invalid'
                    }`
                )
            ];
        } else {
            return [];
        }
    }

    static isArray(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && !Array.isArray(value)) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an array`)];
        } else {
            return [];
        }
    }

    static isArrayOfStrings(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an array of strings`)];
        } else {
            return [];
        }
    }

    static isArrayOfDateStrings(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && Array.isArray(value)) {
            for (let i = 0, countI = value.length; i < countI; i++) {
                if (typeof value[i] !== 'string') {
                    return [new Error(`${displayName} validateParams: ${attribute} should be an array of strings`)];
                }
                const date = new Date(value[i] + 'T00:00:00');
                if (!(date instanceof Date) || isNaN(date.getDate())) {
                    return [
                        new Error(`${displayName} validateParams: ${attribute} should be an array of date strings`)
                    ];
                }
            }
        } else if (value !== undefined && !Array.isArray(value)) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an array`)];
        }
        return [];
    }

    static isArrayOfNumbers(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!Array.isArray(value) || value.some((v) => typeof v !== 'number'))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an array of numbers`)];
        } else {
            return [];
        }
    }

    static isArrayOfUuids(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!Array.isArray(value) || value.some((v) => !uuidValidate(v)))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an array of valid uuids`)];
        } else {
            return [];
        }
    }

    static isArrayOf(attribute: string, value: unknown, displayName: string, _class: Class): Error[] {
        if (value !== undefined && (!Array.isArray(value) || value.some((v) => !(v instanceof _class)))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be an array of ${_class.name}`)];
        } else {
            return [];
        }
    }

    static isGeojsonPoint(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!isFeature(value) || !isPoint((value as GeoJSON.Feature).geometry))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a valid geojson point`)];
        } else {
            return [];
        }
    }

    static isGeojsonLineString(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!isFeature(value) || !isLineString((value as GeoJSON.Feature).geometry))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a valid geojson line string`)];
        } else {
            return [];
        }
    }

    static isGeojsonPolygon(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!isFeature(value) || !isPolygon((value as GeoJSON.Feature).geometry))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a valid geojson polygon`)];
        } else {
            return [];
        }
    }

    static isGeojsonMultiPoint(attribute, value: unknown, displayName): Error[] {
        if (value !== undefined && (!isFeature(value) || !isMultiPoint((value as GeoJSON.Feature).geometry))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a valid geojson multi point`)];
        } else {
            return [];
        }
    }

    static isGeojsonMultiLineString(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!isFeature(value) || !isMultiLineString((value as GeoJSON.Feature).geometry))) {
            return [
                new Error(`${displayName} validateParams: ${attribute} should be a valid geojson multi line string`)
            ];
        } else {
            return [];
        }
    }

    static isGeojsonMultiPolygon(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && (!isFeature(value) || !isMultiPolygon((value as GeoJSON.Feature).geometry))) {
            return [new Error(`${displayName} validateParams: ${attribute} should be a valid geojson multi polygon`)];
        } else {
            return [];
        }
    }

    static isGeojsonFeatureCollection(attribute: string, value: unknown, displayName: string): Error[] {
        if (value !== undefined && !isFeatureCollection(value)) {
            return [
                new Error(`${displayName} validateParams: ${attribute} should be a valid geojson feature collection`)
            ];
        } else {
            return [];
        }
    }
}
