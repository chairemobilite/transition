/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// External packages
import React, { PropsWithChildren, useRef, useState, useEffect, useMemo } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WithTranslation, withTranslation } from 'react-i18next';
import _cloneDeep from 'lodash/cloneDeep';
import MapLibreMap, {
    MapRef,
    useControl,
    SourceSpecification,
    LayerSpecification,
    ScaleControl
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Position } from '@deck.gl/core';
import type { LayersList } from '@deck.gl/core';
import { default as elementResizedEvent, unbind as removeResizeListener } from 'element-resize-event';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

// chaire-lib imports
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import config from 'chaire-lib-frontend/lib/config/project.config';
import { findOverlappingFeatures } from 'chaire-lib-common/lib/services/geodata/FindOverlappingFeatures';
import { hexToRgbArray } from 'chaire-lib-common/lib/utils/ColorUtils';
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
import MapPopupManager from 'chaire-lib-frontend/lib/services/map/MapPopupManager';
import { getMapBoxDraw, removeMapBoxDraw } from 'chaire-lib-frontend/lib/services/map/MapPolygonService';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

// transition imports
import Node from 'transition-common/lib/services/nodes/Node';

// Local workspace imports
import layersConfig, { sectionLayers } from '../../config/layers.config';
import transitionMapEvents from '../../services/map/events';
import mapCustomEvents from '../../services/map/events/MapRelatedCustomEvents';
import PathMapLayerManager from '../../services/map/PathMapLayerManager';
import { deleteUnusedNodes } from '../../services/transitNodes/transitNodesUtils';
import MapControlsMenu from './TransitionMapControlsMenu';
import AnimatedArrowPathExtension from './AnimatedArrowPathExtension';
import CircleSpinnerExtension from './CircleSpinnerExtension';

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

/** Map style specification returned by getMapStyle */
type MapStyleSpec = {
    version: 8;
    sources: Record<string, SourceSpecification>;
    layers: LayerSpecification[];
};

/**
 * DeckGL Overlay Control Component for Animated Selected Paths and Nodes (custom shaders)
 */
