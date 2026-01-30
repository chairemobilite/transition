/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// External packages
import React, { PropsWithChildren } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WithTranslation, withTranslation } from 'react-i18next';
import { MapRef, SourceSpecification, LayerSpecification } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import type { LayersList } from '@deck.gl/core';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

// chaire-lib imports
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import config from 'chaire-lib-frontend/lib/config/project.config';
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
import MapPopupManager from 'chaire-lib-frontend/lib/services/map/MapPopupManager';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

// Local workspace imports
import layersConfig, { sectionLayers, overlaySource } from '../../config/layers.config';
import { polygonSelectionService } from '../../services/map/PolygonSelectionService';
import transitionMapEvents from '../../services/map/events';
import mapCustomEvents from '../../services/map/events/MapRelatedCustomEvents';
import PathMapLayerManager from '../../services/map/PathMapLayerManager';
import { deleteUnusedNodes } from '../../services/transitNodes/transitNodesUtils';
import MapControlsMenu from './TransitionMapControlsMenu';
import MapRenderer, { MapStyleSpec } from './MapRenderer';
import { createDeckLayersFromMappings } from '../../config/deckLayers.config';
import { resetClasses } from '../../services/map/MapCursorHelper';

/**
 * Optional custom raster tiles configuration that can be set in config.js.
 * These values are used as fallbacks when environment variables are not set.
 */
interface CustomRasterTilesConfig {
    customRasterTilesXyzUrl?: string;
    customRasterTilesMinZoom?: string | number;
    customRasterTilesMaxZoom?: string | number;
}

/** Project config with optional custom raster tiles properties */
const typedConfig = config as CustomRasterTilesConfig;

export interface MainMapProps extends LayoutSectionProps {
    zoom: number;
    center: [number, number];
    // TODO : put layers and events together in an application configuration received as props here
    // layersConfig: { [key: string]: any };
    // mapEvents: MapEventHandlerDescription[];
    // customEvents: any;
}

interface MainMapState {
    layers: string[];
    confirmModalDeleteIsOpen: boolean;
    mapLoaded: boolean;
    contextMenu: HTMLElement | null;
    contextMenuRoot: Root | undefined;
    showAerialTiles: boolean;
    currentZoom: number;
    userPreferredLayer: 'osm' | 'aerial'; // Track user's layer choice in preferences
}

/**
 * TODO: For now, hard code the map for Transition here. But it should be in
 * chaire-lib and offer the possibility to pass the application modules when the
 * API for it has stabilised.
 */
class MainMap extends React.Component<MainMapProps & WithTranslation & PropsWithChildren, MainMapState> {
    private layerManager: MapLayerManager;
    private pathLayerManager: PathMapLayerManager;
    private defaultZoomArray: [number];
    private defaultCenter: [number, number];
    private mapEvents: { [key: string]: { [key: string]: MapEventHandlerDescription[] } };
    private map: maplibregl.Map | undefined;
    private popupManager: MapPopupManager;
    private mapRef: React.RefObject<MapRef | null>;
    private mapControlsMenu: MapControlsMenu | undefined;
    private aerialTilesUrl: string | undefined;
    private aerialMinZoom: number = 0;
    private aerialMaxZoom: number = 22;

