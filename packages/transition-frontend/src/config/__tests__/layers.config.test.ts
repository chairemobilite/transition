/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import layersConfig, { sectionLayers } from '../layers.config';

describe('Layers configuration', () => {
    test('Layer style configuration should be defined', () => {
        expect(layersConfig).toBeDefined();
        // Test a few key layers to ensure they have style properties
        expect(layersConfig.routingPoints).toBeDefined();
        // Check for at least one of these layers
        expect(
            layersConfig.transitNodes !== undefined ||
            layersConfig.transitPaths !== undefined
        ).toBeTruthy();
    });

    test('Section layers configuration should be defined', () => {
        expect(sectionLayers).toBeDefined();
        // Ensure all main sections have layer definitions
        expect(sectionLayers.agencies).toBeDefined();
        expect(sectionLayers.agencies.length).toBeGreaterThan(0);

        expect(sectionLayers.nodes).toBeDefined();
        expect(sectionLayers.nodes.length).toBeGreaterThan(0);

        expect(sectionLayers.accessibilityMap).toBeDefined();
        expect(sectionLayers.accessibilityMap.length).toBeGreaterThan(0);
    });

    test('Sections should include required layers for that section', () => {
        // Agencies section should include transit nodes and paths
        expect(sectionLayers.agencies).toEqual(
            expect.arrayContaining(['transitNodes', 'transitPaths'])
        );

        // Nodes section should include transit nodes
        expect(sectionLayers.nodes).toEqual(
            expect.arrayContaining(['transitNodes'])
        );

        // AccessibilityMap section should include accessibility map polygons
        expect(sectionLayers.accessibilityMap).toEqual(
            expect.arrayContaining(['accessibilityMapPolygons'])
        );
    });
});
