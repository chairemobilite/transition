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
import baseMapLayers, { type BaseMapLayerConfig } from '../../config/baseMapLayers.config';
import type { BaseLayerType } from 'chaire-lib-common/lib/config/types';

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
    getMapStyle: () => MapStyleSpec;
    getDeckLayers: () => LayersList;
    setupMapEvents: () => void;
    setMap: () => void;
    confirmModalDeleteIsOpen: boolean;
    activeBaseLayer: BaseLayerType;
    /** Overlay opacity as a percentage (0–100) */
    overlayOpacity: number;
    /** Overlay color: 'black' or 'white' */
    overlayColor: 'black' | 'white';
    /** Aerial tile server URL (undefined if no aerial tiles configured) */
    aerialTilesUrl: string | undefined;
    /** Minimum zoom for aerial tiles */
    aerialMinZoom: number;
    /** Maximum zoom for aerial tiles */
    aerialMaxZoom: number;
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
    activeBaseLayer,
    overlayOpacity,
    overlayColor,
    aerialTilesUrl,
    aerialMinZoom,
    aerialMaxZoom,
    handleZoomChange,
    onDeleteSelectedNodes,
    closeModal,
    children
}) => {
    const { t, i18n } = useTranslation();

    const [viewState, setViewState] = useState({
        longitude: defaultCenter[0],
        latitude: defaultCenter[1],
        zoom: defaultZoom
    });

    // Update zoom state when view changes and notify parent
    useEffect(() => {
        handleZoomChange(viewState.zoom);
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

    // Track the previous base layer so we can remove its source/layer on switch
    const prevBaseLayerRef = useRef(activeBaseLayer);

    // Compute map style when language changes to update attribution strings.
    // We intentionally omit getMapStyle from the dependency array to avoid reloading
    // the full style on prop changes that are handled imperatively (like activeBaseLayer
    // or overlayOpacity). Only i18n.language triggers a recompute (for attribution strings).
    const mapStyle = useMemo(() => getMapStyle(), [i18n.language]);

    // Handle layer switching imperatively by removing the old source/layer and
    // adding the new one.  This stops MapLibre from fetching tiles for inactive
    // layers, saving bandwidth and memory.
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map || !mapLoaded) return;

        const prevLayer = prevBaseLayerRef.current;
        prevBaseLayerRef.current = activeBaseLayer;

        // Nothing to do if the layer hasn't actually changed
        if (prevLayer === activeBaseLayer) return;

        // Insert below the overlay so transit layers render on top
        const beforeLayerId = 'base-overlay';

        // --- Remove the previous base layer and its source ---
        if (map.getLayer(prevLayer)) {
            map.removeLayer(prevLayer);
        }
        if (map.getSource(prevLayer)) {
            map.removeSource(prevLayer);
        }

        // --- Add the new base layer's source and layer ---
        if (activeBaseLayer === 'aerial') {
            if (aerialTilesUrl && !map.getSource('aerial')) {
                map.addSource('aerial', {
                    type: 'raster',
                    tiles: [aerialTilesUrl],
                    tileSize: 256,
                    attribution: t('main:map.aerialAttribution')
                });
                map.addLayer(
                    {
                        id: 'aerial',
                        type: 'raster',
                        source: 'aerial',
                        minzoom: aerialMinZoom,
                        maxzoom: aerialMaxZoom
                    },
                    map.getLayer(beforeLayerId) ? beforeLayerId : undefined
                );
            }
        } else {
            const layerConfig: BaseMapLayerConfig | undefined = baseMapLayers.find(
                (l) => l.shortname === activeBaseLayer
            );
            if (layerConfig && !map.getSource(activeBaseLayer)) {
                map.addSource(activeBaseLayer, {
                    type: 'raster',
                    tiles: [layerConfig.url],
                    tileSize: layerConfig.tileSize ?? 256,
                    attribution: t(`main:map.${layerConfig.attributionKey}`)
                });
                map.addLayer(
                    {
                        id: activeBaseLayer,
                        type: 'raster',
                        source: activeBaseLayer
                    },
                    map.getLayer(beforeLayerId) ? beforeLayerId : undefined
                );
            }
        }
    }, [activeBaseLayer, mapLoaded, mapRef, aerialTilesUrl, aerialMinZoom, aerialMaxZoom, t]);

    // Update overlay opacity imperatively when the slider changes
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (map && mapLoaded && map.getLayer('base-overlay')) {
            map.setPaintProperty('base-overlay', 'fill-opacity', overlayOpacity / 100);
        }
    }, [overlayOpacity, mapLoaded, mapRef]);

    // Update overlay color imperatively when the toggle changes
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (map && mapLoaded && map.getLayer('base-overlay')) {
            map.setPaintProperty('base-overlay', 'fill-color', overlayColor === 'white' ? '#ffffff' : '#000000');
        }
    }, [overlayColor, mapLoaded, mapRef]);

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
