/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Position, Layer } from '@deck.gl/core';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { hexToRgbArray } from 'chaire-lib-common/lib/utils/ColorUtils';
import AnimatedArrowPathExtension from '../components/map/AnimatedArrowPathExtension';
import CircleSpinnerExtension from '../components/map/CircleSpinnerExtension';

// ============================================================================
// Types
// ============================================================================

/** Type of deck.gl layer to create */
export type DeckLayerType = 'animatedPath' | 'animatedNodes' | 'points';

/** Configuration for a deck.gl overlay layer */
export interface DeckLayerConfig {
    /** The type of deck.gl layer to create */
    type: DeckLayerType;
    /** The deck.gl layer ID */
    deckLayerId: string;
    /**
     * The MapLibre layer ID to render this deck.gl layer before (for z-ordering).
     * "Before" means this layer will be drawn BELOW the specified layer visually
     * (earlier in the render order = underneath).
     * If not specified or the target layer doesn't exist, renders on top of all layers.
     */
    beforeId?: string;
    /** Layer-specific configuration (width, radius, etc.) */
    layerConfig: Record<string, unknown>;
}

/** Record mapping MapLibre layer names to their deck.gl overlay configurations */
export type DeckLayerMappings = Record<string, DeckLayerConfig>;

/** Interface for layer data from MapLayerManager */
export interface LayerData {
    source: {
        data?: FeatureCollection;
    };
}

// ============================================================================
// Shared Accessors with Runtime Type Guards
// ============================================================================

/** Default fallback values for invalid geometry */
const DEFAULT_PATH: Position[] = [];
const DEFAULT_POSITION: Position = [0, 0];

/**
 * deck.gl Position is a 2- or 3-number tuple. GeoJSON positions are open arrays.
 * @param coordinate A GeoJSON position, [lng, lat] or [lng, lat, elevation]
 */
const toDeckPosition = (coordinate: number[]): Position => {
    const [lng, lat, elevation] = coordinate;
    return elevation === undefined ? [lng, lat] : [lng, lat, elevation];
};
/** Default gray color as hex string for hexToRgbArray fallback */
const DEFAULT_COLOR_HEX = '#808080';
const DEFAULT_COLOR: [number, number, number, number] = [128, 128, 128, 255];

/**
 * Extract path coordinates from a LineString feature.
 * Returns empty array if geometry is invalid or not a LineString.
 */
const getPathFromFeature = (feature: Feature): Position[] => {
    if (!feature?.geometry || feature.geometry.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
        console.warn('getPathFromFeature: Expected LineString geometry, got:', feature?.geometry?.type);
        return DEFAULT_PATH;
    }
    return (feature as Feature<LineString>).geometry.coordinates.map(toDeckPosition);
};

/**
 * Extract color from feature properties.
 * Returns default gray color if color property is missing or invalid.
 */
const getColorFromFeature = (feature: Feature): [number, number, number, number] => {
    if (!feature?.properties?.color) {
        return DEFAULT_COLOR;
    }
    // Pass DEFAULT_COLOR_HEX as fallback so invalid color strings use gray, not hexToRgbArray's internal blue
    return hexToRgbArray(feature.properties.color, DEFAULT_COLOR_HEX);
};

/**
 * Extract position coordinates from a Point feature.
 * Returns [0, 0] if geometry is invalid or not a Point.
 */
const getPositionFromFeature = (feature: Feature): Position => {
    if (!feature?.geometry || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
        console.warn('getPositionFromFeature: Expected Point geometry, got:', feature?.geometry?.type);
        return DEFAULT_POSITION;
    }
    return toDeckPosition((feature as Feature<Point>).geometry.coordinates);
};

// ============================================================================
// Base Configurations
// ============================================================================

const baseAnimatedPathConfig = {
    antialias: true,
    highPrecision: true,
    capRounded: true,
    jointRounded: true,
    pickable: false,
    widthUnits: 'pixels' as const
};

const baseAnimatedNodesConfig = {
    radiusUnits: 'pixels' as const,
    radiusMinPixels: 2,
    radiusMaxPixels: 50,
    stroked: false,
    pickable: false
};

// ============================================================================
// Deck.gl Layer Mappings Configuration
// ============================================================================

/**
 * Configuration mapping MapLibre layers to deck.gl overlays.
 * Add or remove entries here to control which layers get deck.gl rendering.
 * The key is the MapLibre layer name that provides data for the deck.gl layer.
 */
