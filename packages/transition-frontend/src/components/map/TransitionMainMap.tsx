/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// External packages
import _debounce from 'lodash/debounce';
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
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
import MapPopupManager from 'chaire-lib-frontend/lib/services/map/MapPopupManager';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

// Local workspace imports
import layersConfig, { sectionLayers, overlaySource } from '../../config/layers.config';
import pathWaypointZoomSync, {
    MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT,
    MapUpdateLayersMinZoomPayload
} from '../../services/map/PathWaypointZoomSync';
import { polygonSelectionService } from '../../services/map/PolygonSelectionService';
import transitionMapEvents from '../../services/map/events';
import mapCustomEvents from '../../services/map/events/MapRelatedCustomEvents';
import PathMapLayerManager from '../../services/map/PathMapLayerManager';
import { deleteUnusedNodes } from '../../services/transitNodes/transitNodesUtils';
import MapRenderer, { MapStyleSpec } from './MapRenderer';
import { createDeckLayersFromMappings } from '../../config/deckLayers.config';
import { resetClasses } from '../../services/map/MapCursorHelper';
import type { ProjectMapBasemapShortname } from 'chaire-lib-common/lib/config/mapBaseLayersProject.types';
import {
    DEFAULT_FALLBACK_BASEMAP_SHORTNAME,
    formatRasterBasemapAttribution,
    getMaxConfiguredRasterBasemapZoom,
    getValidBasemapShortnames,
    getZoomBoundsForBasemapShortname,
    getZoomBoundsForOsMFallbackBasemap,
    OSM_DEFAULT_LAYER
} from '../../config/projectBaseMapLayers';

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
    currentZoom: number;
    userPreferredBasemapShortname: ProjectMapBasemapShortname;
    activeBasemapShortname: ProjectMapBasemapShortname;
    /** Overlay opacity as a percentage (0–100) */
    overlayOpacity: number;
    /** Overlay color: 'black' or 'white' */
    overlayColor: 'black' | 'white';
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
    /** Debounced save for overlay opacity to avoid flooding the server on slider drag */
    private debouncedSaveOverlayOpacity: ReturnType<typeof _debounce>;

    constructor(props: MainMapProps & WithTranslation) {
        super(props);

        const savedBasemapShortname =
            (Preferences.get('map.basemapShortname', undefined) as ProjectMapBasemapShortname | undefined) || 'osm';
        const validNames: string[] = getValidBasemapShortnames();
        const basemapShortname: ProjectMapBasemapShortname = validNames.includes(savedBasemapShortname)
            ? savedBasemapShortname
            : 'osm';

        // Get user's preferred overlay opacity from preferences (0–100, default 50)
        const overlayOpacity = Preferences.get('map.overlayOpacity', 50) as number;

        // Get user's preferred overlay color from preferences (default 'black')
        const overlayColor = Preferences.get('map.overlayColor', 'black') as 'black' | 'white';

        const prefZoomBounds = getZoomBoundsForBasemapShortname(basemapShortname);
        let initialActiveBasemapShortname = basemapShortname;
        if (prefZoomBounds && (props.zoom < prefZoomBounds.min || props.zoom > prefZoomBounds.max)) {
            initialActiveBasemapShortname = DEFAULT_FALLBACK_BASEMAP_SHORTNAME;
        }

        this.state = {
            layers: sectionLayers[this.props.activeSection] || [], // Get layers for section from config
            confirmModalDeleteIsOpen: false,
            mapLoaded: false,
            contextMenu: null,
            contextMenuRoot: undefined,
            currentZoom: props.zoom,
            userPreferredBasemapShortname: basemapShortname,
            activeBasemapShortname: initialActiveBasemapShortname,
            overlayOpacity,
            overlayColor
        };

        // Debounce the server save for overlay opacity (400ms) to avoid flooding on slider drag
        this.debouncedSaveOverlayOpacity = _debounce((opacity: number) => {
            Preferences.update({ 'map.overlayOpacity': opacity }, serviceLocator.socketEventManager);
        }, 400);

        this.defaultZoomArray = [props.zoom];
        this.defaultCenter = props.center;
        this.layerManager = new MapLayerManager(layersConfig);
        this.pathLayerManager = new PathMapLayerManager(this.layerManager);

        this.popupManager = new MapPopupManager();
        this.mapEvents = {};
        this.map = undefined;
        this.mapRef = React.createRef<MapRef>();

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
        // Trigger an initial generic min-zoom update for any layer whose min zoom
        // is driven by a preference (e.g. path waypoints).
        pathWaypointZoomSync.applyNow(serviceLocator.eventManager);

        this.setState({ mapLoaded: true });
        serviceLocator.eventManager.emit('map.loaded');
    };

    /** Generic handler: update the minzoom of the given map layers. */
    updateLayersMinZoom = (payload: MapUpdateLayersMinZoomPayload) => {
        this.layerManager.updateLayersMinZoom(payload.layerNames, payload.minZoom);
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
        serviceLocator.eventManager.on(MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT, this.updateLayersMinZoom);
        pathWaypointZoomSync.start(serviceLocator.eventManager);
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

        // Cancel any pending debounced save to avoid post-unmount side-effects
        this.debouncedSaveOverlayOpacity.cancel();

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
        serviceLocator.eventManager.off(MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT, this.updateLayersMinZoom);
        pathWaypointZoomSync.stop();

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
     * Minimal style for OSM + dimming overlay. Project basemaps replace the whole style via `setStyle` in MapRenderer.
     */
    getMapStyle = (): MapStyleSpec => {
        const sources: Record<string, SourceSpecification> = {
            overlay: {
                type: 'geojson',
                data: overlaySource
            }
        };

        const layers: LayerSpecification[] = [];

        sources[OSM_DEFAULT_LAYER.shortname] = {
            type: 'raster',
            tiles: [OSM_DEFAULT_LAYER.url],
            tileSize: 256,
            attribution: formatRasterBasemapAttribution(OSM_DEFAULT_LAYER, this.props.t)
        };
        layers.push({
            id: OSM_DEFAULT_LAYER.shortname,
            type: 'raster',
            source: OSM_DEFAULT_LAYER.shortname
        });

        // Semi-transparent overlay to improve visibility of transit layers
        layers.push({
            id: 'base-overlay',
            type: 'fill',
            source: 'overlay',
            paint: {
                'fill-color': this.state.overlayColor === 'white' ? '#ffffff' : '#000000',
                'fill-opacity': this.state.overlayOpacity / 100
            }
        });

        return {
            version: 8 as const,
            sources,
            layers
        };
    };

    /**
     * When the preferred basemap has a zoom range, show it only inside that range; otherwise show OSM.
     */
    handleZoomChange = (zoom: number) => {
        this.setState((prevState) => {
            let activeBasemapShortname = prevState.activeBasemapShortname;
            const pref = prevState.userPreferredBasemapShortname;

            const osmFallbackBounds = getZoomBoundsForOsMFallbackBasemap(pref);
            if (osmFallbackBounds) {
                const inR = zoom >= osmFallbackBounds.min && zoom <= osmFallbackBounds.max;
                if (inR) {
                    activeBasemapShortname = pref;
                } else if (activeBasemapShortname === pref) {
                    activeBasemapShortname = DEFAULT_FALLBACK_BASEMAP_SHORTNAME;
                }
            }

            return {
                currentZoom: zoom,
                activeBasemapShortname
            };
        });
    };

    handleLayerChange = (layerType: ProjectMapBasemapShortname) => {
        const zoom = this.state.currentZoom;
        const bounds = getZoomBoundsForBasemapShortname(layerType);
        let activeBasemapShortname = layerType;
        if (bounds && (zoom < bounds.min || zoom > bounds.max)) {
            activeBasemapShortname = DEFAULT_FALLBACK_BASEMAP_SHORTNAME;
        }

        this.setState({
            userPreferredBasemapShortname: layerType,
            activeBasemapShortname
        });

        // Save preference to database (`map.basemapShortname` matches Preferences.get / defaultPreferences.map)
        Preferences.update(
            {
                'map.basemapShortname': layerType
            },
            serviceLocator.socketEventManager
        );
    };

    /** Handle overlay opacity change from the slider (0–100) */
    handleOverlayOpacityChange = (opacity: number) => {
        // Update UI immediately for responsiveness
        this.setState({ overlayOpacity: opacity });

        // Debounced save to avoid flooding the server during slider drag
        this.debouncedSaveOverlayOpacity(opacity);
    };

    /** Handle overlay color change */
    handleOverlayColorChange = (color: 'black' | 'white') => {
        this.setState({ overlayColor: color });

        // Save preference to database
        Preferences.update(
            {
                'map.overlayColor': color
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

        // Listen for style changes (when switching base layers)
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
        if (!map) return;

        /**
         * `style.load` runs when the new style JSON is applied; `map.isStyleLoaded()` stays false until
         * tiles, updated sources, and sprites satisfy Style.loaded() in maplibre-gl. Running our
         * GeoJSON re-attach only after `isStyleLoaded()` avoids silent skips on vector basemaps; we
         * may need several `idle` callbacks before that becomes true.
         */
        const MAX_STYLE_READY_RETRIES = 20;
        let retries = 0;
        const tryApplyWhenReady = (): void => {
            const m = this.mapRef.current?.getMap();
            if (!m) return;
            if (!m.isStyleLoaded()) {
                retries++;
                if (retries > MAX_STYLE_READY_RETRIES) {
                    console.warn(
                        `Map style did not finish loading after ${MAX_STYLE_READY_RETRIES} idle cycles, proceeding anyway`
                    );
                    serviceLocator.eventManager.emit('progressClear', { name: 'MapStyleSwitch' });
                    return;
                }
                m.once('idle', tryApplyWhenReady);
                return;
            }

            const currentEnabledLayers = this.layerManager.getEnabledLayers();
            this.layerManager.updateEnabledLayers(
                currentEnabledLayers.length > 0 ? currentEnabledLayers : this.state.layers
            );
            serviceLocator.eventManager.emit('progress', { name: 'MapStyleSwitch', progress: 1.0 });
        };

        tryApplyWhenReady();
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
                activeBasemapShortname={this.state.activeBasemapShortname}
                currentZoom={this.state.currentZoom}
                overlayOpacity={this.state.overlayOpacity}
                overlayColor={this.state.overlayColor}
                maxRasterBasemapZoom={getMaxConfiguredRasterBasemapZoom()}
                handleZoomChange={this.handleZoomChange}
                onLayerChange={this.handleLayerChange}
                onOverlayOpacityChange={this.handleOverlayOpacityChange}
                onOverlayColorChange={this.handleOverlayColorChange}
                closeModal={() => this.setState({ confirmModalDeleteIsOpen: false })}
            >
                {this.props.children}
            </MapRenderer>
        );
    }
}

export default withTranslation(['main', 'transit'])(MainMap);
