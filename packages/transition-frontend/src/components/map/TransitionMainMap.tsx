/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { DeckGL, DeckGLRef } from '@deck.gl/react';
import { Map as MapLibreMap, Source as MapLibreSource, Layer as MapLibreLayer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// chaire-lib-common:
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
// chaire-lib-frontend:
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
// transition-frontend:
import transitionMapEvents from '../../services/map/events';
import TransitPathFilterManager from '../../services/map/TransitPathFilterManager';
import { layersConfig, mapTileRasterXYZLayerConfig, mapTileVectorLayerConfig } from '../../config/layers.config';
import { MapEventsManager } from '../../services/map/MapEventsManager';
import { TransitionMapController } from '../../services/map/TransitionMapController';
import { MainMapProps, TransitionMapControllerProps } from './types/TransitionMainMapTypes';

// Hooks and components
import { useMapState } from './hooks/useMapState';
import { useMapLayers } from './hooks/useMapLayers';
import { useMapEvents } from './hooks/useMapEvents';
import { useMapEditTools } from './hooks/useMapEditTools';
import { MapToolbar } from './MapToolbar';
import { MapContextMenu, useContextMenu } from './MapContextMenu';

const MainMap = ({ zoom, center, activeSection, children }: MainMapProps) => {
    const mapContainerRef = useRef<DeckGLRef>(null);

    // Initialize state counters
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedObjectsCount, setSelectedObjectsCount] = useState<number>(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedObjectDraggingCount, setSelectedObjectDraggingCount] = useState(0);
    const [vectorTilesLayerConfig, setVectorTilesLayerConfig] = useState(mapTileVectorLayerConfig(Preferences.current));
    const [rasterXYZLayerConfig, setRasterXYZLayerConfig] = useState(mapTileRasterXYZLayerConfig(Preferences.current));

    // State update callbacks
    const updateSelectedObjectsCount = useCallback(() => {
        setSelectedObjectsCount((prev) => prev + 1);
    }, []);

    const updateSelectedObjectDraggingCount = useCallback(() => {
        setSelectedObjectDraggingCount((prev) => prev + 1);
    }, []);

    // Initialize core services
    const pathFilterManager = useMemo(() => new TransitPathFilterManager(), []);

    // Create map callbacks
    const mapCallbacks = useMemo<MapCallbacks>(
        () => ({
            pickMultipleObjects: (opts) => mapContainerRef.current?.pickMultipleObjects(opts) || [],
            pickObject: (opts) => mapContainerRef.current?.pickObject(opts) || null,
            pixelsToCoordinates: (pixels) => viewportRef.current?.unproject(pixels) || [0, 0]
        }),
        []
    );

    // Create map events manager
    const mapEventsManager = useMemo(() => {
        const mapEvents = [globalMapEvents, transitionMapEvents];
        const mapEventsArr = mapEvents.flatMap((ev) => ev);
        return new MapEventsManager(mapEventsArr, mapCallbacks);
    }, [mapCallbacks]);

    // Use custom hooks
    const { viewState, zoomRef, viewportRef, onViewStateChange, onResize, fitBounds } = useMapState(center, zoom);

    // Use the edit tools hook
    const { mapEditTool, activeMapEventManager, enableEditTool, disableEditTool, getEditToolLayers } = useMapEditTools(
        mapEventsManager,
        mapCallbacks
    );

    const { showContextMenu, hideContextMenu } = useContextMenu();

    // Use the simplified layer management hook - now passing layersConfig instead of layerManager
    const { layers, isDragging, needAnimation } = useMapLayers(
        layersConfig,
        mapCallbacks,
        mapEventsManager,
        activeSection,
        zoomRef,
        mapEditTool,
        getEditToolLayers,
        pathFilterManager
    );

    const { onTooltip } = useMapEvents(
        mapEventsManager,
        activeSection,
        updateSelectedObjectsCount,
        updateSelectedObjectDraggingCount,
        fitBounds,
        showContextMenu,
        hideContextMenu
    );

    // Handle preferences change
    const onPreferencesChange = useCallback((updates: any) => {
        if (Object.keys(updates).some((key) => ['mapTileVectorOpacity', 'mapTileRasterXYZOpacity'].includes(key))) {
            setVectorTilesLayerConfig(mapTileVectorLayerConfig(Preferences.current));
            setRasterXYZLayerConfig(mapTileRasterXYZLayerConfig(Preferences.current));
        }
    }, []);

    // Initialize services
    useEffect(() => {
        // Add path filter manager to service locator
        serviceLocator.addService('pathLayerManager', pathFilterManager);

        // Add preferences change listener
        Preferences.addChangeListener(onPreferencesChange);

        // Notify that map is loaded
        serviceLocator.eventManager.emit('map.loaded');

        // Clean up on unmount
        return () => {
            serviceLocator.removeService('pathLayerManager');
            Preferences.removeChangeListener(onPreferencesChange);
        };
    }, []);

    // Performance optimized controller options
    const controllerOptions = useMemo(
        () =>
            ({
                scrollZoom: true,
                doubleClickZoom: false,
                dragPan: !isDragging,
                inertia: true, // Enable inertia for smoother panning
                type: TransitionMapController,
                mapEventsManager: activeMapEventManager,
                mapCallbacks,
                activeSection
            }) as TransitionMapControllerProps,
        [isDragging, activeMapEventManager, mapCallbacks, activeSection]
    );

    return (
        <section id="tr__main-map">
            <MapContextMenu />
            {children}
            <div onContextMenu={(evt) => evt.preventDefault()}>
                <DeckGL
                    ref={mapContainerRef}
                    viewState={viewState}
                    controller={controllerOptions}
                    _animate={needAnimation()}
                    layers={layers}
                    onViewStateChange={onViewStateChange}
                    getTooltip={onTooltip}
                    onResize={onResize}
                    useDevicePixels={true} // Improve rendering quality
                    getCursor={({ isHovering, isDragging: cursorDragging }) => {
                        if (mapEditTool !== undefined) {
                            return 'crosshair';
                        }
                        return cursorDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab';
                    }}
                >
                    <MapLibreMap
                        mapStyle={vectorTilesLayerConfig.styleUrl}
                        renderWorldCopies={true} // Improve panning experience
                        reuseMaps={true} // Reuse WebGL context for better performance
                    >
                        {rasterXYZLayerConfig.url && rasterXYZLayerConfig.opacity > 0 && (
                            <MapLibreSource
                                id="raster-tiles"
                                type="raster"
                                tiles={[rasterXYZLayerConfig.url]}
                                tileSize={rasterXYZLayerConfig.tileSize}
                                minzoom={rasterXYZLayerConfig.minzoom}
                                maxzoom={rasterXYZLayerConfig.maxzoom}
                            >
                                <MapLibreLayer
                                    id="raster-layer"
                                    type="raster"
                                    paint={{
                                        'raster-opacity': rasterXYZLayerConfig.opacity
                                    }}
                                />
                            </MapLibreSource>
                        )}
                    </MapLibreMap>
                </DeckGL>
                <MapToolbar
                    activeSection={activeSection}
                    mapEditTool={mapEditTool}
                    enableEditTool={enableEditTool}
                    disableEditTool={disableEditTool}
                />
                {mapEditTool && mapEditTool.getMapComponent()}
            </div>
        </section>
    );
};

export default MainMap;
