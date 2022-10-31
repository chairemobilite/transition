/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { NodeAttributes } from "../../nodes/Node";
import NodeCollection from "../../nodes/NodeCollection";
import { TransitAccessibilityMapResultByNode } from "../TransitAccessibilityMapResult";

// Initialize data, 2 nodes have accessible places data
const node1Point = { type: 'Point' as const, coordinates: [-73.1, 45] };
const node2Point = { type: 'Point' as const, coordinates: [-73.2, 45] };
const node3Point = { type: 'Point' as const, coordinates: [-73.3, 45] };
const node1 = {
    id: 1,
    geometry: node1Point,
    type: 'Feature' as const,
    properties: {
        id: 'node1uuid',
        code: 'code1',
        routing_radius_meters: 10,
        default_dwell_time_seconds: 20,
        data: {
            accessiblePlaces: {
                walking: { 
                    mode: 'walking' as const,
                    placesByTravelTimeByCategory: [{
                        service: [ 0 ],
                        craft: [ 10 ],
                        farm: [ 20 ],
                    },
                    {
                        service: [ 1, 2 ],
                        craft: [ 11 ],
                        farm: [ 21 ],
                    },
                    {
                        service: [ 3 ],
                        craft: [ 12, 13 ],
                        farm: [ 22 ],
                    },
                    {
                        service: [ ],
                        craft: [ 14, 15 ],
                        farm: [ 23 ],
                    }],
                    placesByTravelTimeByDetailedCategory: [{
                        conference_center: [ 0 ],
                        craft: [ 10 ],
                        farm: [ 20 ],
                    },
                    {
                        conference_center: [ 1, 2 ],
                        craft: [ 11 ],
                        farm: [ 21 ],
                    },
                    {
                        conference_center: [ 3 ],
                        craft: [ 12, 13 ],
                        farm: [ 22 ],
                    },
                    {
                        conference_center: [ ],
                        craft: [ 14, 15 ],
                        farm: [ 23 ],
                    }]
                }
            }
        },
        geography: node1Point
    }
};
const node2 = {
    id: 2,
    geometry: node2Point,
    type: 'Feature' as const,
    properties: {
        id: 'node2uuid',
        code: 'code2',
        routing_radius_meters: 10,
        default_dwell_time_seconds: 20,
        data: {},
        geography: node2Point
    }
};
const node3 = {
    id: 3,
    geometry: node3Point,
    type: 'Feature' as const,
    properties: {
        id: 'node3uuid',
        code: 'code3',
        routing_radius_meters: 10,
        default_dwell_time_seconds: 20,
        data: {
            accessiblePlaces: {
                walking: { 
                    mode: 'walking' as const,
                    placesByTravelTimeByCategory: [{
                        service: [ 100 ],
                        craft: [ 110 ],
                        farm: [ 120 ],
                    },
                    {
                        service: [ 101, 102 ],
                        craft: [ 111 ],
                        farm: [ 121 ],
                    },
                    {
                        service: [ 103 ],
                        craft: [ 112, 113 ],
                        farm: [ 122 ],
                    },
                    {
                        service: [ ],
                        craft: [ 14, 15 ],
                        farm: [ 23 ],
                    }],
                    placesByTravelTimeByDetailedCategory: [{
                        conference_center: [ 100 ],
                        craft: [ 110 ],
                        farm: [ 120 ],
                    },
                    {
                        conference_center: [ 101, 102 ],
                        craft: [ 111 ],
                        farm: [ 121 ],
                    },
                    {
                        conference_center: [ 103 ],
                        craft: [ 112, 113 ],
                        farm: [ 122 ],
                    },
                    {
                        conference_center: [ ],
                        craft: [ 14, 15 ],
                        farm: [ 23 ],
                    }]
                }
            }
        },
        geography: node3Point
    }
};

const nodeCollection = new NodeCollection([ node1, node2, node3 ], {});

