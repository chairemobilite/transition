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
    opacity?: FeatureNumber;
    /**
     * Minimal zoom level at which a feature should be displayed
     */
    minZoom?: FeatureNumber;
    /**
     * Maximum zoom level at which a feature should be displayed
     */
    maxZoom?: FeatureNumber;
    autoHighlight?: boolean;
    featureMinZoom?: FeatureNumber;
    /**
     * Whether this layer can be filtered by additional filters.
     * @default false
     */
    canFilter?: boolean;
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
};

export const layerIsCircle = (layer: LayerConfiguration): layer is PointLayerConfiguration => {
    return layer.type === 'circle';
};

export type BaseLineLayerConfiguration = CommonLayerConfiguration & {
    /**
     * The line's width and scale
     */
    width?: FeatureNumber;
    widthScale?: FeatureNumber;
    widthMinPixels?: FeatureNumber;
    widthMaxPixels?: FeatureNumber;
    /**
     * Whether the end of the lines should be rounded
     */
    capRounded?: boolean;
    /**
     * Whether the line joints should be rounded
     */
    jointRounded?: boolean;
};

export type LineLayerConfiguration = BaseLineLayerConfiguration & {
    type: 'line';
};

export const layerIsLine = (layer: LayerConfiguration): layer is LineLayerConfiguration => {
    return layer.type === 'line';
};

export type AnimatedPathLayerConfiguration = BaseLineLayerConfiguration & {
    type: 'animatedArrowPath';
};

export const layerIsAnimatedPath = (layer: LayerConfiguration): layer is AnimatedPathLayerConfiguration => {
    return layer.type === 'animatedArrowPath';
};

export type PolygonLayerConfiguration = CommonLayerConfiguration & {
    type: 'fill';
    /**
     * fill and contour's color
     */
    color?: FeatureColor;
    lineColor?: FeatureColor;
    lineWidth?: FeatureNumber;
    lineWidthMinPixels?: FeatureNumber;
};

export const layerIsPolygon = (layer: LayerConfiguration): layer is PolygonLayerConfiguration => {
    return layer.type === 'fill';
};

export type LayerConfiguration =
    | PointLayerConfiguration
    | LineLayerConfiguration
    | AnimatedPathLayerConfiguration
    | PolygonLayerConfiguration;

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
