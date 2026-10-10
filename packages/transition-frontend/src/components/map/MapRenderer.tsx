/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import MapLibreMap, { MapRef, ScaleControl, SourceSpecification, LayerSpecification } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import { usePreference } from 'chaire-lib-frontend/lib/hooks/usePreference';
import {
    isProjectBasemapStyleUrl,
    ProjectMapBasemapShortname
} from 'chaire-lib-common/lib/config/mapBaseLayersProject.types';

import MapControlsPanel from './TransitionMapControlsMenu';
import { composeMapStyleWithOverlay, getProjectBasemapByShortname } from '../../config/projectBaseMapLayers';

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
    /** Start or stop the animation of the custom layers (path arrows, selected-node spinner) */
    setAnimationEnabled: (enabled: boolean) => void;
    setupMapEvents: () => void;
    setMap: () => void;
    confirmModalDeleteIsOpen: boolean;
    activeBasemapShortname: ProjectMapBasemapShortname;
    currentZoom: number;
    /** Overlay opacity as a percentage (0-100) */
    overlayOpacity: number;
    /** Overlay color: 'black' or 'white' */
    overlayColor: 'black' | 'white';
    /** Maximum zoom from configured basemaps (see `getMaxConfiguredRasterBasemapZoom`). */
    maxRasterBasemapZoom: number;
    handleZoomChange: (zoom: number) => void;
    onLayerChange: (layerType: ProjectMapBasemapShortname) => void;
    onOverlayOpacityChange: (opacity: number) => void;
    onOverlayColorChange: (color: 'black' | 'white') => void;
    children: React.ReactNode;
    onDeleteSelectedNodes: () => void;
    closeModal: () => void;
}

/**
 * Functional component wrapper for MapLibreMap to handle hooks.
 * This component manages the map view state, the custom layers animation, and renders
 * the MapLibre map with all necessary controls and overlays.
 */
