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
export type DeckLayerType = 'animatedPath' | 'animatedNodes';

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
    return (feature as Feature<LineString>).geometry.coordinates as Position[];
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
    return (feature as Feature<Point>).geometry.coordinates as Position;
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
        beforeId: 'routingPoints',
        layerConfig: {
            getWidth: 8,
            widthMinPixels: 3,
            widthMaxPixels: 10
        }
    },
    routingPathsAlternate: {
        type: 'animatedPath',
        deckLayerId: 'routing-paths-alternate-animated',
        beforeId: 'routingPoints',
        layerConfig: {
            getWidth: 8,
            widthMinPixels: 3,
            widthMaxPixels: 10
        }
    }
};

// ============================================================================
// Helper Functions
// ============================================================================

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
        }
    }

    return layers;
}
