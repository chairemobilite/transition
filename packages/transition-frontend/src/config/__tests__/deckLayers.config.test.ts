/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// Mock deck.gl modules before importing the config
jest.mock('@deck.gl/layers', () => ({
    PathLayer: jest.fn().mockImplementation((props) => ({
        id: props.id,
        props
    })),
    ScatterplotLayer: jest.fn().mockImplementation((props) => ({
        id: props.id,
        props
    }))
}));

jest.mock('@deck.gl/core', () => ({}));

// Mock the extension modules
jest.mock('../../components/map/AnimatedArrowPathExtension', () => {
    return jest.fn().mockImplementation(() => ({
        constructor: { name: 'AnimatedArrowPathExtension' }
    }));
});

jest.mock('../../components/map/CircleSpinnerExtension', () => {
    return jest.fn().mockImplementation(() => ({
        constructor: { name: 'CircleSpinnerExtension' }
    }));
});

import {
    deckLayerMappings,
    createDeckLayersFromMappings,
    calculateNodeRadiusForZoom,
    LayerData
} from '../deckLayers.config';

describe('Deck.gl layer configurations', () => {
    describe('deckLayerMappings', () => {
        const expectedLayerNames = [
            'transitPathsSelected',
            'transitNodesSelected',
            'routingPaths',
            'routingPathsAlternate'
        ];

        test.each(expectedLayerNames)('should contain mapping for %s', (layerName) => {
            expect(Object.keys(deckLayerMappings)).toContain(layerName);
        });

        // [key, expectedType, expectedDeckLayerId, expectedBeforeId]
        const mappingConfigs: [string, string, string, string | undefined][] = [
            ['transitPathsSelected', 'animatedPath', 'selected-paths-animated', 'transitNodes'],
            ['transitNodesSelected', 'animatedNodes', 'selected-nodes-spinner', undefined],
            ['routingPaths', 'animatedPath', 'routing-paths-animated', 'routingPoints'],
            ['routingPathsAlternate', 'animatedPath', 'routing-paths-alternate-animated', 'routingPoints']
        ];

        test.each(mappingConfigs)(
            '%s mapping should be defined',
            (key) => {
                expect(deckLayerMappings[key]).toBeDefined();
            }
        );

        test.each(mappingConfigs)(
            '%s mapping should have correct type',
            (key, expectedType) => {
                expect(deckLayerMappings[key].type).toBe(expectedType);
            }
        );

        test.each(mappingConfigs)(
            '%s mapping should have correct deckLayerId',
            (key, _expectedType, expectedDeckLayerId) => {
                expect(deckLayerMappings[key].deckLayerId).toBe(expectedDeckLayerId);
            }
        );

        test.each(mappingConfigs)(
            '%s mapping should have correct beforeId',
            (key, _expectedType, _expectedDeckLayerId, expectedBeforeId) => {
                expect(deckLayerMappings[key].beforeId).toBe(expectedBeforeId);
            }
        );
    });

    describe('createDeckLayersFromMappings', () => {
        const mockPathData: LayerData = {
            source: {
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { color: '#ff0000' },
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [-73.5, 45.5],
                                    [-73.6, 45.6]
                                ]
                            }
                        }
                    ]
                }
            }
        };

        const mockPointData: LayerData = {
            source: {
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { color: '#00ff00' },
                            geometry: {
                                type: 'Point',
                                coordinates: [-73.5, 45.5]
                            }
                        }
                    ]
                }
            }
        };

        const emptyLayerData: LayerData = {
            source: {
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            }
        };

        test('should return empty array when no layers are enabled', () => {
            const layers = createDeckLayersFromMappings([], () => mockPathData, 15);
            expect(layers).toHaveLength(0);
        });

        test('should create animatedPath layer when transitPathsSelected is enabled', () => {
            const getLayerData = jest.fn().mockReturnValue(mockPathData);
            const layers = createDeckLayersFromMappings(['transitPathsSelected'], getLayerData, 15);

            expect(layers).toHaveLength(1);
            expect(layers[0].id).toBe('selected-paths-animated');
            expect(getLayerData).toHaveBeenCalledWith('transitPathsSelected');
        });

        test('should create animatedNodes layer when transitNodesSelected is enabled', () => {
            const getLayerData = jest.fn().mockReturnValue(mockPointData);
            const layers = createDeckLayersFromMappings(['transitNodesSelected'], getLayerData, 15);

            expect(layers).toHaveLength(1);
            expect(layers[0].id).toBe('selected-nodes-spinner');
        });

        test('should not create layer when layer has no data', () => {
            const getLayerData = jest.fn().mockReturnValue(emptyLayerData);
            const layers = createDeckLayersFromMappings(['transitPathsSelected'], getLayerData, 15);

            expect(layers).toHaveLength(0);
        });

        test('should not create layer when layer data is undefined', () => {
            const getLayerData = jest.fn().mockReturnValue(undefined);
            const layers = createDeckLayersFromMappings(['transitPathsSelected'], getLayerData, 15);

            expect(layers).toHaveLength(0);
        });

        test('should create routingPathsAlternate when enabled (comparison mode)', () => {
            const getLayerData = jest.fn().mockReturnValue(mockPathData);

            // In comparison mode, both are enabled
            const layers = createDeckLayersFromMappings(
                ['routingPaths', 'routingPathsAlternate'],
                getLayerData,
                15
            );

            const ids = layers.map((l) => l.id);
            expect(ids).toContain('routing-paths-animated');
            expect(ids).toContain('routing-paths-alternate-animated');
            expect(layers).toHaveLength(2);
        });

        test('should create multiple layers when multiple are enabled', () => {
            const getLayerData = jest.fn((name) => {
                if (name === 'transitNodesSelected') return mockPointData;
                return mockPathData;
            });

            const layers = createDeckLayersFromMappings(
                ['transitPathsSelected', 'transitNodesSelected'],
                getLayerData,
                15
            );

            expect(layers).toHaveLength(2);
            const ids = layers.map((l) => l.id);
            expect(ids).toContain('selected-paths-animated');
            expect(ids).toContain('selected-nodes-spinner');
        });
    });

    describe('calculateNodeRadiusForZoom', () => {
        test('should return small radius at zoom 0', () => {
            const radius = calculateNodeRadiusForZoom(0);
            expect(radius).toBe(2);
        });

        test('should return expected radius at zoom 10 (boundary)', () => {
            const radius = calculateNodeRadiusForZoom(10);
            expect(radius).toBe(4);
        });

        test('should return expected radius at zoom 15 (boundary)', () => {
            const radius = calculateNodeRadiusForZoom(15);
            expect(radius).toBe(10);
        });

        test('should return expected radius at zoom 20 (boundary)', () => {
            const radius = calculateNodeRadiusForZoom(20);
            expect(radius).toBe(18);
        });

        test('should use linear interpolation beyond zoom 20', () => {
            const radiusAt21 = calculateNodeRadiusForZoom(21);
            const radiusAt22 = calculateNodeRadiusForZoom(22);
            const radiusAt23 = calculateNodeRadiusForZoom(23);

            expect(radiusAt21).toBe(14);
            expect(radiusAt22).toBe(16);
            expect(radiusAt23).toBe(18);
            expect(radiusAt22 - radiusAt21).toBe(2);
            expect(radiusAt23 - radiusAt22).toBe(2);
        });

        test('should increase monotonically within each zoom range', () => {
            const lowZooms = [0, 3, 6, 9, 10];
            const lowRadii = lowZooms.map(calculateNodeRadiusForZoom);
            for (let i = 1; i < lowRadii.length; i++) {
                expect(lowRadii[i]).toBeGreaterThanOrEqual(lowRadii[i - 1]);
            }

            const midZooms = [10, 12, 14, 15];
            const midRadii = midZooms.map(calculateNodeRadiusForZoom);
            for (let i = 1; i < midRadii.length; i++) {
                expect(midRadii[i]).toBeGreaterThanOrEqual(midRadii[i - 1]);
            }

            const highZooms = [15, 17, 19, 20];
            const highRadii = highZooms.map(calculateNodeRadiusForZoom);
            for (let i = 1; i < highRadii.length; i++) {
                expect(highRadii[i]).toBeGreaterThanOrEqual(highRadii[i - 1]);
            }

            const extraZooms = [21, 22, 23, 24];
            const extraRadii = extraZooms.map(calculateNodeRadiusForZoom);
            for (let i = 1; i < extraRadii.length; i++) {
                expect(extraRadii[i]).toBeGreaterThan(extraRadii[i - 1]);
            }
        });

        test('should return positive values for all zoom levels', () => {
            for (let zoom = 0; zoom <= 25; zoom++) {
                expect(calculateNodeRadiusForZoom(zoom)).toBeGreaterThan(0);
            }
        });
    });

});