const DeckGLControl: React.FC<{
    layers: LayersList;
}> = ({ layers }) => {
    const overlayRef = useRef<MapboxOverlay | null>(null);

    useControl(() => {
        overlayRef.current = new MapboxOverlay({
            interleaved: true,
            _animate: true,
            useDevicePixels: true,
            layers
        });
        return overlayRef.current;
    });

    useEffect(() => {
        if (overlayRef.current) {
            overlayRef.current.setProps({ layers });
        }
    }, [layers]);

    return null;
};

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
    private mapContainer;
    private draw: MapboxDraw | undefined;
    private mapRef: React.RefObject<MapRef | null>;
    private mapControlsMenu: MapControlsMenu | undefined;
    private aerialTilesUrl: string | undefined;
    private aerialMinZoom: number = 0;
    private aerialMaxZoom: number = 22;

    constructor(props: MainMapProps & WithTranslation) {
        super(props);

        // Get user's preferred base layer from preferences
        const preferredBaseLayer = (Preferences.get('map.preferredBaseLayer', 'osm') as 'osm' | 'aerial') || 'osm';

        this.state = {
            layers: sectionLayers[this.props.activeSection] || [], // Get layers for section from config
            confirmModalDeleteIsOpen: false,
            mapLoaded: false,
            contextMenu: null,
            contextMenuRoot: undefined,
            showAerialTiles: preferredBaseLayer === 'aerial',
            currentZoom: props.zoom,
            userPreferredLayer: preferredBaseLayer
        };

        this.defaultZoomArray = [props.zoom];
        this.defaultCenter = props.center;
        this.layerManager = new MapLayerManager(layersConfig);
        this.pathLayerManager = new PathMapLayerManager(this.layerManager);

        this.popupManager = new MapPopupManager();
        this.mapContainer = HTMLElement;
        this.mapEvents = {};
        this.map = undefined;
        this.mapRef = React.createRef<MapRef>();

        // Read aerial tiles configuration from environment variables or config file
        // Webpack injects process.env values at build time, with fallback to config values
        // We also check the config object at runtime as a fallback
        this.aerialTilesUrl =
            process.env.CUSTOM_RASTER_TILES_XYZ_URL || (config as any).customRasterTilesXyzUrl || undefined;

        // Parse zoom values with validation to ensure they're finite numbers
        const parseZoom = (value: string | number | undefined, defaultValue: number): number => {
            if (value === undefined || value === null || value === '') {
                return defaultValue;
            }
            const parsed = typeof value === 'number' ? value : parseFloat(value);
            return Number.isFinite(parsed) ? parsed : defaultValue;
        };

        const minZoomValue = process.env.CUSTOM_RASTER_TILES_MIN_ZOOM ?? (config as any).customRasterTilesMinZoom;
        const maxZoomValue = process.env.CUSTOM_RASTER_TILES_MAX_ZOOM ?? (config as any).customRasterTilesMaxZoom;
        this.aerialMinZoom = parseZoom(minZoomValue, 0);
        this.aerialMaxZoom = parseZoom(maxZoomValue, 22);

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
        console.log('Map error:', e);
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

        // Set up resize listener on the actual map container
        const mapContainer = map.getContainer();
        if (mapContainer) {
            this.mapContainer = mapContainer;
            elementResizedEvent(mapContainer, this.onResizeContainer);
        }

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

        // Call onStyleChange if style is already loaded, or wait for it
        if (map.isStyleLoaded()) {
            // Use setTimeout to ensure this runs after the control is added
            setTimeout(() => {
                this.onStyleChange();
            }, 0);
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
        // Note: Container resize listener is set up in setMap() to handle panel layout changes
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
        serviceLocator.eventManager.on('map.deleteSelectedPolygon', this.deleteSelectedPolygon);
    };

    componentWillUnmount = () => {
        serviceLocator.removeService('layerManager');
        serviceLocator.removeService('pathLayerManager');
        mapCustomEvents.removeEvents(serviceLocator.eventManager);
        // Note: Container resize listener cleanup is done below after event manager cleanup
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
        serviceLocator.eventManager.off('map.deleteSelectedPolygon', this.deleteSelectedPolygon);

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

        // Remove resize listener if it was set up
        if (this.mapContainer && typeof this.mapContainer !== 'function') {
            removeResizeListener(this.mapContainer, this.onResizeContainer);
        }

        // react-map-gl automatically calls map.remove() during component unmount,
        // so we don't need to call it manually here
    };

    onResizeContainer = () => {
        // react-map-gl handles resize automatically, but we can manually trigger if needed
        const map = this.mapRef.current?.getMap();
        if (map) {
            map.resize();
        }
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

    setRef = (ref) => {
        this.mapContainer = ref;
    };

    setDrawPolygonService = () => {
        const map = this.mapRef.current?.getMap();
        if (!map) return;
        this.draw = getMapBoxDraw(
            map,
            (data) => {
                this.modeChangePolygonService(data);
            },
            (polygon) => {
                this.handleDrawPolygonService(polygon);
            },
            (_polygon) => {
                // Delete callback: clear selection when polygon is deleted
                this.deleteSelectedPolygon();
            },
            (polygon) => {
                // Update callback: re-select nodes when polygon is modified (e.g., dragged)
                this.handleDrawPolygonService(polygon);
            }
        );
    };

    /**
     * In the nodes active section, if you click on the map a new node will be create
     * If the user click on the tool for draw a polygon,
     * selectedNodes will put a value that will prevent a new node to be create
     * If the user click again on the tool for draw a polygon and selectedNodes doesn't contain nodes (type object)
     * selectedNodes will be clear so a new node can be create
     * @param {object} data The next mode, i.e. the mode that Draw is changing to (from mapbox-gl-draw API.md)
     */
    modeChangePolygonService = (data) => {
        if (data.mode && data.mode === 'draw_polygon') {
            serviceLocator.selectedObjectsManager.setSelection('nodes', ['draw_polygon']); // this is a hack to put a virtual selected node
        } else {
            const selectedNodes = serviceLocator.selectedObjectsManager.getSingleSelection('nodes');
            if (selectedNodes && typeof selectedNodes !== 'object' && data.mode && data.mode === 'simple_select') {
                serviceLocator.selectedObjectsManager.deselect('nodes');
            }
        }
    };

    handleDrawPolygonService = (polygon) => {
        if (this.props.activeSection === 'nodes') {
            const allNodes = serviceLocator.collectionManager.get('nodes').getFeatures();
            const nodesInPolygon = findOverlappingFeatures(polygon, allNodes);
            const selectedNodes = nodesInPolygon
                .map((node) => {
                    return new Node(node.properties || {}, false, serviceLocator.collectionManager);
                })
                .filter((node) => {
                    return node.get('is_frozen', false) === false && !node.wasFrozen();
                });
            const geojson = selectedNodes.map((node) => {
                return _cloneDeep(node.toGeojson());
            });

            serviceLocator.eventManager.emit('map.updateLayers', {
                transitNodesSelected: turfFeatureCollection(geojson)
            });
            serviceLocator.selectedObjectsManager.setSelection('nodes', selectedNodes);
            serviceLocator.selectedObjectsManager.setSelection('isContainSelectedFrozenNodes', [
                selectedNodes.length !== nodesInPolygon.length
            ]);
            serviceLocator.selectedObjectsManager.setSelection('isDrawPolygon', [true]);
        }
    };

    deleteSelectedPolygon = () => {
        if (this.draw) {
            this.draw.deleteAll().getAll();
        }
        serviceLocator.selectedObjectsManager.deselect('nodes');
        serviceLocator.selectedObjectsManager.deselect('isContainSelectedFrozenNodes');
        serviceLocator.selectedObjectsManager.deselect('isDrawPolygon');
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodesSelected: turfFeatureCollection([]),
            transitNodes250mRadius: turfFeatureCollection([]),
            transitNodes500mRadius: turfFeatureCollection([]),
            transitNodes750mRadius: turfFeatureCollection([]),
            transitNodes1000mRadius: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([])
        });
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
                console.log('Error deleting unused nodes', error);
            })
            .finally(() => {
                this.deleteSelectedPolygon();
                serviceLocator.eventManager.emit('progress', { name: 'DeletingNodes', progress: 1.0 });
            });
    };

    handleDrawControl = (section: string) => {
        const map = this.mapRef.current?.getMap();
        if (!map) return;
        if (section === 'nodes' && !this.draw) {
            this.setDrawPolygonService();
        } else if (section !== 'nodes' && this.draw) {
            this.deleteSelectedPolygon();
            removeMapBoxDraw(map, this.draw);
            this.draw = null;
        }
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
        //console.log('updating map layers', Object.keys(geojsonByLayerName));
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
                attribution: '© OpenStreetMap contributors'
            }
        };

        const layers: LayerSpecification[] = [];

        // Add aerial source if configured
        if (this.aerialTilesUrl) {
            sources.aerial = {
                type: 'raster',
                tiles: [this.aerialTilesUrl],
                tileSize: 256,
                attribution: 'Aerial imagery'
            };
        }

        // Add the appropriate base layer
        if (showAerial && this.aerialTilesUrl) {
            layers.push({
                id: 'aerial',
                type: 'raster',
                source: 'aerial',
                minzoom: this.aerialMinZoom,
                maxzoom: this.aerialMaxZoom
            });
        } else {
            layers.push({
                id: 'osm',
                type: 'raster',
                source: 'osm'
            });
        }

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
     * Uses functional setState to avoid race conditions under rapid zoom updates.
     */
    handleZoomChange = (zoom: number) => {
        if (!this.aerialTilesUrl) {
            this.setState({ currentZoom: zoom });
            return;
        }

        this.setState((prevState): Pick<MainMapState, 'showAerialTiles' | 'currentZoom'> | null => {
            const inRange = this.isZoomInAerialRange(zoom);
            const wasInRange = this.isZoomInAerialRange(prevState.currentZoom);

            // If user prefers aerial and we just entered the valid range, switch to aerial
            if (prevState.userPreferredLayer === 'aerial' && inRange && !wasInRange) {
                return {
                    showAerialTiles: true,
                    currentZoom: zoom
                };
            }

            // If we're showing aerial and zoom out of range, switch to OSM
            if (prevState.showAerialTiles && !inRange) {
                return {
                    showAerialTiles: false,
                    currentZoom: zoom
                };
            }

            // Otherwise just update zoom (no-op if zoom hasn't changed)
            if (prevState.currentZoom !== zoom) {
                return {
                    showAerialTiles: prevState.showAerialTiles,
                    currentZoom: zoom
                };
            }

            // No state change needed
            return null;
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
                'map.preferredBaseLayer': layerType
            },
            serviceLocator.socketEventManager
        );
    };

    /**
     * Create deck.gl layers for selected paths and nodes
     */
    getDeckLayers = (): LayersList => {
        if (!this.state.mapLoaded) return [];

        const layers: LayersList = [];

        // Get selected paths from layer manager
        const selectedPathsLayer = this.layerManager.getLayerConfig('transitPathsSelected');
        if (
            selectedPathsLayer &&
            selectedPathsLayer.source.data &&
            selectedPathsLayer.source.data.features.length > 0
        ) {
            layers.push(
                new PathLayer({
                    id: 'selected-paths-animated',
                    data: selectedPathsLayer.source.data.features,
                    antialias: true,
                    highPrecision: true,
                    getPath: (feature: GeoJSON.Feature<GeoJSON.LineString>) => {
                        return feature.geometry.coordinates as Position[];
                    },
                    getColor: (feature: GeoJSON.Feature<GeoJSON.LineString>) => {
                        return hexToRgbArray(feature.properties?.color, '#0000ff');
                    },
                    getWidth: 12,
                    widthUnits: 'pixels',
                    widthMinPixels: 4,
                    widthMaxPixels: 12,
                    capRounded: true,
                    jointRounded: true,
                    pickable: false,
                    extensions: [new AnimatedArrowPathExtension()],
                    updateTriggers: {
                        getPath: [selectedPathsLayer.source.data],
                        getColor: [selectedPathsLayer.source.data]
                    }
                })
            );
        }

        // Get selected nodes from layer manager
        const selectedNodesLayer = this.layerManager.getLayerConfig('transitNodesSelected');
        if (
            selectedNodesLayer &&
            selectedNodesLayer.source.data &&
            selectedNodesLayer.source.data.features.length > 0
        ) {
            const map = this.mapRef.current?.getMap();
            const zoom = map?.getZoom() || 15;

            // Calculate radius based on zoom level (exponential interpolation like MapLibre)
            // Matches: ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 2, 15, 12, 20, 23]
            // TODO: This formula may not exactly match MapLibre's exponential interpolation.
            // The correct formula should ensure exact endpoints. Current appearance is acceptable,
            // but may need revisiting if visual discrepancies are noticed at different zoom levels.
            let radius: number;
            if (zoom <= 10) {
                // radius = start + (stop - start) * Math.pow(2, (zoom - startZoom) / (stopZoom - startZoom))
                radius = 0 + (2 - 0) * Math.pow(2, (zoom - 0) / (10 - 0));
            } else if (zoom <= 15) {
                radius = 2 + (12 - 2) * Math.pow(2, (zoom - 10) / (15 - 10));
            } else if (zoom <= 20) {
                radius = 12 + (23 - 12) * Math.pow(2, (zoom - 15) / (20 - 15));
            } else {
                radius = 23 + (zoom - 20) * 2; // Linear beyond zoom 20
            }

            layers.push(
                new ScatterplotLayer({
                    id: 'selected-nodes-spinner',
                    data: selectedNodesLayer.source.data.features,
                    getPosition: (feature: GeoJSON.Feature<GeoJSON.Point>) => {
                        return feature.geometry.coordinates as Position;
                    },
                    getRadius: radius,
                    radiusUnits: 'pixels',
                    radiusMinPixels: 2,
                    radiusMaxPixels: 50,
                    getFillColor: (feature: GeoJSON.Feature<GeoJSON.Point>) => {
                        return hexToRgbArray(feature.properties?.color, '#0088ff');
                    },
                    // No base border - the shader creates the animated white border
                    stroked: false,
                    pickable: false,
                    extensions: [new CircleSpinnerExtension()],
                    updateTriggers: {
                        getPosition: [selectedNodesLayer.source.data],
                        getFillColor: [selectedNodesLayer.source.data]
                    }
                })
            );
        }

        return layers;
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
                    map.on(eventName as any, layerName, this.getEventHandler(this.mapEvents[eventName][layerName]));
                }
            }
        }
        map.on('error', this.onMapError);

        // Listen for style changes (when switching between OSM and aerial)
        // and re-add the layers
        // Use 'style.load' instead of 'styledata' to ensure style is fully loaded
        map.on('style.load', this.onStyleChange);

        // Also listen for 'styledata' as a fallback
        map.on('styledata', () => {
            if (map.isStyleLoaded()) {
                this.onStyleChange();
            }
        });

        // If style is already loaded, call onStyleChange immediately
        // This ensures controls are properly initialized at startup
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
        this.layerManager.updateEnabledLayers(this.state.layers);
    };

    render() {
        return (
            <MapRenderer
                mapRef={this.mapRef}
                defaultCenter={this.defaultCenter}
                defaultZoom={this.defaultZoomArray[0]}
                mapLoaded={this.state.mapLoaded}
                layerManager={this.layerManager}
                getMapStyle={this.getMapStyle}
                getDeckLayers={this.getDeckLayers}
                setupMapEvents={this.setupMapEvents}
                setMap={this.setMap}
                confirmModalDeleteIsOpen={this.state.confirmModalDeleteIsOpen}
                onDeleteSelectedNodes={this.onDeleteSelectedNodes}
                showAerialTiles={this.state.showAerialTiles}
                handleZoomChange={this.handleZoomChange}
                t={this.props.t}
                closeModal={() => this.setState({ confirmModalDeleteIsOpen: false })}
            >
                {this.props.children}
            </MapRenderer>
        );
    }
}

