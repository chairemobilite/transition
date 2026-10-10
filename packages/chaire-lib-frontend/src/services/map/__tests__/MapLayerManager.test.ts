/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// maplibre-gl is ESM only and cannot be loaded by Jest
jest.mock('maplibre-gl', () => ({}), { virtual: true });
jest.mock('chaire-lib-common/lib/utils/ServiceLocator', () => ({ eventManager: { emit: jest.fn() } }));

import type { Map as MapLibreMap } from 'maplibre-gl';
import MapLayerManager from '../MapLayerManager';

/** Minimal map keeping the layer order, enough for the layer manager */
const createMap = () => {
    const layers: string[] = [];
    const sources = new Set<string>();
    const map = {
        getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
        addLayer: (layer: { id: string }) => layers.push(layer.id),
        removeLayer: (id: string) => layers.splice(layers.indexOf(id), 1),
        getSource: (id: string) => (sources.has(id) ? { setData: jest.fn() } : undefined),
        addSource: (id: string) => sources.add(id),
        removeSource: (id: string) => sources.delete(id),
        setFilter: jest.fn()
    };
    return { map: map as unknown as MapLibreMap, layers };
};

const createCustomLayer = (id: string) => ({
    id,
    type: 'custom' as const,
    render: jest.fn(),
    setData: jest.fn(),
    setAnimationEnabled: jest.fn()
});

const createManager = () => {
    const customLayer = createCustomLayer('pathsArrows');
    const { map, layers } = createMap();
    const manager = new MapLayerManager(
        {
            paths: { type: 'line', customLayer: () => customLayer },
            points: { type: 'circle' }
        },
        map
    );
    return { manager, customLayer, layers };
};

const features: GeoJSON.Feature[] = [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} }
];

describe('MapLayerManager custom layers', () => {
    test.each([
        { enabledLayersSequence: [['paths']], expected: ['paths', 'pathsArrows'] },
        { enabledLayersSequence: [['paths', 'points']], expected: ['paths', 'pathsArrows', 'points'] },
        { enabledLayersSequence: [['points', 'paths']], expected: ['points', 'paths', 'pathsArrows'] },
        { enabledLayersSequence: [['paths', 'points'], ['points']], expected: ['points'] },
        { enabledLayersSequence: [['points'], ['paths', 'points']], expected: ['paths', 'pathsArrows', 'points'] }
    ])('Enabled layers $enabledLayersSequence: map layers $expected', ({ enabledLayersSequence, expected }) => {
        const { manager, layers } = createManager();
        enabledLayersSequence.forEach((enabledLayers) => manager.updateEnabledLayers(enabledLayers));
        expect(layers).toEqual(expected);
    });

    test.each([
        { method: 'updateLayer', update: (manager: MapLayerManager) => manager.updateLayer('paths', { type: 'FeatureCollection', features }) },
        { method: 'updateLayers', update: (manager: MapLayerManager) => manager.updateLayers({ paths: { type: 'FeatureCollection', features } }) }
    ])('$method gives the features to the custom layer', ({ update }) => {
        const { manager, customLayer } = createManager();
        update(manager);
        expect(customLayer.setData).toHaveBeenCalledWith(features);
    });

    test.each([true, false])('setAnimationEnabled(%s) is forwarded to the custom layer', (enabled) => {
        const { manager, customLayer } = createManager();
        manager.setAnimationEnabled(enabled);
        expect(customLayer.setAnimationEnabled).toHaveBeenCalledWith(enabled);
    });
});
