/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import TransitNodeWeight, { TransitNodeWeightAttributes } from '../TransitNodeWeight';
import { WeightDataSource, WeightDataSourceAttributes } from '../WeightDataSource';
import { WeightingModel, WeightingModelAttributes } from '../WeightingModel';
import { Node, NodeAttributes } from '../../nodes/Node';
import { v4 as uuidV4 } from 'uuid';

describe('TransitNodeWeight', () => {
    const nodeId = uuidV4();
    const minimalAttributes: TransitNodeWeightAttributes = {
        weight_data_source_id: 1,
        transit_node_id: nodeId,
        weight_value: 100.5
    };

    const fullAttributes: TransitNodeWeightAttributes = {
        weight_data_source_id: 2,
        transit_node_id: uuidV4(),
        weight_value: 250.75
    };

    const weightingModelAttributes: WeightingModelAttributes = {
        id: 5,
        name: 'Test Weighting Model'
    };

    const weightDataSourceAttributes: WeightDataSourceAttributes = {
        id: 2,
        name: 'Test Data Source',
        weighting_model_id: 5,
        max_access_time_seconds: 1800,
        max_bird_distance_meters: 1500
    };

    const createMockNode = (): Node => {
        const nodeAttributes: NodeAttributes = {
            id: fullAttributes.transit_node_id,
            geography: {
                type: 'Point',
                coordinates: [-73.5615, 45.5017]
            } as GeoJSON.Point,
            code: 'TEST001',
            routing_radius_meters: 20,
            default_dwell_time_seconds: 30,
            data: {}
        } as NodeAttributes;
        return new Node(nodeAttributes, true);
    };

    describe('Constructor', () => {
        it('should create a TransitNodeWeight with minimal attributes', () => {
            const nodeWeight = new TransitNodeWeight(minimalAttributes, undefined, undefined);
            expect(nodeWeight.attributes).toEqual(minimalAttributes);
            expect(nodeWeight.weightDataSourceId).toBe(1);
            expect(nodeWeight.transitNodeId).toBe(nodeId);
            expect(nodeWeight.weightValue).toBe(100.5);
            expect(nodeWeight.weightDataSource).toBeUndefined();
            expect(nodeWeight.transitNode).toBeUndefined();
        });

        it('should create a TransitNodeWeight with all attributes', () => {
            const nodeWeight = new TransitNodeWeight(fullAttributes, undefined, undefined);
            expect(nodeWeight.attributes).toEqual(fullAttributes);
            expect(nodeWeight.weightDataSourceId).toBe(2);
            expect(nodeWeight.weightValue).toBe(250.75);
        });

        it('should create a TransitNodeWeight with associated WeightDataSource', () => {
            const weightingModel = new WeightingModel(weightingModelAttributes);
            const weightDataSource = new WeightDataSource(weightDataSourceAttributes, weightingModel);
            const nodeWeight = new TransitNodeWeight(fullAttributes, weightDataSource, undefined);
            expect(nodeWeight.weightDataSource).toBe(weightDataSource);
            expect(nodeWeight.weightDataSource?.name).toBe('Test Data Source');
        });

        it('should create a TransitNodeWeight with associated Node', () => {
            const node = createMockNode();
            const nodeWeight = new TransitNodeWeight(fullAttributes, undefined, node);
            expect(nodeWeight.transitNode).toBe(node);
            expect(nodeWeight.transitNode?.attributes.code).toBe('TEST001');
        });

        it('should create a TransitNodeWeight with both WeightDataSource and Node', () => {
            const weightingModel = new WeightingModel(weightingModelAttributes);
            const weightDataSource = new WeightDataSource(weightDataSourceAttributes, weightingModel);
            const node = createMockNode();
            const nodeWeight = new TransitNodeWeight(fullAttributes, weightDataSource, node);
            expect(nodeWeight.weightDataSource).toBe(weightDataSource);
            expect(nodeWeight.transitNode).toBe(node);
        });

        it('should handle undefined WeightDataSource and Node', () => {
            const nodeWeight = new TransitNodeWeight(minimalAttributes, undefined, undefined);
            expect(nodeWeight.weightDataSource).toBeUndefined();
            expect(nodeWeight.transitNode).toBeUndefined();
        });
    });

    describe('Getters', () => {
        it('should return correct weight_data_source_id', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_data_source_id: 10 }, undefined, undefined);
            expect(nodeWeight.weightDataSourceId).toBe(10);
        });

        it('should return correct transit_node_id', () => {
            const testNodeId = uuidV4();
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, transit_node_id: testNodeId }, undefined, undefined);
            expect(nodeWeight.transitNodeId).toBe(testNodeId);
        });

        it('should return correct weight_value', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_value: 999.99 }, undefined, undefined);
            expect(nodeWeight.weightValue).toBe(999.99);
        });

        it('should return zero weight value', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_value: 0 }, undefined, undefined);
            expect(nodeWeight.weightValue).toBe(0);
        });

        it('should return negative weight value', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_value: -10.5 }, undefined, undefined);
            expect(nodeWeight.weightValue).toBe(-10.5);
        });

        it('should return all attributes', () => {
            const nodeWeight = new TransitNodeWeight(fullAttributes, undefined, undefined);
            expect(nodeWeight.attributes).toEqual(fullAttributes);
        });

        it('should return associated WeightDataSource when provided', () => {
            const weightingModel = new WeightingModel(weightingModelAttributes);
            const weightDataSource = new WeightDataSource(weightDataSourceAttributes, weightingModel);
            const nodeWeight = new TransitNodeWeight(fullAttributes, weightDataSource, undefined);
            expect(nodeWeight.weightDataSource).toBe(weightDataSource);
            expect(nodeWeight.weightDataSource?.id).toBe(2);
        });

        it('should return associated Node when provided', () => {
            const node = createMockNode();
            const nodeWeight = new TransitNodeWeight(fullAttributes, undefined, node);
            expect(nodeWeight.transitNode).toBe(node);
            expect(nodeWeight.transitNode?.attributes.code).toBe('TEST001');
        });
    });

    describe('toString', () => {
        it('should return formatted string with node ID and weight', () => {
            const nodeWeight = new TransitNodeWeight(minimalAttributes, undefined, undefined);
            expect(nodeWeight.toString()).toBe(`Node ${nodeId}: weight 100.5`);
        });

        it('should handle zero weight value', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_value: 0 }, undefined, undefined);
            expect(nodeWeight.toString()).toBe(`Node ${nodeId}: weight 0`);
        });

        it('should handle negative weight value', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_value: -50.25 }, undefined, undefined);
            expect(nodeWeight.toString()).toBe(`Node ${nodeId}: weight -50.25`);
        });

        it('should handle decimal weight values', () => {
            const nodeWeight = new TransitNodeWeight({ ...minimalAttributes, weight_value: 123.456789 }, undefined, undefined);
            expect(nodeWeight.toString()).toBe(`Node ${nodeId}: weight 123.456789`);
        });
    });

    describe('Static methods', () => {
        it('should return correct display name', () => {
            expect(TransitNodeWeight.getDisplayName()).toBe('TransitNodeWeight');
        });

        it('should return correct plural name', () => {
            expect(TransitNodeWeight.getPluralName()).toBe('transitNodeWeights');
        });

        it('should return correct capitalized plural name', () => {
            expect(TransitNodeWeight.getCapitalizedPluralName()).toBe('TransitNodeWeights');
        });
    });
});