const MapRenderer: React.FC<MapRendererProps> = ({
    mapRef,
    defaultCenter,
    defaultZoom,
    mapLoaded,
    getMapStyle,
    setAnimationEnabled,
    setupMapEvents,
    setMap,
    confirmModalDeleteIsOpen,
    activeBasemapShortname,
    currentZoom,
    overlayOpacity,
    overlayColor,
    maxRasterBasemapZoom,
    handleZoomChange,
    onLayerChange,
    onOverlayOpacityChange,
    onOverlayColorChange,
    onDeleteSelectedNodes,
    closeModal,
    children
}) => {
    const { t } = useTranslation();

    const handleResetView = React.useCallback(() => {
        mapRef.current?.getMap()?.flyTo({
            center: defaultCenter,
            zoom: defaultZoom,
            bearing: 0,
            pitch: 0
        });
    }, [mapRef, defaultCenter, defaultZoom]);

    // Initial camera only. The map keeps it afterwards. Passing longitude/zoom back as props
    // makes react-map-gl replace MapLibre's in-progress gesture with the previous React render,
    // so the custom layers and the GeoJSON layers are no longer drawn at the same zoom.
    const initialViewState = useMemo(
        () => ({
            longitude: defaultCenter[0],
            latitude: defaultCenter[1],
            zoom: defaultZoom
        }),
        [defaultCenter, defaultZoom]
    );

    const [enableAnimation] = usePreference('map.enableAnimation', true);
    useEffect(() => {
        setAnimationEnabled(enableAnimation);
    }, [enableAnimation, setAnimationEnabled]);

    // Initial style for <MapLibreMap>; subsequent changes go through setStyle imperatively.
    const [initialMapStyle] = useState<MapStyleSpec>(() => getMapStyle());

    /**
     * Ref that tracks which basemap shortname was last applied via setStyle,
     * so we can skip no-op overlay-only updates when the basemap hasn't changed.
     */
    const appliedBasemapRef = useRef<string | null>(null);

    /** Cached style JSON keyed by basemap shortname so overlay-only changes skip the network. */
    const fetchedStyleCacheRef = useRef<{ shortname: string; style: StyleSpecification } | null>(null);

    // Unified basemap + overlay style effect.
    // Uses MapLibre's `setStyle` with `diff: true` for same-basemap overlay tweaks (only changed
    // sources/layers are patched), and `diff: false` for basemap switches (full style replacement).
    // See https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setstyle
    // The AbortController cancels in-flight styleUrl fetches when deps change before the response
    // arrives (standard React effect cleanup pattern for async requests).
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map || !mapLoaded) return;

        const projectBasemap = getProjectBasemapByShortname(activeBasemapShortname);
        const basemapChanged = appliedBasemapRef.current !== activeBasemapShortname;

        if (projectBasemap && isProjectBasemapStyleUrl(projectBasemap)) {
            const requested = activeBasemapShortname;

            const applyStyle = (style: StyleSpecification): void => {
                const m = mapRef.current?.getMap();
                if (!m) return;
                const switchingBasemap = appliedBasemapRef.current !== requested;
                const composed = composeMapStyleWithOverlay(style, overlayOpacity, overlayColor);
                m.setStyle(composed as MapStyleSpec, { diff: !switchingBasemap });
                appliedBasemapRef.current = requested;
            };

            const cached = fetchedStyleCacheRef.current;
            if (cached && cached.shortname === requested && !basemapChanged) {
                applyStyle(cached.style);
                return;
            }

            const { styleUrl } = projectBasemap;
            const ac = new AbortController();
            if (basemapChanged) {
                serviceLocator.eventManager.emit('progress', { name: 'MapStyleSwitch', progress: 0.0 });
            }
            fetch(styleUrl, { signal: ac.signal })
                .then((r) => r.json())
                .then((style: StyleSpecification) => {
                    fetchedStyleCacheRef.current = { shortname: requested, style };
                    applyStyle(style);
                })
                .catch((e: Error) => {
                    if (e.name !== 'AbortError') {
                        console.error('Style basemap load failed:', e);
                        serviceLocator.eventManager.emit('progressClear', { name: 'MapStyleSwitch' });
                    }
                });
            return () => ac.abort();
        }

        if (projectBasemap) {
            if (basemapChanged) {
                serviceLocator.eventManager.emit('progress', { name: 'MapStyleSwitch', progress: 0.0 });
            }
            const composed = composeMapStyleWithOverlay(
                projectBasemap.style as StyleSpecification,
                overlayOpacity,
                overlayColor
            );
            map.setStyle(composed as MapStyleSpec, { diff: !basemapChanged });
            appliedBasemapRef.current = activeBasemapShortname;
            return;
        }

        // OSM raster fallback
        if (basemapChanged) {
            serviceLocator.eventManager.emit('progress', { name: 'MapStyleSwitch', progress: 0.0 });
        }
        const style = getMapStyle() as MapStyleSpec;
        map.setStyle(style, { diff: !basemapChanged });
        appliedBasemapRef.current = activeBasemapShortname;
    }, [activeBasemapShortname, overlayOpacity, overlayColor, mapLoaded, getMapStyle]);

    return (
        <section id="tr__main-map">
            <div id="tr__main-map-context-menu" className="tr__main-map-context-menu"></div>
            {children}
            <MapLibreMap
                ref={mapRef}
                initialViewState={initialViewState}
                onMove={(evt) => {
                    // Panning reports the same zoom. Updating state then re-renders the map for no basemap change.
                    if (evt.viewState.zoom !== currentZoom) {
                        handleZoomChange(evt.viewState.zoom);
                    }
                }}
                onLoad={() => {
                    setMap();
                    setupMapEvents();
                }}
                // Keep OSM and MapLibre credits expanded so map screenshots include them.
                attributionControl={{ compact: false }}
                style={{ width: '100%', height: '100%' }}
                maxZoom={Math.max(20, maxRasterBasemapZoom)}
                mapStyle={initialMapStyle}
                hash={true}
            >
                <ScaleControl position="bottom-right" />
            </MapLibreMap>
            {mapLoaded && (
                <MapControlsPanel
                    currentLayer={activeBasemapShortname}
                    currentZoom={currentZoom}
                    overlayOpacity={overlayOpacity}
                    overlayColor={overlayColor}
                    onLayerChange={onLayerChange}
                    onOverlayOpacityChange={onOverlayOpacityChange}
                    onOverlayColorChange={onOverlayColorChange}
                    onResetView={handleResetView}
                />
            )}
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
