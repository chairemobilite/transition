/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Possible values for the _currentDraggingFeature property.
 * Tracks which type of feature is currently being dragged on the map.
 */
export type DraggingFeatureType =
    | 'waypoint'
    | 'node'
    | 'routingOrigin'
    | 'routingDestination'
    | 'accessibilityMapLocation'
    | 'accessibilityMapLocation2'
    | null;

/**
 * Extended MapLibre Map type with custom state properties used throughout the application.
 * These properties track drag state, hover state, and other UI interactions that require
 * storing state directly on the map object for cross-handler communication.
 */
export type MapWithCustomEventsState = MapLibreMap & {
    /** Tracks the order of drag-related events to prevent false clicks during map panning. */
    _draggingEventsOrder?: string[];
    /** Identifies the type of feature currently being dragged. */
    _currentDraggingFeature?: DraggingFeatureType;
    /** The MapLibre internal integer ID of the currently hovered path. */
    _hoverPathIntegerId?: string | number | null;
    /** The application ID (UUID) of the currently hovered path. */
    _hoverPathId?: string | null;
    /** The source name of the currently hovered path layer. */
    _hoverPathSource?: string | null;
    /** The MapLibre internal integer ID of the currently hovered node. */
    _hoverNodeIntegerId?: string | number | null;
    /** The application ID (UUID) of the currently hovered node. */
    _hoverNodeId?: string | null;
    /** The source name of the currently hovered node layer. */
    _hoverNodeSource?: string | null;
};