/**
 * Functional component wrapper for MapLibreMap to handle hooks
 */
const MapRenderer: React.FC<{
    mapRef: React.RefObject<MapRef | null>;
    defaultCenter: [number, number];
    defaultZoom: number;
    mapLoaded: boolean;
    layerManager: MapLayerManager;
    getMapStyle: (showAerial?: boolean) => MapStyleSpec;
    getDeckLayers: () => LayersList;
    setupMapEvents: () => void;
    setMap: () => void;
    confirmModalDeleteIsOpen: boolean;
    showAerialTiles: boolean;
    handleZoomChange: (zoom: number) => void;
    children: React.ReactNode;
    onDeleteSelectedNodes: () => void;
    t: (key: string) => string;
    closeModal: () => void;
}> = ({
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
    t,
    closeModal,
    children
}) => {
    const [viewState, setViewState] = useState({
        longitude: defaultCenter[0],
        latitude: defaultCenter[1],
        zoom: defaultZoom
    });

    // Track zoom level and layer updates for deck.gl layer updates
    const [zoom, setZoom] = useState(defaultZoom);

    // Use ref to hold the latest handleZoomChange callback to avoid unstable dependency
    const handleZoomChangeRef = useRef(handleZoomChange);
    handleZoomChangeRef.current = handleZoomChange;

    // Update zoom state when view changes and notify parent
    useEffect(() => {
        setZoom(viewState.zoom);
        handleZoomChangeRef.current(viewState.zoom);
    }, [viewState.zoom]);
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
        const eventManager = serviceLocator.eventManager;
        eventManager.on('map.updateLayers', updateDeckLayers);
        eventManager.on('map.layers.updated', updateDeckLayers);
        eventManager.on('map.updateLayer', updateDeckLayers); // For individual layer updates during drag
        eventManager.on('selected.drag.node', updateDeckLayers); // Update during node drag

        return () => {
            eventManager.off('map.updateLayers', updateDeckLayers);
            eventManager.off('map.layers.updated', updateDeckLayers);
            eventManager.off('map.updateLayer', updateDeckLayers);
            eventManager.off('selected.drag.node', updateDeckLayers);
        };
    }, [mapLoaded, zoom]);

    // Update map style when layer changes
    const mapStyle = useMemo(() => getMapStyle(showAerialTiles), [showAerialTiles]); // getMapStyle is stable

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
                {/* DeckGL overlay for animated selected paths and nodes */}
                <DeckGLControl layers={deckLayers} />
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

export default withTranslation(['transit', 'main'])(MainMap);
