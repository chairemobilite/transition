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
