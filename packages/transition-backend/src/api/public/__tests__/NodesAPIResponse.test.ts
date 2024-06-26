/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import NodesAPIResponse from '../NodesAPIResponse';
import TestUtils from 'chaire-lib-common/lib/test/TestUtils';
import each from 'jest-each';

const basicNode: NodeAttributes = {
    id: '1',
    geography: TestUtils.makePoint([0, 0]).geometry,
    code: 'A',
    routing_radius_meters: 50,
    default_dwell_time_seconds: 30,
    data: {}
}
const nodeWithAllAttributes: NodeAttributes = {
    id: '2',
    geography: TestUtils.makePoint([1, 1]).geometry,
    code: 'B',
    routing_radius_meters: 50,
    default_dwell_time_seconds: 30,
    name: 'Node B',
    station_id: '3',
    is_enabled: true,
    is_frozen: false,
    data: {}
};
const nodeWithAllAttributesAndData: NodeAttributes = {
    id: '3',
    geography: TestUtils.makePoint([1, 0]).geometry,
    code: 'C',
    routing_radius_meters: 50,
    default_dwell_time_seconds: 30,
    name: 'Node C',
    is_enabled: true,
    is_frozen: false,
    data: {
        transferableNodes: {
            nodesIds: ['1'],
            walkingTravelTimesSeconds: [100],
            walkingDistancesMeters: [200]
        },
        stops: [{
            code: 'C1',
            name: 'Stop C1',
            geography: TestUtils.makePoint([1, 0.001]).geometry,
            id: 'C1',
            data: {
                gtfs: {
                    stop_id: 'C1',
                    location_type: 0
                }
            }
        }, {
            code: 'C2',
            name: 'Stop C2',
            geography: TestUtils.makePoint([1.001, 0]).geometry,
            id: 'C2',
            data: {
                gtfs: {
                    stop_id: 'C2',
                    location_type: 0
                }
            }
        }]
    }
}

each([
    ['basic node', [basicNode], { 
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            id: basicNode.id,
            geometry: basicNode.geography,
            properties: {
                id: basicNode.id,
                code: basicNode.code,
                name: basicNode.name,
                stops: []
            }
        }]
    }],
    ['nodes without stops', [basicNode, nodeWithAllAttributes], { 
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            id: basicNode.id,
            geometry: basicNode.geography,
            properties: {
                id: basicNode.id,
                code: basicNode.code,
                name: basicNode.name,
                stops: []
            }
        }, {
            type: 'Feature',
            id: nodeWithAllAttributes.id,
            geometry: nodeWithAllAttributes.geography,
            properties: {
                id: nodeWithAllAttributes.id,
                code: nodeWithAllAttributes.code,
                name: nodeWithAllAttributes.name,
                stops: []
            }
        }]
    }],
    ['only nodes with stops', [nodeWithAllAttributesAndData], { 
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            id: nodeWithAllAttributesAndData.id,
            geometry: nodeWithAllAttributesAndData.geography,
            properties: {
                id: nodeWithAllAttributesAndData.id,
                code: nodeWithAllAttributesAndData.code,
                name: nodeWithAllAttributesAndData.name,
                stops: [{
                    id: nodeWithAllAttributesAndData.data.stops![0].id,
                    code: nodeWithAllAttributesAndData.data.stops![0].code,
                    name: nodeWithAllAttributesAndData.data.stops![0].name,
                    geography: nodeWithAllAttributesAndData.data.stops![0].geography
                }, {
                    id: nodeWithAllAttributesAndData.data.stops![1].id,
                    code: nodeWithAllAttributesAndData.data.stops![1].code,
                    name: nodeWithAllAttributesAndData.data.stops![1].name,
                    geography: nodeWithAllAttributesAndData.data.stops![1].geography
                }]
            }
        }]
    }],
]).test('NodesAPIResponse %s', (_title, nodeAttributes: NodeAttributes[], expected) => {
    const input = {
        type: 'FeatureCollection' as const,
        features: nodeAttributes.map(attributes => ({
            type: 'Feature' as const,
            geometry: attributes.geography,
            id: attributes.id,
            properties: attributes
        }))
    };

    const response = new NodesAPIResponse(input).getResponse();

    expect(response).toEqual(expected);
});