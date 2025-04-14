/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

export type MapUpdateLayerEventType = {
    name: 'map.updateLayer';
    arguments: {
        layerName: string;
        data: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection);
    };
};

export type MapFilterLayerEventType = {
    name: 'map.layers.updateFilter';
    arguments: {
        layerName: string;
        filter: ((feature: GeoJSON.Feature) => 0 | 1) | undefined;
    };
};
