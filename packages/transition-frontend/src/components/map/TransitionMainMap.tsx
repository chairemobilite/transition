import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import _throttle from 'lodash/throttle';
import { Layer, LayerProps } from '@deck.gl/core';
import { DeckGL, DeckGLRef } from '@deck.gl/react';
import { WebMercatorViewport, PickingInfo } from '@deck.gl/core';
import { Map as MapLibreMap, Source as MapLibreSource, Layer as MapLibreLayer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// chaire-lib-common:
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
// chaire-lib-frontend:
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
// transition-frontend:
import transitionMapEvents from '../../services/map/events';
import TransitPathFilterManager from '../../services/map/TransitPathFilterManager';
import { MapButton } from '../parts/MapButton';
import {
    layersConfig,
    mapTileRasterXYZLayerConfig,
    mapTileVectorLayerConfig,
    sectionLayers
} from '../../config/layers.config';
import getLayer from './layers/TransitionMapLayer';
import { MapEventsManager } from '../../services/map/MapEventsManager';
import { MeasureToolMapFeature } from './tools/MapMeasureTool';
import { TransitionMapController } from '../../services/map/TransitionMapController';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { PolygonDrawMapFeature } from './tools/MapPolygonDrawTool';
import { MapEditTool, TransitionMapControllerProps, MainMapProps } from './types/TransitionMainMapTypes';
import { getDefaultViewState } from './defaults/TransitionMainMapDefaults';
import { ContextMenuManager } from '../../services/map/ContextMenuManager';

const MainMap = ({ zoom, center, activeSection, children }: MainMapProps) => {
    const { t } = useTranslation(['transit', 'main']);

    // Refs
    const mapContainer = useRef<DeckGLRef>(null);
    const viewportRef = useRef<WebMercatorViewport | null>(null);
    const deckGlLayersRef = useRef<Layer<LayerProps>[]>([]);
    const updateCountsRef = useRef<{ [layerName: string]: number }>({});
    const contextMenuManagerRef = useRef<ContextMenuManager | undefined>(undefined);
    // Internal ViewState ref for smooth rendering

    // Services - create these once and maintain stable references
    const layerManager = useMemo(() => new MapLayerManager(layersConfig), []);
    const pathFilterManager = useMemo(() => new TransitPathFilterManager(), []);
    const mapCallbacks = useMemo<MapCallbacks>(
        () => ({
            pickMultipleObjects: (opts) => mapContainer.current?.pickMultipleObjects(opts) || [],
            pickObject: (opts) => mapContainer.current?.pickObject(opts) || null,
            pixelsToCoordinates: (pixels) => viewportRef.current?.unproject(pixels) || [0, 0]
        }),
        []
    );
    const mapEventsManager = useMemo(() => {
        const mapEvents = [globalMapEvents, transitionMapEvents];
        const mapEventsArr = mapEvents.flatMap((ev) => ev);
        return new MapEventsManager(mapEventsArr, mapCallbacks);
    }, [mapCallbacks]); // Only depend on mapCallbacks which is stable

    // State
    const [viewState, setViewState] = useState(getDefaultViewState(center, zoom)); // FIXME: removing the viewState makes the interface not able to pan/zoom or other updates/update layers. However, the state is not read anywhere. Weird...
    const [visibleLayers, setVisibleLayers] = useState<string[]>([]); // FIXME: removing the visibleLayers makes the interface not able to update layers. However, the state is not read anywhere. Weird...
    const [selectedObjectsCount, setSelectedObjectsCount] = useState<number>(0);
    const [vectorTilesLayerConfig, setVectorTilesLayerConfig] = useState(mapTileVectorLayerConfig(Preferences.current));
    const [rasterXYZLayerConfig, setRasterXYZLayerConfig] = useState(mapTileRasterXYZLayerConfig(Preferences.current));
    const [isDragging, setIsDragging] = useState(false);
    const [mapEditTool, setMapEditTool] = useState<MapEditTool | undefined>(undefined);
    const [editUpdateCount, setEditUpdateCount] = useState(0);
    const [selectedObjectDraggingCount, setSelectedObjectDraggingCount] = useState(0);
    const [activeMapEventManager, setActiveMapEventManager] = useState<MapEventsManager>(mapEventsManager);

    // useCallback

    const updateUserPrefs = useCallback((updatedViewState) => {
        // Save map zoom and center to user preferences
        Preferences.update(
            {
                'map.zoom': updatedViewState.zoom,
                'map.center': [updatedViewState.longitude, updatedViewState.latitude]
            },
            serviceLocator.socketEventManager,
            false // do not emit prefs change event, otherwise it will call onPreferencesChange
        );
        serviceLocator.eventManager.emit('map.updateMouseCoordinates', [
            updatedViewState.longitude,
            updatedViewState.latitude
        ]);
    }, []);

    // Update map layers - core function to rebuild layers
    const updateMapLayers = useCallback(() => {
        console.log('updateMapLayers');
        const deckGlLayers: Layer<LayerProps>[] = [];

        const enabledLayers = layerManager.getEnabledLayers().filter((layer) => layer.visible === true);

        enabledLayers.forEach((layer) => {
            const layerResult = getLayer({
                layerDescription: layer,
                viewState,
                events: mapEditTool === undefined ? mapEventsManager.getLayerEvents(layer.id) : undefined,
                activeSection,
                setIsDragging,
                mapCallbacks,
                updateCount: updateCountsRef.current[layer.id] || 0,
                filter: layerManager.getFilter(layer.id)
            });

            if (layerResult) {
                // Add all layers from the result (could be array)
                if (Array.isArray(layerResult)) {
                    deckGlLayers.push(...layerResult.filter(Boolean));
                } else {
                    deckGlLayers.push(layerResult);
                }
            }
        });

        // Add edit layers
        // TODO: move node multi-select tool to a separate mapedit tool, like the measure tool.
        // Right now, the multi-select tool flickers when creating the polygon, but it does not flicker with the measure tool.
        if (mapEditTool !== undefined) {
            const deckGlEditLayers = mapEditTool.getLayers({
                viewState,
                activeSection,
                setIsDragging,
                mapCallbacks,
                updateCount: editUpdateCount
            });

            if (deckGlEditLayers && deckGlEditLayers.length > 0) {
                deckGlLayers.push(...(deckGlEditLayers as Layer<LayerProps>[]));
            }
        }

        // Store the layers in the ref for rendering
        deckGlLayersRef.current = deckGlLayers;
    }, [
        activeSection,
        editUpdateCount,
        layerManager,
        mapCallbacks,
        mapEditTool,
        mapEventsManager,
        selectedObjectsCount,
        selectedObjectDraggingCount
    ]);

    // Update visible layers
    const updateVisibleLayers = useCallback(() => {
        const newVisibleLayers = layerManager
            .getEnabledLayers()
            .filter((layer) => layer.visible)
            .map((layer) => layer.id);

        setVisibleLayers(newVisibleLayers);
        updateMapLayers();
    }, [layerManager, updateMapLayers]);

    // Throttled view state update
    const throttledSetViewState = useCallback(
        _throttle((newViewState) => {
            // Update viewport for coordinate calculations
            viewportRef.current = new WebMercatorViewport(newViewState);

            setViewState(newViewState);
            // Only update layers if zoom changed significantly
            /*if (Math.abs(viewState.zoom - newViewState.zoom) > 0.1) {
            updateMapLayers();
        }*/

            // Update user preferences (throttled)
            updateUserPrefs(newViewState);
        }, 100),
        []
    );

    // View state change handler
    const onViewStateChange = useCallback(({ viewState: newViewState }) => {
        // Continue with throttled updates:
        throttledSetViewState(newViewState);
    }, []);

    // Window resize handler
    const onResize = useCallback(({ width, height }) => {
        viewportRef.current = new WebMercatorViewport({
            ...viewState,
            width,
            height
        });
    }, []);

    // Tooltip handler
    const onTooltip = useCallback(
        (pickInfo: PickingInfo) => {
            const result = null;
            if (pickInfo.picked === true && pickInfo.layer) {
                if (pickInfo.layer && !pickInfo.object) {
                    // it is indeed possible to have a layer and no object:
                    return null;
                }
                const tooltipEvents = mapEventsManager.getTooltipEvents(pickInfo.layer.id).onTooltip;
                if (tooltipEvents) {
                    for (let i = 0; i < tooltipEvents.length; i++) {
                        const tooltip = mapEventsManager.executeTooltipEvent(tooltipEvents[i], pickInfo, activeSection);
                        if (tooltip !== undefined) {
                            return typeof tooltip === 'string'
                                ? tooltip
                                : tooltip.containsHtml === true
                                    ? { html: tooltip.text }
                                    : tooltip.text;
                        }
                    }
                }
            }
            return result;
        },
        [activeSection, mapEventsManager]
    );

    // Handle preferences change
    const onPreferencesChange = useCallback((updates: any) => {
        if (Object.keys(updates).some((key) => ['mapTileVectorOpacity', 'mapTileRasterXYZOpacity'].includes(key))) {
            setVectorTilesLayerConfig(mapTileVectorLayerConfig(Preferences.current));
            setRasterXYZLayerConfig(mapTileRasterXYZLayerConfig(Preferences.current));
        }
    }, []);

    // this serves as a way to know when to refresh layers and get the correct map events
    const updateSelectedObjectsCount = useCallback(() => {
        setSelectedObjectsCount((prev) => prev + 1);
    }, []);

    // this serves as a way to know when to refresh layers and get the correct map events while dragging
    const updateSelectedObjectDraggingCount = useCallback(() => {
        setSelectedObjectDraggingCount((prev) => prev + 1);
    }, []);

    // Enable edit tool
    const enableEditTool = useCallback(
        (ToolConstructor: any) => {
            const newMapEditTool = new ToolConstructor({
                onUpdate: () => {
                    setEditUpdateCount((prev) => prev + 1);
                    updateMapLayers();
                },
                onDisable: () => {
                    setMapEditTool(undefined);
                    setActiveMapEventManager(mapEventsManager);
                    updateMapLayers();
                }
            });

            setMapEditTool(newMapEditTool);
            setActiveMapEventManager(new MapEventsManager(newMapEditTool.getMapEvents(), mapCallbacks));
            updateMapLayers();
        },
        [mapCallbacks, mapEventsManager, updateMapLayers]
    );

    // Disable edit tool
    const disableEditTool = useCallback(() => {
        setMapEditTool(undefined);
        setActiveMapEventManager(mapEventsManager);
        updateMapLayers();
    }, [mapEventsManager, updateMapLayers]);

    // Show paths by attribute
    const showPathsByAttribute = useCallback(
        (attribute: string, value: any) => {
            if (attribute === 'agency_id') {
                pathFilterManager.showAgencyId(value);
            } else if (attribute === 'line_id') {
                pathFilterManager.showLineId(value);
            }
        },
        [pathFilterManager]
    );

    // Hide paths by attribute
    const hidePathsByAttribute = useCallback(
        (attribute: string, value: any) => {
            if (attribute === 'agency_id') {
                pathFilterManager.hideAgencyId(value);
            } else if (attribute === 'line_id') {
                pathFilterManager.hideLineId(value);
            }
        },
        [pathFilterManager]
    );

    // Clear paths filter
    const clearPathsFilter = useCallback(() => {
        pathFilterManager.clearFilter();
    }, [pathFilterManager]);

    // Show layer
    const showLayer = useCallback(
        (layerName: string) => {
            layerManager.showLayer(layerName);
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Hide layer
    const hideLayer = useCallback(
        (layerName: string) => {
            layerManager.hideLayer(layerName);
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Clear filter
    const clearFilter = useCallback(
        (layerName: string) => {
            layerManager.clearFilter(layerName);
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Update filter
    const updateFilter = useCallback(
        (args: { layerName: string; filter: ((feature: GeoJSON.Feature) => 0 | 1) | undefined }) => {
            layerManager.updateFilter(args.layerName, args.filter);
            updateCountsRef.current[args.layerName] = (updateCountsRef.current[args.layerName] || 0) + 1;
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Update layer
    const updateLayer = useCallback(
        (args: {
            layerName: string;
            data: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection);
        }) => {
            layerManager.updateLayer(args.layerName, args.data);
            updateCountsRef.current[args.layerName] = (updateCountsRef.current[args.layerName] || 0) + 1;
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Update layers
    const updateLayers = useCallback(
        (geojsonByLayerName: any) => {
            layerManager.updateLayers(geojsonByLayerName);
            Object.keys(geojsonByLayerName).forEach(
                (layerName) => (updateCountsRef.current[layerName] = (updateCountsRef.current[layerName] || 0) + 1)
            );
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Update enabled layers
    const updateEnabledLayers = useCallback(
        (enabledLayers: string[]) => {
            layerManager.updateEnabledLayers(enabledLayers);
            updateVisibleLayers();
        },
        [layerManager, updateVisibleLayers]
    );

    // Show context menu - made into a callback with proper dependencies
    const showContextMenu = useCallback(
        (
            position: [number, number],
            elements: { key?: string; title: string; onClick: () => void; onHover?: () => void }[]
        ) => {
            contextMenuManagerRef.current?.show(position, elements);
        },
        []
    );

    // Hide context menu - also made into a callback with proper dependencies
    const hideContextMenu = useCallback(() => {
        contextMenuManagerRef.current?.hide();
    }, []);

    // Fit bounds
    const fitBounds = useCallback(
        (bounds: [[number, number], [number, number]]) => {
            if (!viewportRef.current) {
                return;
            }

            // Use a mercator viewport to fit the bounds
            const viewport = new WebMercatorViewport(viewState).fitBounds(bounds, {
                padding: 20
            });

            const { latitude, longitude, zoom } = viewport;
            const newViewState = {
                ...viewState,
                latitude,
                longitude,
                zoom
            };

            // Update both refs
            viewportRef.current = viewport;

            // Update state
            setViewState(newViewState);
            updateMapLayers();
        },
        [updateMapLayers]
    );

    // useEffect
    // Initialize context menu manager
    useEffect(() => {
        contextMenuManagerRef.current = new ContextMenuManager('tr__main-map-context-menu', t);

        return () => {
            contextMenuManagerRef.current?.destroy();
        };
    }, [t]);

    // Initialize services and set up event listeners - empty dependency array to run only once
    useEffect(() => {
        // Initialize viewport
        viewportRef.current = new WebMercatorViewport(viewState);

        // Add services to service locator
        serviceLocator.addService('layerManager', layerManager);
        serviceLocator.addService('pathLayerManager', pathFilterManager);

        // Add preferences change listener
        Preferences.addChangeListener(onPreferencesChange);

        // Initial map loaded notification
        serviceLocator.eventManager.emit('map.loaded');

        // Clean up on unmount
        return () => {
            serviceLocator.removeService('layerManager');
            serviceLocator.removeService('pathLayerManager');
            Preferences.removeChangeListener(onPreferencesChange);
        };
    }, []); // Empty dependency array - only run on mount/unmount

    // Set up event listeners in a separate effect with a ref to track registration
    const eventListenersRegistered = useRef(false);

    useEffect(() => {
        // Only register once to prevent event loops
        if (eventListenersRegistered.current) {
            return;
        }

        // Set up event listeners
        serviceLocator.eventManager.on('map.updateEnabledLayers', updateEnabledLayers);
        serviceLocator.eventManager.on('map.updateLayer', updateLayer);
        serviceLocator.eventManager.on('map.updateLayers', updateLayers);
        serviceLocator.eventManager.on('map.layers.updateFilter', updateFilter);
        serviceLocator.eventManager.on('map.clearFilter', clearFilter);
        serviceLocator.eventManager.on('map.showLayer', showLayer);
        serviceLocator.eventManager.on('map.hideLayer', hideLayer);
        serviceLocator.eventManager.on('map.fitBounds', fitBounds);
        serviceLocator.eventManager.on('map.paths.byAttribute.show', showPathsByAttribute);
        serviceLocator.eventManager.on('map.paths.byAttribute.hide', hidePathsByAttribute);
        serviceLocator.eventManager.on('map.paths.clearFilter', clearPathsFilter);
        serviceLocator.eventManager.on('map.showContextMenu', showContextMenu);
        serviceLocator.eventManager.on('map.hideContextMenu', hideContextMenu);
        for (const objectType of ['node', 'path', 'service', 'scenario']) {
            serviceLocator.eventManager.on(`selected.deselect.${objectType}`, updateSelectedObjectsCount);
            serviceLocator.eventManager.on(`selected.update.${objectType}`, updateSelectedObjectsCount);
        }
        for (const objectType of ['node']) {
            serviceLocator.eventManager.on(`selected.drag.${objectType}`, updateSelectedObjectDraggingCount);
        }

        // Mark as registered to prevent duplicate registrations
        eventListenersRegistered.current = true;

        // Clean up on unmount
        return () => {
            if (eventListenersRegistered.current) {
                serviceLocator.eventManager.off('map.updateEnabledLayers', updateEnabledLayers);
                serviceLocator.eventManager.off('map.updateLayer', updateLayer);
                serviceLocator.eventManager.off('map.updateLayers', updateLayers);
                serviceLocator.eventManager.off('map.layers.updateFilter', updateFilter);
                serviceLocator.eventManager.off('map.clearFilter', clearFilter);
                serviceLocator.eventManager.off('map.showLayer', showLayer);
                serviceLocator.eventManager.off('map.hideLayer', hideLayer);
                serviceLocator.eventManager.off('map.fitBounds', fitBounds);
                serviceLocator.eventManager.off('map.paths.byAttribute.show', showPathsByAttribute);
                serviceLocator.eventManager.off('map.paths.byAttribute.hide', hidePathsByAttribute);
                serviceLocator.eventManager.off('map.paths.clearFilter', clearPathsFilter);
                serviceLocator.eventManager.off('map.showContextMenu', showContextMenu);
                serviceLocator.eventManager.off('map.hideContextMenu', hideContextMenu);
                for (const objectType of ['node', 'path', 'service', 'scenario']) {
                    serviceLocator.eventManager.off(`selected.deselect.${objectType}`, updateSelectedObjectsCount);
                    serviceLocator.eventManager.off(`selected.update.${objectType}`, updateSelectedObjectsCount);
                }
                for (const objectType of ['node']) {
                    serviceLocator.eventManager.off(`selected.drag.${objectType}`, updateSelectedObjectDraggingCount);
                }

                // Reset flag on cleanup
                eventListenersRegistered.current = false;
            }
        };
    }, []); // Empty dependency array to avoid recreating listeners

    // Handle section changes - KEY FIX: Respond properly to activeSection changes
    useEffect(() => {
        // Update enabled layers when section changes
        layerManager.updateEnabledLayers(sectionLayers[activeSection] || []);
        updateVisibleLayers();
        updateMapLayers();
    }, [activeSection, layerManager, updateMapLayers, updateVisibleLayers]);

    // Determine if animation is needed
    const needAnimation = useCallback(() => {
        if (Preferences.get('map.enableMapAnimations', true)) {
            return (
                layerManager
                    .getEnabledLayers()
                    .filter((layer) => layer.visible === true)
                    .find((layer) => layer.configuration.type === 'animatedArrowPath') !== undefined
            );
        }
        return false;
    }, [layerManager, updateMapLayers]);

    return (
        <section id="tr__main-map">
            <div id="tr__main-map-context-menu" className="tr__main-map-context-menu"></div>
            {children}
            <div onContextMenu={(evt) => evt.preventDefault()}>
                <DeckGL
                    ref={mapContainer}
                    viewState={viewState} // Use internal view state ref for smooth rendering
                    controller={
                        {
                            scrollZoom: true,
                            doubleClickZoom: false,
                            dragPan: !isDragging,
                            type: TransitionMapController,
                            mapEventsManager: activeMapEventManager,
                            mapCallbacks,
                            activeSection
                        } as TransitionMapControllerProps
                    }
                    _animate={needAnimation()}
                    layers={deckGlLayersRef.current}
                    onViewStateChange={onViewStateChange}
                    getTooltip={onTooltip}
                    onResize={onResize}
                    getCursor={({ isHovering, isDragging: cursorDragging }) => {
                        if (mapEditTool !== undefined) {
                            return 'crosshair';
                        }
                        return cursorDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab';
                    }}
                >
                    <MapLibreMap mapStyle={vectorTilesLayerConfig.styleUrl}>
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
                <div className="tr__map-button-container">
                    <MapButton
                        title="main:MeasureTool"
                        key="mapbtn_measuretool"
                        className={`${mapEditTool?.getEditMode() === MeasureToolMapFeature.editMode ? 'active' : ''}`}
                        onClick={() => {
                            if (mapEditTool?.getEditMode() === MeasureToolMapFeature.editMode) {
                                disableEditTool();
                            } else {
                                enableEditTool(MeasureToolMapFeature);
                            }
                        }}
                        iconPath={'/dist/images/icons/interface/ruler_white.svg'}
                    />
                    {activeSection === 'nodes' && (
                        <MapButton
                            title="main:PolygonDrawTool"
                            key="mapbtn_polygontool"
                            className={`${mapEditTool?.getEditMode() === PolygonDrawMapFeature.editMode ? 'active' : ''}`}
                            onClick={() => {
                                if (mapEditTool?.getEditMode() === PolygonDrawMapFeature.editMode) {
                                    disableEditTool();
                                } else {
                                    enableEditTool(PolygonDrawMapFeature);
                                }
                            }}
                            iconPath={'/dist/images/icons/interface/select_white.svg'}
                        />
                    )}
                </div>
                {mapEditTool && mapEditTool.getMapComponent()}
            </div>
        </section>
    );
};

export default MainMap;
