/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import MapLibreMap, { MapRef, ScaleControl, SourceSpecification, LayerSpecification } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LayersList } from '@deck.gl/core';
import { useTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';

import DeckGLControl from './DeckGLControl';

/** MapLibre style specification with sources and layers */
export interface MapStyleSpec {
    version: 8;
    sources: Record<string, SourceSpecification>;
    layers: LayerSpecification[];
}

export interface MapRendererProps {
    mapRef: React.RefObject<MapRef | null>;
    defaultCenter: [number, number];
    defaultZoom: number;
    mapLoaded: boolean;
    getMapStyle: (showAerial?: boolean) => MapStyleSpec;
    getDeckLayers: () => LayersList;
    setupMapEvents: () => void;
    setMap: () => void;
    confirmModalDeleteIsOpen: boolean;
    showAerialTiles: boolean;
    handleZoomChange: (zoom: number) => void;
    children: React.ReactNode;
    onDeleteSelectedNodes: () => void;
    closeModal: () => void;
}

/**
 * Functional component wrapper for MapLibreMap to handle hooks.
 * This component manages the map view state, deck.gl layers, and renders
 * the MapLibre map with all necessary controls and overlays.
 */
const MapRenderer: React.FC<MapRendererProps> = ({
    mapRef,
    defaultCenter,
    defaultZoom,
    mapLoaded,
    getMapStyle,
    getDeckLayers,
    setupMapEvents,
    setMap,
    confirmModalDeleteIsOpen,
    showAerialTiles,
    handleZoomChange,
    onDeleteSelectedNodes,
    closeModal,
    children
}) => {
    const { t } = useTranslation();

    const [viewState, setViewState] = useState({
        longitude: defaultCenter[0],
        latitude: defaultCenter[1],
        zoom: defaultZoom
    });

    // View state is updated synchronously so the controlled MapLibreMap
    // stays responsive during pan/zoom. Only the parent notification
    // (handleZoomChange) is throttled via RAF to avoid cascading re-renders.
    const zoomRafRef = useRef<number | null>(null);
    const lastNotifiedZoomRef = useRef(defaultZoom);

    useEffect(() => {
        return () => {
            if (zoomRafRef.current !== null) {
                cancelAnimationFrame(zoomRafRef.current);
            }
        };
    }, []);

    // Notify parent of zoom changes, throttled to one call per animation frame
    useEffect(() => {
        if (viewState.zoom === lastNotifiedZoomRef.current) return;

        if (zoomRafRef.current !== null) {
            cancelAnimationFrame(zoomRafRef.current);
        }
        zoomRafRef.current = requestAnimationFrame(() => {
            zoomRafRef.current = null;
            lastNotifiedZoomRef.current = viewState.zoom;
            handleZoomChange(viewState.zoom);
        });
    }, [viewState.zoom, handleZoomChange]);

    // Track zoom level and layer updates for deck.gl layer updates
    const [deckLayers, setDeckLayers] = useState<LayersList>([]);

    // Listen for map layer updates from the event manager and update deck layers
    useEffect(() => {
        const updateDeckLayers = () => {
            if (!mapLoaded) {
                setDeckLayers([]);
                return;
            }
            // Immediately update deck layers
            const layers = getDeckLayers();
            setDeckLayers(layers);
        };

        // Update on initial load
        updateDeckLayers();

        // Subscribe to map layer update events
        // Note: MapLayerManager emits 'map.updatedLayer' and 'map.updatedLayers' AFTER data is updated
        const eventManager = serviceLocator.eventManager;
        eventManager.on('map.updateLayers', updateDeckLayers);
        eventManager.on('map.updatedLayers', updateDeckLayers); // After layer manager completes update
        eventManager.on('map.updateLayer', updateDeckLayers);
        eventManager.on('map.updatedLayer', updateDeckLayers); // After layer manager completes update
        eventManager.on('map.updatedEnabledLayers', updateDeckLayers); // Update when section changes
        eventManager.on('selected.drag.node', updateDeckLayers); // Update during node drag

        return () => {
            eventManager.off('map.updateLayers', updateDeckLayers);
            eventManager.off('map.updatedLayers', updateDeckLayers);
            eventManager.off('map.updateLayer', updateDeckLayers);
            eventManager.off('map.updatedLayer', updateDeckLayers);
            eventManager.off('map.updatedEnabledLayers', updateDeckLayers);
            eventManager.off('selected.drag.node', updateDeckLayers);
        };
    }, [mapLoaded, getDeckLayers]);

    // Determine if animation should run - only when there are active deck.gl layers
    const shouldAnimate = useMemo(() => deckLayers.length > 0, [deckLayers]);

    // Capture the initial aerial state on first render
    const initialShowAerialRef = useRef(showAerialTiles);

    // Compute map style exactly once on mount to prevent style reloading which wipes runtime layers.
    // Empty dependency array is intentional:
    // - getMapStyle is recreated on every parent render (not wrapped in useCallback)
    // - We only want the initial style; subsequent aerial toggling is handled imperatively below
    const mapStyle = useMemo(() => getMapStyle(initialShowAerialRef.current), []);

    // Handle layer switching imperatively to preserve runtime layers
    // Toggle both OSM and aerial visibility to prevent loading both tile sets simultaneously
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (map && mapLoaded) {
            const hasAerial = map.getLayer('aerial');
            if (hasAerial) {
                // When aerial is available, toggle both layers inversely
                map.setLayoutProperty('aerial', 'visibility', showAerialTiles ? 'visible' : 'none');
                map.setLayoutProperty('osm', 'visibility', showAerialTiles ? 'none' : 'visible');
            }
            // If no aerial layer, OSM stays visible (default)
        }
    }, [showAerialTiles, mapLoaded, mapRef]);

    return (
        <section id="tr__main-map">
            <div id="tr__main-map-context-menu" className="tr__main-map-context-menu"></div>
            {children}
            <MapLibreMap
                ref={mapRef}
                {...viewState}
                onMove={(evt) => setViewState(evt.viewState)}
                onLoad={() => {
                    setMap();
                    setupMapEvents();
                }}
                style={{ width: '100%', height: '100%' }}
                maxZoom={20}
                mapStyle={mapStyle}
                hash={true}
            >
                {/* DeckGL overlay for animated selected paths and nodes - only render when there are layers */}
                {shouldAnimate && <DeckGLControl layers={deckLayers} />}
                <ScaleControl position="bottom-right" />
            </MapLibreMap>
            {confirmModalDeleteIsOpen && (
                <ConfirmModal
                    title={t('transit:transitNode:ConfirmMultipleDelete')}
                    confirmAction={onDeleteSelectedNodes}
                    isOpen={true}
                    confirmButtonColor="red"
                    confirmButtonLabel={t('transit:transitNode:MultipleDelete')}
                    closeModal={closeModal}
                />
            )}
        </section>
    );
};

export default MapRenderer;