    constructor(props: MainMapProps & WithTranslation) {
        super(props);

        // Get user's preferred base layer from preferences
        const baseLayer = (Preferences.get('map.baseLayer', 'osm') as 'osm' | 'aerial') || 'osm';

        this.state = {
            layers: sectionLayers[this.props.activeSection] || [], // Get layers for section from config
            confirmModalDeleteIsOpen: false,
            mapLoaded: false,
            contextMenu: null,
            contextMenuRoot: undefined,
            showAerialTiles: baseLayer === 'aerial',
            currentZoom: props.zoom,
            userPreferredLayer: baseLayer
        };

        this.defaultZoomArray = [props.zoom];
        this.defaultCenter = props.center;
        this.layerManager = new MapLayerManager(layersConfig);
        this.pathLayerManager = new PathMapLayerManager(this.layerManager);

        this.popupManager = new MapPopupManager();
        this.mapEvents = {};
        this.map = undefined;
        this.mapRef = React.createRef<MapRef>();

        // Read aerial tiles configuration from environment variables or config file
        // Webpack injects process.env values at build time, with fallback to config values
        // We also check the config object at runtime as a fallback
        this.aerialTilesUrl =
            process.env.CUSTOM_RASTER_TILES_XYZ_URL || typedConfig.customRasterTilesXyzUrl || undefined;
        const minZoomEnv = process.env.CUSTOM_RASTER_TILES_MIN_ZOOM || typedConfig.customRasterTilesMinZoom;
        const maxZoomEnv = process.env.CUSTOM_RASTER_TILES_MAX_ZOOM || typedConfig.customRasterTilesMaxZoom;
        this.aerialMinZoom = minZoomEnv !== undefined ? Number(minZoomEnv) : 0;
        this.aerialMaxZoom = maxZoomEnv !== undefined ? Number(maxZoomEnv) : 22;

        const newEvents = [globalMapEvents, transitionMapEvents];
        const newEventsArr = newEvents.flatMap((ev) => ev);
        newEventsArr.forEach((eventDescriptor) => {
            this.mapEvents[eventDescriptor.eventName] = this.mapEvents[eventDescriptor.eventName] || {};
            if (eventDescriptor.type === 'layer') {
                const events = this.mapEvents[eventDescriptor.eventName][eventDescriptor.layerName] || [];
                events.push(eventDescriptor);
                this.mapEvents[eventDescriptor.eventName][eventDescriptor.layerName] = events;
            } else {
                const events = this.mapEvents[eventDescriptor.eventName]['map'] || [];
                events.push(eventDescriptor);
                this.mapEvents[eventDescriptor.eventName]['map'] = events;
            }
        });
    }

    fitBounds = (coordinates: [[number, number], [number, number]]) => {
        const map = this.mapRef.current?.getMap();
        if (map) {
            map.fitBounds(coordinates, {
                padding: 20,
                bearing: map.getBearing()
            });
        }
    };

    setCenter = (coordinates: [number, number]) => {
        const map = this.mapRef.current?.getMap();
        map?.setCenter(coordinates);
    };

    onEnableBoxZoom = () => {
        const map = this.mapRef.current?.getMap();
        map?.boxZoom.enable();
    };

    onDisableBoxZoom = () => {
        const map = this.mapRef.current?.getMap();
        map?.boxZoom.disable();
    };

    onEnableDragPan = () => {
        const map = this.mapRef.current?.getMap();
        map?.dragPan.enable();
    };

    onDisableDragPan = () => {
        const map = this.mapRef.current?.getMap();
        map?.dragPan.disable();
    };

    onMapError = (e: { error?: Error; message?: string }) => {
        console.error('Map error:', e);
        if (!this.state.mapLoaded) {
            // Even if there was a map error, call the map.loaded event so the
            // application can continue loading
            this.setState({ mapLoaded: true });
            serviceLocator.eventManager.emit('map.loaded');
        }
    };

    setMap = () => {
        const map = this.mapRef.current?.getMap();
        if (!map) return;

        this.map = map;
        this.layerManager.setMap(map);
        this.popupManager.setMap(map);
        this.layerManager.updateEnabledLayers(this.state.layers);

        // Add controls menu initially with aerial tiles configuration
        this.mapControlsMenu = new MapControlsMenu(this.props.t, {
            onLayerChange: this.handleLayerChange,
            getCurrentLayer: () => (this.state.showAerialTiles ? 'aerial' : 'osm'),
            isZoomInAerialRange: () => this.isZoomInAerialRange(this.state.currentZoom),
            getCurrentZoom: () => this.state.currentZoom,
            aerialTilesUrl: this.aerialTilesUrl,
            minZoom: this.aerialMinZoom,
            maxZoom: this.aerialMaxZoom
        });
        map.addControl(this.mapControlsMenu, 'top-right');

        if (this.aerialTilesUrl && map) {
            const mapLayers = map.getStyle().layers || [];
            let beforeLayerId = mapLayers.length > 0 ? mapLayers[0].id : undefined;

            for (let i = 0, count = mapLayers.length; i < count; i++) {
                const layer = mapLayers[i];
                if (layer.type === 'background') {
                    beforeLayerId = layer.id;
                    break;
                }
            }

            if (beforeLayerId) {
                map.addSource('custom_tiles', {
                    type: 'raster',
                    tiles: [this.aerialTilesUrl],
                    tileSize: 256
                });
                map.addLayer(
                    {
                        id: 'custom_tiles',
                        type: 'raster',
                        source: 'custom_tiles',
                        minzoom: this.aerialMinZoom,
                        maxzoom: this.aerialMaxZoom
                    },
                    beforeLayerId
                );
            }
        }

        this.setState({ mapLoaded: true });
        serviceLocator.eventManager.emit('map.loaded');
    };

