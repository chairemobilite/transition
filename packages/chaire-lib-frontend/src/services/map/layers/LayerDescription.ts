/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * A type to describe how to get the value of some configuration. `property` is
 * the name of the property in a geojson feature
 */
export type ConfigurationGetter = { type: 'property'; property: string };
/**
 * A color for map features, either a string starting with `#` with hexadecimal
 * colors, or an array of rgb or rgba numbers
 */
export type FeatureColor =
    | string
    | [number, number, number]
    | [number, number, number, number]
    | ConfigurationGetter
    | ((feature: GeoJSON.Feature) => string | [number, number, number] | [number, number, number, number]);
export type FeatureNumber = number | ConfigurationGetter | ((feature: GeoJSON.Feature) => number);

export type CommonLayerConfiguration = {
    /**
     * Color of the feature
     */
    color?: FeatureColor;
    pickable?: boolean | (() => boolean);
};

export type PointLayerConfiguration = CommonLayerConfiguration & {
    type: 'circle';
    /**
     * Radius of the feature
     */
    radius?: FeatureNumber;
    radiusScale?: FeatureNumber;
    /**
     * Color of the contour of the feature
     */
    strokeColor?: FeatureColor;
    /**
     * Width of the contour of the feature
     */
    strokeWidth?: FeatureNumber;
    strokeWidthScale?: FeatureNumber;
    minRadiusPixels?: FeatureNumber;
    maxRadiusPixels?: FeatureNumber;
    /**
     * Minimal zoom level at which a feature should be displayed
     */
    minZoom?: FeatureNumber;
    /**
     * Maximum zoom level at which a feature should be displayed
     */
    maxZoom?: FeatureNumber;
};
export const layerIsCircle = (layer: LayerConfiguration): layer is PointLayerConfiguration => {
    return layer.type === 'circle';
};

export type LayerConfiguration =
    | PointLayerConfiguration
    | {
          // TODO Type this properly. When the data in layers.config.ts is used by the new API, add it here
          [key: string]: any;
      };

export type MapLayer = {
    /** Unique identifier for this layer */
    id: string;
    /**
     * Whether the layer is visible. The layer visibility is typically defined
     * by the user. It does not mean it is always visible. It is only visible
     * when it is enabled by the application.
     */
    visible: boolean;
    /**
     * Configuration of the current layer. It should be fixed and not require
     * updates, except through Preferences if any
     */
    configuration: LayerConfiguration;
    /** Features contained in this layer */
    layerData: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
};