describe('Test results with a single routing result', () => {

    const trRoutingResult = {
        type: 'nodes' as const,
        nodes: [{
            departureTime: '06:55',
            departureTimeSeconds: 24900,
            id: node1.properties.id,
            numberOfTransfers: 0,
            totalTravelTimeSeconds: 250
        },
        {
            departureTime: '06:52',
            departureTimeSeconds: 24720,
            id: node2.properties.id,
            numberOfTransfers: 0,
            totalTravelTimeSeconds: 500
        },
        {
            departureTime: '06:52',
            departureTimeSeconds: 24720,
            id: node3.properties.id,
            numberOfTransfers: 1,
            totalTravelTimeSeconds: 1500
        }]
    };
    const accessMapResult = new TransitAccessibilityMapResultByNode([trRoutingResult], 2000);

    test('Places stats for short duration', () => {
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(200, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 0,
            craft: 0,
            farm: 0
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 0,
            craft: 0,
            farm: 0
        }));
    });

    test('Places stats for duration that includes all places from node 1 but none from node3', () => {
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(700, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 4,
            craft: 6,
            farm: 4
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 4,
            craft: 6,
            farm: 4
        }));
    });

    test('Places stats for duration that includes only first 2 minutes from node1', () => {
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(trRoutingResult.nodes[0].totalTravelTimeSeconds + 120, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 4,
            craft: 4,
            farm: 3
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 4,
            craft: 4,
            farm: 3
        }));
    });

    test('Places stats for duration long enough to span all', () => {
        // Last accessible locations are common for both nodes, they should be counted once
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(2000, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 8,
            craft: 10,
            farm: 7
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 8,
            craft: 10,
            farm: 7
        }));
    });

    test('Test specific stat method', () => {
        const statMethod = jest.fn();
        accessMapResult.getAccessibilityStatsForDuration(2000, nodeCollection, { statMethod });
        expect(statMethod).toHaveBeenCalledWith(
            expect.anything(), 
            {
                0: 4, 10: 4, 20: 4,
                1: 5, 2: 5, 11: 5, 21: 5,
                3: 6, 12: 6, 13: 6, 22: 6,
                14: 7, 15: 7, 23: 7,
                100: 25, 110: 25, 120: 25,
                101: 26, 102: 26, 111: 26, 121: 26,
                103: 27, 112: 27, 113: 27, 122: 27
            }
        );
    });
});

describe('Test results with a multiple routing results', () => {

    const trRoutingResults = [{
        type: 'nodes' as const,
        nodes: [{
            departureTime: '06:55',
            departureTimeSeconds: 24900,
            id: node1.properties.id,
            numberOfTransfers: 0,
            totalTravelTimeSeconds: 250
        },
        {
            departureTime: '06:52',
            departureTimeSeconds: 24720,
            id: node2.properties.id,
            numberOfTransfers: 0,
            totalTravelTimeSeconds: 500
        },
        {
            departureTime: '06:52',
            departureTimeSeconds: 24720,
            id: node3.properties.id,
            numberOfTransfers: 1,
            totalTravelTimeSeconds: 1500
        }]
    },
    {
        type: 'nodes' as const,
        nodes: [{
            departureTime: '06:45',
            departureTimeSeconds: 24300,
            id: node1.properties.id,
            numberOfTransfers: 0,
            totalTravelTimeSeconds: 1000
        },
        {
            departureTime: '06:44',
            departureTimeSeconds: 24240,
            id: node2.properties.id,
            numberOfTransfers: 0,
            totalTravelTimeSeconds: 500
        },
        {
            departureTime: '06:42',
            departureTimeSeconds: 24120,
            id: node3.properties.id,
            numberOfTransfers: 1,
            totalTravelTimeSeconds: 1500
        }]
    }];
    const accessMapResult = new TransitAccessibilityMapResultByNode(trRoutingResults, 2000);

    test('Places stats for short duration', () => {
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(200, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 0,
            craft: 0,
            farm: 0
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 0,
            craft: 0,
            farm: 0
        }));
    });

    test('Places stats for duration that includes all places from node 1 but none from node3', () => {
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(700, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 4,
            craft: 6,
            farm: 4
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 4,
            craft: 6,
            farm: 4
        }));
    });

    test('Places stats for duration that includes only first 2 minutes from node1', () => {
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(trRoutingResults[0].nodes[0].totalTravelTimeSeconds + 240, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 4,
            craft: 4,
            farm: 3
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 4,
            craft: 4,
            farm: 3
        }));
    });

    test('Places stats for duration long enough to span all', () => {
        // Last accessible locations are common for both nodes, they should be counted once
        const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } = accessMapResult.getAccessibilityStatsForDuration(2000, nodeCollection);
        expect(accessiblePlacesCountByCategory).toEqual(expect.objectContaining({
            service: 8,
            craft: 10,
            farm: 7
        }));
        expect(accessiblePlacesCountByDetailedCategory).toEqual(expect.objectContaining({
            conference_center: 8,
            craft: 10,
            farm: 7
        }));
    });
})