    showPathsByAttribute = (attribute: string, value: any) => {
        // attribute must be agency_id or line_id
        if (attribute === 'agency_id') {
            this.pathLayerManager.showAgencyId(value);
        } else if (attribute === 'line_id') {
            this.pathLayerManager.showLineId(value);
        }
    };

    hidePathsByAttribute = (attribute: string, value: any) => {
        // attribute must be agency_id or line_id
        if (attribute === 'agency_id') {
            this.pathLayerManager.hideAgencyId(value);
        } else if (attribute === 'line_id') {
            this.pathLayerManager.hideLineId(value);
        }
    };

    clearPathsFilter = () => {
        this.pathLayerManager.clearFilter();
    };

    componentDidMount = () => {
        // Map initialization is now handled by react-map-gl component
        // We'll set up event handlers after map loads
        serviceLocator.addService('layerManager', this.layerManager);
        serviceLocator.addService('pathLayerManager', this.pathLayerManager);
        mapCustomEvents.addEvents(serviceLocator.eventManager);
        serviceLocator.eventManager.on('map.updateEnabledLayers', this.updateEnabledLayers);
        (serviceLocator.eventManager as EventManager).onEvent<MapUpdateLayerEventType>(
            'map.updateLayer',
            this.updateLayer
        );

        const contextMenu = document.getElementById('tr__main-map-context-menu');
        this.setState({
            contextMenu,
            contextMenuRoot: contextMenu ? createRoot(contextMenu) : undefined
        });
        serviceLocator.eventManager.on('map.updateLayers', this.updateLayers);
        serviceLocator.eventManager.on('map.addPopup', this.addPopup);
        serviceLocator.eventManager.on('map.removePopup', this.removePopup);
        serviceLocator.eventManager.on('map.updateFilter', this.updateFilter);
        serviceLocator.eventManager.on('map.clearFilter', this.clearFilter);
        serviceLocator.eventManager.on('map.showLayer', this.showLayer);
        serviceLocator.eventManager.on('map.hideLayer', this.hideLayer);
        serviceLocator.eventManager.on('map.paths.byAttribute.show', this.showPathsByAttribute);
        serviceLocator.eventManager.on('map.paths.byAttribute.hide', this.hidePathsByAttribute);
        serviceLocator.eventManager.on('map.paths.clearFilter', this.clearPathsFilter);
        serviceLocator.eventManager.on('map.fitBounds', this.fitBounds);
        serviceLocator.eventManager.on('map.setCenter', this.setCenter);
        serviceLocator.eventManager.on('map.enableBoxZoom', this.onEnableBoxZoom);
        serviceLocator.eventManager.on('map.disableBoxZoom', this.onDisableBoxZoom);
        serviceLocator.eventManager.on('map.enableDragPan', this.onEnableDragPan);
        serviceLocator.eventManager.on('map.disableDragPan', this.onDisableDragPan);
        serviceLocator.eventManager.on('map.showContextMenu', this.showContextMenu);
        serviceLocator.eventManager.on('map.hideContextMenu', this.hideContextMenu);
        serviceLocator.eventManager.on('map.handleDrawControl', this.handleDrawControl);
        serviceLocator.eventManager.on('map.deleteSelectedNodes', this.deleteSelectedNodes);
        serviceLocator.eventManager.on('map.deleteSelectedPolygon', this.onDeleteSelectedPolygon);
        serviceLocator.eventManager.on('collection.update.nodes', this.onNodesUpdatedHandler);
    };

