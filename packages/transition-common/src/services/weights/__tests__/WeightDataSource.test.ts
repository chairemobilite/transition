/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import WeightDataSource, { WeightDataSourceAttributes } from '../WeightDataSource';
import { WeightingModel, WeightingModelAttributes } from '../WeightingModel';

describe('WeightDataSource', () => {
    const minimalAttributes: WeightDataSourceAttributes = {
        id: 1,
        name: 'Test Data Source'
    };

    const fullAttributes: WeightDataSourceAttributes = {
        id: 2,
        name: 'Full Data Source',
        description: 'A comprehensive data source with weighted points',
        weighting_model_id: 5,
        max_access_time_seconds: 1800,
        max_bird_distance_meters: 1500,
        created_at: '2025-01-15T10:30:00Z',
        updated_at: '2025-01-16T14:20:00Z'
    };

    const weightingModelAttributes: WeightingModelAttributes = {
        id: 5,
        name: 'Test Weighting Model',
        calculation: 'weight / travel_time^2'
    };

    describe('Constructor', () => {
        it('should create a WeightDataSource with minimal attributes', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.attributes).toEqual(minimalAttributes);
            expect(dataSource.id).toBe(1);
            expect(dataSource.name).toBe('Test Data Source');
            expect(dataSource.weightingModel).toBeUndefined();
        });

        it('should create a WeightDataSource with all attributes', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.attributes).toEqual(fullAttributes);
            expect(dataSource.id).toBe(2);
            expect(dataSource.name).toBe('Full Data Source');
            expect(dataSource.description).toBe('A comprehensive data source with weighted points');
            expect(dataSource.weightingModelId).toBe(5);
        });

        it('should create a WeightDataSource with associated WeightingModel', () => {
            const weightingModel = new WeightingModel(weightingModelAttributes);
            const dataSource = new WeightDataSource(fullAttributes, weightingModel);
            expect(dataSource.weightingModel).toBe(weightingModel);
            expect(dataSource.weightingModel?.name).toBe('Test Weighting Model');
        });

        it('should handle undefined WeightingModel', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.weightingModel).toBeUndefined();
        });
    });

    describe('Getters', () => {
        it('should return correct id', () => {
            const dataSource = new WeightDataSource({ id: 10, name: 'Source 10' }, undefined);
            expect(dataSource.id).toBe(10);
        });

        it('should return correct name', () => {
            const dataSource = new WeightDataSource({ id: 1, name: 'My Data Source' }, undefined);
            expect(dataSource.name).toBe('My Data Source');
        });

        it('should return undefined for optional description when not provided', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.description).toBeUndefined();
        });

        it('should return description when provided', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.description).toBe('A comprehensive data source with weighted points');
        });

        it('should return undefined for optional weighting_model_id when not provided', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.weightingModelId).toBeUndefined();
        });

        it('should return weighting_model_id when provided', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.weightingModelId).toBe(5);
        });

        it('should return undefined for optional max_access_time_seconds when not provided', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.maxAccessTimeSeconds).toBeUndefined();
        });

        it('should return max_access_time_seconds when provided', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.maxAccessTimeSeconds).toBe(1800);
        });

        it('should return undefined for optional max_bird_distance_meters when not provided', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.maxBirdDistanceMeters).toBeUndefined();
        });

        it('should return max_bird_distance_meters when provided', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.maxBirdDistanceMeters).toBe(1500);
        });

        it('should return undefined for optional createdAt when not provided', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.createdAt).toBeUndefined();
        });

        it('should return createdAt when provided', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.createdAt).toBe('2025-01-15T10:30:00Z');
        });

        it('should return undefined for optional updatedAt when not provided', () => {
            const dataSource = new WeightDataSource(minimalAttributes, undefined);
            expect(dataSource.updatedAt).toBeUndefined();
        });

        it('should return updatedAt when provided', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.updatedAt).toBe('2025-01-16T14:20:00Z');
        });

        it('should return all attributes', () => {
            const dataSource = new WeightDataSource(fullAttributes, undefined);
            expect(dataSource.attributes).toEqual(fullAttributes);
        });

        it('should return associated WeightingModel when provided', () => {
            const weightingModel = new WeightingModel(weightingModelAttributes);
            const dataSource = new WeightDataSource(fullAttributes, weightingModel);
            expect(dataSource.weightingModel).toBe(weightingModel);
            expect(dataSource.weightingModel?.id).toBe(5);
        });
    });

    describe('toString', () => {
        it('should return the data source name', () => {
            const dataSource = new WeightDataSource({ id: 1, name: 'POI Data Source' }, undefined);
            expect(dataSource.toString()).toBe('POI Data Source');
        });

        it('should return empty string if name is empty', () => {
            const dataSource = new WeightDataSource({ id: 1, name: '' }, undefined);
            expect(dataSource.toString()).toBe('');
        });
    });

    describe('Static methods', () => {
        it('should return correct display name', () => {
            expect(WeightDataSource.getDisplayName()).toBe('WeightDataSource');
        });

        it('should return correct plural name', () => {
            expect(WeightDataSource.getPluralName()).toBe('weightDataSources');
        });

        it('should return correct capitalized plural name', () => {
            expect(WeightDataSource.getCapitalizedPluralName()).toBe('WeightDataSources');
        });
    });
});
