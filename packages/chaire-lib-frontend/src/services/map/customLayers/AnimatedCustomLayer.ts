/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { CustomLayerInterface } from 'maplibre-gl';
import type { Feature } from 'geojson';

/**
 * MapLibre custom layer drawing GeoJSON features with WebGL shaders, with an optional animation.
 * See https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
 */
export interface AnimatedCustomLayer extends CustomLayerInterface {
    /**
     * Replace the features to draw.
     * @param features GeoJSON features, with an optional `color` property
     */
    setData(features: Feature[]): void;
    /**
     * Start or stop the animation.
     * @param enabled Whether the layer is animated
     */
    setAnimationEnabled(enabled: boolean): void;
}