    onDeleteSelectedPolygon = () => {
        polygonSelectionService.deleteSelectedPolygon();
    };

    onNodesUpdatedHandler = () => {
        polygonSelectionService.onNodesUpdated();
    };

    componentWillUnmount = () => {
        // Reset cursor classes hover state to prevent stale state on remount
        resetClasses();
        serviceLocator.removeService('layerManager');
        serviceLocator.removeService('pathLayerManager');
        mapCustomEvents.removeEvents(serviceLocator.eventManager);
        // Note: react-map-gl handles resize internally, so we don't need removeResizeListener
        serviceLocator.eventManager.off('map.updateEnabledLayers', this.updateEnabledLayers);
        serviceLocator.eventManager.off('map.updateLayer', this.updateLayer);
        serviceLocator.eventManager.off('map.updateLayers', this.updateLayers);
        serviceLocator.eventManager.off('map.addPopup', this.addPopup);
        serviceLocator.eventManager.off('map.removePopup', this.removePopup);
        serviceLocator.eventManager.off('map.updateFilter', this.updateFilter);
        serviceLocator.eventManager.off('map.clearFilter', this.clearFilter);
        serviceLocator.eventManager.off('map.showLayer', this.showLayer);
        serviceLocator.eventManager.off('map.hideLayer', this.hideLayer);
        serviceLocator.eventManager.off('map.paths.byAttribute.show', this.showPathsByAttribute);
        serviceLocator.eventManager.off('map.paths.byAttribute.hide', this.hidePathsByAttribute);
        serviceLocator.eventManager.off('map.paths.clearFilter', this.clearPathsFilter);
        serviceLocator.eventManager.off('map.fitBounds', this.fitBounds);
        serviceLocator.eventManager.off('map.setCenter', this.setCenter);
        serviceLocator.eventManager.off('map.enableBoxZoom', this.onEnableBoxZoom);
        serviceLocator.eventManager.off('map.disableBoxZoom', this.onDisableBoxZoom);
        serviceLocator.eventManager.off('map.enableDragPan', this.onEnableDragPan);
        serviceLocator.eventManager.off('map.disableDragPan', this.onDisableDragPan);
        serviceLocator.eventManager.off('map.showContextMenu', this.showContextMenu);
        serviceLocator.eventManager.off('map.hideContextMenu', this.hideContextMenu);
        serviceLocator.eventManager.off('map.handleDrawControl', this.handleDrawControl);
        serviceLocator.eventManager.off('map.deleteSelectedNodes', this.deleteSelectedNodes);
        serviceLocator.eventManager.off('map.deleteSelectedPolygon', this.onDeleteSelectedPolygon);
        serviceLocator.eventManager.off('collection.update.nodes', this.onNodesUpdatedHandler);

        // Remove map event listeners BEFORE react-map-gl cleans up
        // We need to do this early because react-map-gl will call map.remove() automatically
        // and if we try to remove listeners after that, it can cause errors
        const map = this.mapRef.current?.getMap();
        if (map && typeof map.off === 'function') {
            try {
                map.off('style.load', this.onStyleChange);
            } catch (error) {
                console.error('Error removing style.load event listener:', error);
            }
        }

        // react-map-gl automatically calls map.remove() during component unmount,
        // so we don't need to call it manually here
    };

