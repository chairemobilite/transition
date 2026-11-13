/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// With no segment to draw, `render` returns after building the instances, before any WebGL call
jest.mock('../pathGeometry', () => ({
    buildPathInstances: jest.fn().mockReturnValue({
        origin: [0, 0],
        segments: new Float32Array(0),
        colors: new Uint8Array(0),
        count: 0
    })
}));

import type { Feature } from 'geojson';
import type { CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import AnimatedArrowPathLayer from '../AnimatedArrowPathLayer';
import { buildPathInstances } from '../pathGeometry';

const features: Feature[] = [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} }
];

describe('AnimatedArrowPathLayer simplification tolerance', () => {
    // `buildPathInstances` receives the tolerance in pixels at zoom 0
    test.each([
        {
            description: 'default tolerance, the one of MapLibre',
            tolerance: undefined,
            zoom: 12,
            expectedZoom0Tolerance: 0.375 / Math.pow(2, 12)
        },
        {
            description: 'custom tolerance',
            tolerance: 1.5,
            zoom: 12,
            expectedZoom0Tolerance: 1.5 / Math.pow(2, 12)
        },
        {
            description: 'tolerance of 0, no simplification',
            tolerance: 0,
            zoom: 12,
            expectedZoom0Tolerance: 0
        },
        {
            description: 'fractional zoom, tolerance of the integer zoom below',
            tolerance: 1.5,
            zoom: 12.9,
            expectedZoom0Tolerance: 1.5 / Math.pow(2, 12)
        }
    ])('$description', ({ tolerance, zoom, expectedZoom0Tolerance }) => {
        const layer = new AnimatedArrowPathLayer({ id: 'paths', tolerance });
        layer.setData(features);
        layer.onAdd({ getZoom: () => zoom } as unknown as MapLibreMap);

        layer.render({} as WebGL2RenderingContext, {} as CustomRenderMethodInput);

        expect(buildPathInstances).toHaveBeenLastCalledWith(features, expectedZoom0Tolerance);
    });
});