export const deckLayerMappings: DeckLayerMappings = {
    transitPathsSelected: {
        type: 'animatedPath',
        deckLayerId: 'selected-paths-animated',
        beforeId: 'transitNodes',
        layerConfig: {
            getWidth: 12,
            widthMinPixels: 4,
            widthMaxPixels: 12
        }
    },
    transitNodesSelected: {
        type: 'animatedNodes',
        deckLayerId: 'selected-nodes-spinner',
        // No beforeId = renders on top of all MapLibre layers (including waypoints)
        layerConfig: {}
    },
    routingPaths: {
        type: 'animatedPath',
        deckLayerId: 'routing-paths-animated',
        // Same placement as transitPathsSelected: the line is drawn under the points.
        beforeId: 'routingPoints',
        layerConfig: {
            getWidth: 12,
            widthMinPixels: 4,
            widthMaxPixels: 12
        }
    },
    routingPathsAlternate: {
        type: 'animatedPath',
        deckLayerId: 'routing-paths-alternate-animated',
        beforeId: 'routingPoints',
        layerConfig: {
            getWidth: 12,
            widthMinPixels: 4,
            widthMaxPixels: 12
        }
    },
    routingPoints: {
        type: 'points',
        deckLayerId: 'routing-points',
        // No beforeId, like transitNodesSelected: this layer is drawn above the animated path.
        // The MapLibre circles of the same name stay underneath that path.
        layerConfig: {}
    }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Pixel radius for origin and destination markers.
 * Matches the routingPoints circle-radius stops: [5, 1], [10, 2], [15, 10].
 * @param zoom - Current map zoom
 * @returns Radius in pixels
 */
function routingPointRadiusForZoom(zoom: number): number {
    if (zoom <= 5) {
        return 1;
    }
    if (zoom <= 10) {
        return 1 + (zoom - 5) / 5;
    }
    if (zoom <= 15) {
        return 2 + (8 * (zoom - 10)) / 5;
    }
    return 10 + (zoom - 15) * 2;
}

/**
 * Calculate radius for selected nodes based on zoom level (exponential interpolation)
 */
export const calculateNodeRadiusForZoom = (zoom: number): number => {
    if (zoom <= 10) {
        return 0 + (2 - 0) * Math.pow(2, (zoom - 0) / (10 - 0));
    } else if (zoom <= 15) {
        return 2 + (6 - 2) * Math.pow(2, (zoom - 10) / (15 - 10));
    } else if (zoom <= 20) {
        return 6 + (12 - 6) * Math.pow(2, (zoom - 15) / (20 - 15));
    } else {
        return 12 + (zoom - 20) * 2;
    }
};

// ============================================================================
// Layer Factory Functions
// ============================================================================

/**
 * Create an animated PathLayer for line features
 * @param config - Layer configuration
 * @param data - GeoJSON features to render
 * @param beforeId - The validated beforeId (only passed if the target layer exists)
 */
function createAnimatedPathLayer(config: DeckLayerConfig, data: Feature[], beforeId?: string): PathLayer {
    return new PathLayer({
        ...baseAnimatedPathConfig,
        ...config.layerConfig,
        id: config.deckLayerId,
        ...(beforeId && { beforeId }),
        data,
        getPath: getPathFromFeature,
        getColor: getColorFromFeature,
        extensions: [new AnimatedArrowPathExtension()],
        updateTriggers: {
            getPath: [data],
            getColor: [data]
        }
    });
}

/**
 * Create an animated ScatterplotLayer for point features
 * @param config - Layer configuration
 * @param data - GeoJSON features to render
 * @param zoom - Current map zoom level
 * @param beforeId - The validated beforeId (only passed if the target layer exists)
 */
function createAnimatedNodesLayer(
    config: DeckLayerConfig,
    data: Feature[],
    zoom: number,
    beforeId?: string
): ScatterplotLayer {
    const radius = calculateNodeRadiusForZoom(zoom);

    return new ScatterplotLayer({
        ...baseAnimatedNodesConfig,
        ...config.layerConfig,
        id: config.deckLayerId,
        ...(beforeId && { beforeId }),
        data,
        getPosition: getPositionFromFeature,
        getRadius: radius,
        getFillColor: getColorFromFeature,
        extensions: [new CircleSpinnerExtension()],
        updateTriggers: {
            getPosition: [data],
            getFillColor: [data]
        }
    });
}

/**
 * Origin and destination dots, drawn above the animated route.
 * @param config - Layer configuration
 * @param data - GeoJSON point features
 * @param zoom - Current map zoom level
 */
function createPointLayer(config: DeckLayerConfig, data: Feature[], zoom: number): ScatterplotLayer {
    return new ScatterplotLayer({
        ...config.layerConfig,
        id: config.deckLayerId,
        data,
        radiusUnits: 'pixels',
        stroked: true,
        filled: true,
        pickable: false,
        getPosition: getPositionFromFeature,
        getRadius: routingPointRadiusForZoom(zoom),
        getFillColor: getColorFromFeature,
        getLineColor: [255, 255, 255, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        // Always paint these dots. The animated path is a 3D custom layer and covers
        // the MapLibre circles that use the same coordinates.
        parameters: {
            depthCompare: 'always',
            depthWriteEnabled: false
        },
        updateTriggers: {
            getPosition: [data],
            getFillColor: [data]
        }
    });
}

// ============================================================================
// Main Factory Function
// ============================================================================

/**
 * Create all deck.gl layers based on the mappings configuration.
 * This function iterates over enabledLayers and creates a deck.gl overlay
 * for each layer that has a mapping in deckLayerMappings.
 *
 * @param enabledLayers - Array of currently enabled MapLibre layer names
 * @param getLayerData - Function to get layer data from MapLayerManager
 * @param zoom - Current map zoom level (used for node radius calculation)
 * @returns Array of deck.gl Layer instances
 */
export function createDeckLayersFromMappings(
    enabledLayers: string[],
    getLayerData: (layerName: string) => LayerData | undefined,
    zoom: number
): Layer[] {
    const layers: Layer[] = [];

    for (const layerName of enabledLayers) {
        // Check if this enabled layer has a deck.gl mapping
        const config = deckLayerMappings[layerName];
        if (!config) {
            continue;
        }

        // Get the layer data
        const layerData = getLayerData(layerName);
        if (!layerData?.source?.data?.features?.length) {
            continue;
        }

        const features = layerData.source.data.features;

        // Only use beforeId if the target layer exists in enabled layers
        const validBeforeId = config.beforeId && enabledLayers.includes(config.beforeId) ? config.beforeId : undefined;

        // Create the deck.gl layer based on type
        switch (config.type) {
        case 'animatedPath':
            layers.push(createAnimatedPathLayer(config, features, validBeforeId));
            break;
        case 'animatedNodes':
            layers.push(createAnimatedNodesLayer(config, features, zoom, validBeforeId));
            break;
        case 'points':
            layers.push(createPointLayer(config, features, zoom));
            break;
        }
    }

    return layers;
}