    private executeEvents = (e, events: MapEventHandlerDescription[]) => {
        if (e.originalEvent && e.originalEvent.cancelBubble === true) {
            return;
        }
        for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
            const event = events[eventIndex];
            if (event.condition === undefined || event.condition(this.props.activeSection)) {
                event.handler(e);
            }
            if (e.originalEvent && e.originalEvent.cancelBubble === true) {
                break;
            }
        }
    };

    getEventHandler = (events: MapEventHandlerDescription[]) => {
        return (e) => this.executeEvents(e, events);
    };

    showLayer = (layerName: string) => {
        this.layerManager.showLayer(layerName);
    };

    hideLayer = (layerName: string) => {
        this.layerManager.hideLayer(layerName);
    };

    clearFilter = (layerName: string) => {
        this.layerManager.clearFilter(layerName);
    };

    updateFilter = (layerName: string, filter) => {
        this.layerManager.updateFilter(layerName, filter);
    };

    deleteSelectedNodes = () => {
        this.setState({
            confirmModalDeleteIsOpen: true
        });
    };

    onDeleteSelectedNodes = () => {
        serviceLocator.eventManager.emit('progress', { name: 'DeletingNodes', progress: 0.0 });
        const selectedNodes = serviceLocator.selectedObjectsManager.getSelection('nodes');

        deleteUnusedNodes(selectedNodes.map((n) => n.getId()))
            .then((_response) => {
                serviceLocator.selectedObjectsManager.deselect('nodes');
                serviceLocator.collectionManager.refresh('nodes');
                serviceLocator.eventManager.emit('map.updateLayers', {
                    transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson(),
                    transitNodesSelected: turfFeatureCollection([])
                });
            })
            .catch((error) => {
                // TODO Log errors
                console.error('Error deleting unused nodes', error);
            })
            .finally(() => {
                polygonSelectionService.deleteSelectedPolygon();
                serviceLocator.eventManager.emit('progress', { name: 'DeletingNodes', progress: 1.0 });
            });
    };

    handleDrawControl = (section: string) => {
        const map = this.mapRef.current?.getMap();
        if (!map) return;
        polygonSelectionService.handleSectionChange(map, section);
    };

    addPopup = (popupId: string, popup: maplibregl.Popup, removeAll = true) => {
        this.hideContextMenu();
        if (removeAll) {
            this.removeAllPopups();
        }
        this.popupManager.addPopup(popupId, popup);
    };

    removePopup = (popupId: string) => {
        this.popupManager.removePopup(popupId);
    };

    removeAllPopups = () => {
        this.popupManager.removeAllPopups();
    };

    updateLayer = (args: {
        layerName: string;
        data: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection);
    }) => {
        this.layerManager.updateLayer(args.layerName, args.data);
    };

    updateLayers = (geojsonByLayerName) => {
        this.layerManager.updateLayers(geojsonByLayerName);
    };

    updateEnabledLayers = (enabledLayers: string[]) => {
        this.layerManager.updateEnabledLayers(enabledLayers);
    };

    showContextMenu = (e, elements) => {
        const contextMenu = this.state.contextMenu;
        if (!contextMenu || !this.state.contextMenuRoot) {
            return;
        }
        contextMenu.style.left = e.point.x + 'px';
        contextMenu.style.top = e.point.y + 'px';
        contextMenu.style.display = 'block';

        this.state.contextMenuRoot.render(
            <ul>
                {elements.map((element) => (
                    <li
                        key={element.key ? element.key : element.title}
                        style={{ display: 'block', padding: '5px' }}
                        onClick={() => {
                            element.onClick();
                            contextMenu.style.display = 'none';
                        }}
                        onMouseOver={() => element.onHover && element.onHover()}
                    >
                        {this.props.t(element.title)}
                    </li>
                ))}
            </ul>
        );
    };

    hideContextMenu = () => {
        if (!this.state.contextMenu || !this.state.contextMenuRoot) {
            return;
        }
        const contextMenu = this.state.contextMenu;
        contextMenu.style.display = 'none';
        this.state.contextMenuRoot.render(<React.Fragment></React.Fragment>);
    };

    /**
     * Generate map style with tile sources
     */
    getMapStyle = (showAerial = false): MapStyleSpec => {
        const sources: Record<string, SourceSpecification> = {
            osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: this.props.t('main:map.osmAttribution')
            },
            // Full-world polygon for the darkening overlay
            overlay: {
                type: 'geojson',
                data: overlaySource
            }
        };

        const layers: LayerSpecification[] = [];

        // Add aerial source if configured
        if (this.aerialTilesUrl) {
            sources.aerial = {
                type: 'raster',
                tiles: [this.aerialTilesUrl],
                tileSize: 256,
                attribution: this.props.t('main:map.aerialAttribution')
            };
        }

        // Add the appropriate base layer
        // We add both layers to the style to allow switching without reloading the style
        // Only one layer is visible at a time to prevent loading both tile sets simultaneously
        const showOsm = !showAerial || !this.aerialTilesUrl;
        layers.push({
            id: 'osm',
            type: 'raster',
            source: 'osm',
            layout: {
                visibility: showOsm ? 'visible' : 'none'
            }
        });

        if (this.aerialTilesUrl) {
            layers.push({
                id: 'aerial',
                type: 'raster',
                source: 'aerial',
                minzoom: this.aerialMinZoom,
                maxzoom: this.aerialMaxZoom,
                layout: {
                    visibility: showAerial ? 'visible' : 'none'
                }
            });
        }

        // Semi-transparent black overlay to improve visibility of transit layers
        layers.push({
            id: 'base-overlay',
            type: 'fill',
            source: 'overlay',
            paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.5
            }
        });

        return {
            version: 8 as const,
            sources,
            layers
        };
    };

    /**
     * Check if current zoom is within aerial tiles range
     */
    isZoomInAerialRange = (zoom: number): boolean => {
        return zoom >= this.aerialMinZoom && zoom <= this.aerialMaxZoom;
    };

    /**
     * Handle zoom change - auto-switch tiles based on range and user preference.
     * Uses functional setState to avoid race conditions during rapid zoom updates.
     */
    handleZoomChange = (zoom: number) => {
        this.setState((prevState) => {
            // If no aerial tiles configured, just update zoom (keep showAerialTiles unchanged)
            if (!this.aerialTilesUrl) {
                return { currentZoom: zoom, showAerialTiles: prevState.showAerialTiles };
            }

            const inRange = this.isZoomInAerialRange(zoom);
            const wasInRange = this.isZoomInAerialRange(prevState.currentZoom);

            // Determine new showAerialTiles value based on previous state
            let showAerialTiles = prevState.showAerialTiles;

            if (prevState.userPreferredLayer === 'aerial' && inRange && !wasInRange) {
                // User prefers aerial and we just entered the valid range, switch to aerial
                showAerialTiles = true;
            } else if (prevState.showAerialTiles && !inRange) {
                // We're showing aerial and zoomed out of range, switch to OSM
                showAerialTiles = false;
            }

            return {
                currentZoom: zoom,
                showAerialTiles
            };
        });
    };

    handleLayerChange = (layerType: 'osm' | 'aerial') => {
        this.setState({
            showAerialTiles: layerType === 'aerial',
            userPreferredLayer: layerType // Remember user's preference
        });

        // Save preference to database
        Preferences.update(
            {
                'map.baseLayer': layerType
            },
            serviceLocator.socketEventManager
        );
    };

    /**
     * Create deck.gl layers based on the mappings configuration.
     * Layers are dynamically created from deckLayerMappings in deckLayers.config.ts.
     */
    getDeckLayers = (): LayersList => {
        if (!this.state.mapLoaded) return [];

        const enabledLayers = this.layerManager.getEnabledLayers();
        const map = this.mapRef.current?.getMap();
        const zoom = map?.getZoom() ?? 15;

        return createDeckLayersFromMappings(
            enabledLayers,
            (layerName) => this.layerManager.getLayerConfig(layerName),
            zoom
        );
    };

    /**
     * Setup map event handlers after map loads
     */
    setupMapEvents = () => {
        const map = this.mapRef.current?.getMap();
        if (!map) return;

        for (const eventName in this.mapEvents) {
            for (const layerName in this.mapEvents[eventName]) {
                if (layerName === 'map') {
                    map.on(eventName, this.getEventHandler(this.mapEvents[eventName][layerName]));
                } else {
                    // The 'as any' cast is required because MapLibre GL's TypeScript definitions
                    // don't support dynamic strings for the layer-specific on(type, layerName, handler) overload.
                    // The types expect a literal union type for the event name, but we iterate dynamically.
                    // Still an issue as of maplibre-gl v5.16.0 (verified Jan 2026).
                    map.on(eventName as any, layerName, this.getEventHandler(this.mapEvents[eventName][layerName]));
                }
            }
        }
        map.on('error', this.onMapError);

        // Listen for style changes (when switching between OSM and aerial)
        // and re-add the layers. 'style.load' fires once when the style is fully loaded,
        // unlike 'styledata' which fires multiple times during loading.
        map.on('style.load', this.onStyleChange);

        // If style is already loaded (e.g., on component re-render), call onStyleChange immediately.
        // This ensures controls are properly initialized at startup.
        if (map.isStyleLoaded()) {
            // Use setTimeout to ensure this runs after event listeners are set up
            setTimeout(() => {
                this.onStyleChange();
            }, 0);
        }
    };

    /**
     * Handle map style changes (when switching between base layers)
     * Re-initialize layers and controls after style is loaded
     */
    onStyleChange = () => {
        const map = this.mapRef.current?.getMap();
        if (!map || !map.isStyleLoaded()) return;

        // MapLibre automatically removes all controls when style changes
        // Check if control still exists by checking if its container is in the DOM
        const controlStillAttached = this.mapControlsMenu && this.mapControlsMenu.getContainer()?.parentNode !== null;

        if (controlStillAttached && this.mapControlsMenu) {
            // Control still exists, just update its callbacks
            this.mapControlsMenu.updateCallbacks({
                onLayerChange: this.handleLayerChange,
                getCurrentLayer: () => (this.state.showAerialTiles ? 'aerial' : 'osm'),
                isZoomInAerialRange: () => this.isZoomInAerialRange(this.state.currentZoom),
                getCurrentZoom: () => this.state.currentZoom,
                aerialTilesUrl: this.aerialTilesUrl,
                minZoom: this.aerialMinZoom,
                maxZoom: this.aerialMaxZoom
            });
        } else {
            // Control was removed by MapLibre, create a new one
            this.mapControlsMenu = new MapControlsMenu(this.props.t, {
                onLayerChange: this.handleLayerChange,
                getCurrentLayer: () => (this.state.showAerialTiles ? 'aerial' : 'osm'),
                isZoomInAerialRange: () => this.isZoomInAerialRange(this.state.currentZoom),
                getCurrentZoom: () => this.state.currentZoom,
                aerialTilesUrl: this.aerialTilesUrl,
                minZoom: this.aerialMinZoom,
                maxZoom: this.aerialMaxZoom
            });
            map.addControl(this.mapControlsMenu, 'top-right');
        }

        // Re-enable the layers for the current section
        // We prefer to use the layer manager's enabled layers if available, to preserve any dynamically added layers
        // (like accessibility polygons) that are not in this.state.layers
        const currentEnabledLayers = this.layerManager.getEnabledLayers();
        const layersToCheck =
            currentEnabledLayers && currentEnabledLayers.length > 0 ? currentEnabledLayers : this.state.layers;

        // Optimization: If the style change was just a property update (e.g. layout property change),
        // the layers might still be there. If so, we skip the remove/add cycle which can cause crashes
        // with DeckGL or other controls.
        if (layersToCheck.length > 0 && map.getLayer(layersToCheck[0])) {
            return;
        }

        if (currentEnabledLayers && currentEnabledLayers.length > 0) {
            this.layerManager.updateEnabledLayers(currentEnabledLayers);
        } else {
            this.layerManager.updateEnabledLayers(this.state.layers);
        }
    };

    render() {
        return (
            <MapRenderer
                mapRef={this.mapRef}
                defaultCenter={this.defaultCenter}
                defaultZoom={this.defaultZoomArray[0]}
                mapLoaded={this.state.mapLoaded}
                getMapStyle={this.getMapStyle}
                getDeckLayers={this.getDeckLayers}
                setupMapEvents={this.setupMapEvents}
                setMap={this.setMap}
                confirmModalDeleteIsOpen={this.state.confirmModalDeleteIsOpen}
                onDeleteSelectedNodes={this.onDeleteSelectedNodes}
                showAerialTiles={this.state.showAerialTiles}
                handleZoomChange={this.handleZoomChange}
                closeModal={() => this.setState({ confirmModalDeleteIsOpen: false })}
            >
                {this.props.children}
            </MapRenderer>
        );
    }
}

export default withTranslation(['transit', 'main'])(MainMap);
