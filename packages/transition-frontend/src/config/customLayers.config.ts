/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { CustomLayerControlProps } from '../components/map/customLayers/CustomLayerControl';
import AnimatedArrowPathLayer from '../components/map/customLayers/AnimatedArrowPathLayer';
import CircleSpinnerLayer from '../components/map/customLayers/CircleSpinnerLayer';

/** How to draw the features of a MapLibre layer with a custom layer */
export type CustomLayerConfig = Pick<CustomLayerControlProps, 'createLayer' | 'beforeId'>;

/**
 * Custom layers drawing the features of MapLibre layers with WebGL shaders. The key is the
 * MapLibre layer providing the data. That layer stays on the map, nearly transparent, to receive
 * the mouse events.
 * Layers are placed in this order when the enabled layers change, so the last ones end up on top
 * when their `beforeId` is not on the map.
 */
export const customLayerMappings: Record<string, CustomLayerConfig> = {
    transitPathsSelected: {
        createLayer: (disableAnimation) =>
            new AnimatedArrowPathLayer({ id: 'selected-paths-arrows', disableAnimation }),
        beforeId: 'transitNodes'
    },
    routingPaths: {
        createLayer: (disableAnimation) => new AnimatedArrowPathLayer({ id: 'routing-paths-arrows', disableAnimation }),
        // The line is drawn under the points
        beforeId: 'routingPoints'
    },
    routingPathsAlternate: {
        createLayer: (disableAnimation) =>
            new AnimatedArrowPathLayer({
                id: 'routing-paths-alternate-arrows',
                // Purple halo, to tell the alternate path from the main one in comparisons
                halo: { color: [1, 0, 1, 0.7], widthPx: 2 },
                disableAnimation
            }),
        beforeId: 'routingPoints'
    },
    transitNodesSelected: {
        // No beforeId: drawn on top of all layers, including waypoints
        createLayer: (disableAnimation) => new CircleSpinnerLayer({ id: 'selected-nodes-spinner', disableAnimation })
    }
};
