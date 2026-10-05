/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useRef, useEffect } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';
import { MapboxOverlay as DeckOverlay } from '@deck.gl/mapbox';
import type { LayersList } from '@deck.gl/core';

export interface DeckGLControlProps {
    layers: LayersList;
    /**
     * When false, MapLibre is not forced to repaint. The shaders keep the last frame,
     * which is how `map.enableAnimation` set to false freezes arrows and node spinners.
     */
    animate?: boolean;
}

/**
 * DeckGL Overlay Control Component for Animated Selected Paths and Nodes (custom shaders).
 * This component integrates deck.gl layers with MapLibre GL using the MapboxOverlay.
 *
 * This component should only be rendered when there are active deck.gl layers that need
 * animation. When unmounted, the overlay is removed and GPU resources are freed.
 *
 * Animation is driven by MapLibre's repaint mode (map.repaint = true) which triggers
 * continuous redraws. The shader extensions use performance.now() internally for
 * time-based animation, so no separate RAF loop is needed.
 */
const DeckGLControl: React.FC<DeckGLControlProps> = ({ layers, animate = true }) => {
    const overlayRef = useRef<DeckOverlay | null>(null);

    // Get the map instance to control repaint mode
    const { current: mapRef } = useMap();

    useControl(
        () => {
            overlayRef.current = new DeckOverlay({
                interleaved: true,
                useDevicePixels: true,
                layers,
                // Inherit cursor from parent - CSS classes handle cursor changes
                // See: https://github.com/visgl/deck.gl/discussions/5893
                getCursor: () => 'inherit'
            });
            return overlayRef.current;
        },
        // Cleanup function when control is removed
        () => {
            if (overlayRef.current) {
                // Clear all layers first to release GPU resources
                overlayRef.current.setProps({ layers: [] });
                overlayRef.current.finalize();
                overlayRef.current = null;
            }
        }
    );

    // Continuous repaint keeps the shaders moving. It stays off when animations are disabled.
    // The shader extensions read performance.now() in their draw() methods.
    useEffect(() => {
        const map = mapRef?.getMap();
        if (map) {
            map.repaint = animate;
        }

        return () => {
            const mapInstance = mapRef?.getMap();
            if (mapInstance) {
                mapInstance.repaint = false;
            }
        };
    }, [mapRef, animate]);

    // Update layers when they change
    useEffect(() => {
        if (overlayRef.current) {
            overlayRef.current.setProps({ layers });
        }
    }, [layers]);

    return null;
};

export default DeckGLControl;
