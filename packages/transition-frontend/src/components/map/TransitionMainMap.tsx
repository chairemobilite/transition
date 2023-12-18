/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { createRef, PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { WithTranslation, withTranslation } from 'react-i18next';
import ReactDom from 'react-dom';
import DeckGL from '@deck.gl/react/typed';
import { FilterContext, Layer, Deck } from '@deck.gl/core/typed';

import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import MapboxGL from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import _debounce from 'lodash/debounce';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import layersConfig from '../../config/layers.config';
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import transitionMapEvents from '../../services/map/events';
import mapCustomEvents from '../../services/map/events/MapRelatedCustomEvents';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
import PathMapLayerManager from '../../services/map/PathMapLayerManager';
import MapPopupManager from 'chaire-lib-frontend/lib/services/map/MapPopupManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { getMapBoxDraw, removeMapBoxDraw } from 'chaire-lib-frontend/lib/services/map/MapPolygonService';
import { findOverlappingFeatures } from 'chaire-lib-common/lib/services/geodata/FindOverlappingFeatures';
import Node from 'transition-common/lib/services/nodes/Node';

import _cloneDeep from 'lodash/cloneDeep';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import { deleteUnusedNodes } from '../../services/transitNodes/transitNodesUtils';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import {
    layerEventNames,
    tooltipEventNames,
    MapEventHandlerDescriptor,
    MapLayerEventHandlerDescriptor,
    mapEventNames,
    PointInfo,
    TooltipEventHandlerDescriptor,
    MapSelectEventHandlerDescriptor,
    MapCallbacks
} from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import getLayer from './layers/TransitionMapLayer';
import { PickingInfo } from 'deck.gl/typed';

import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { MjolnirEvent, MjolnirGestureEvent } from 'mjolnir.js';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MainMapProps extends LayoutSectionProps {
    zoom: number;
    center: [number, number];
    //onMapDataChange: () => void;
    // TODO : put layers and events together in an application configuration received as props here
    // layersConfig: { [key: string]: any };
    // mapEvents: MapEventHandlerDescription[];
    // customEvents: any;
}

interface MainMapState {
    viewState: {
        longitude: number;
        latitude: number;
        zoom: number;
        pitch: number;
        bearing: number;
    };
    enabledLayers: string[];
    mapStyleURL: string;
    xyzTileLayer?: Layer; // Temporary! Move this somewhere else
    isDragging: boolean;
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
    private mapEvents: {
        map: { [evtName in mapEventNames]?: MapEventHandlerDescriptor[] };
        layers: {
            [layerName: string]: {
                [evtName in layerEventNames]?: MapLayerEventHandlerDescriptor[];
            };
        };
        tooltips: {
            [layerName: string]: {
                [evtName in tooltipEventNames]?: TooltipEventHandlerDescriptor[];
            };
        };
        mapSelect: {
            [layerName: string]: {
                [evtName in mapEventNames]?: MapSelectEventHandlerDescriptor[];
            };
        };
    };
    private map: MapboxGL.Map | undefined;
    private popupManager: MapPopupManager;
    private mapContainer;
    private draw: MapboxDraw | undefined;
    private mapCallbacks: MapCallbacks;
    private updateCounts: { [layerName: string]: number } = {};

    constructor(props: MainMapProps & WithTranslation) {
        super(props);

        // TODO: This should not be here
        let xyzTileLayer = undefined;
        if (process.env.CUSTOM_RASTER_TILES_XYZ_URL) {
            xyzTileLayer = new TileLayer({
                data: process.env.CUSTOM_RASTER_TILES_XYZ_URL,
                minZoom: process.env.CUSTOM_RASTER_TILES_MIN_ZOOM
                    ? parseFloat(process.env.CUSTOM_RASTER_TILES_MIN_ZOOM)
                    : 0,
                maxZoom: process.env.CUSTOM_RASTER_TILES_MAX_ZOOM
                    ? parseFloat(process.env.CUSTOM_RASTER_TILES_MAX_ZOOM)
                    : 22,
                opacity: 0.5,
                tileSize: 256,
                renderSubLayers: (props) => {
                    const {
                        bbox: { west, south, east, north }
                    } = props.tile;

                    return new BitmapLayer(props, {
                        data: null,
                        image: props.data,
                        bounds: [west, south, east, north]
                    });
                }
            });
        }

        this.state = {
            viewState: {
                longitude: props.center[0],
                latitude: props.center[1],
                zoom: props.zoom,
                pitch: 0,
                bearing: 0
            },
            enabledLayers: [],
            mapStyleURL: Preferences.get('mapStyleURL'),
            xyzTileLayer: xyzTileLayer,
            isDragging: false
        };

        this.defaultZoomArray = [props.zoom];
        this.defaultCenter = props.center;
        this.layerManager = new MapLayerManager(layersConfig);

        this.pathLayerManager = new PathMapLayerManager(this.layerManager);

        this.popupManager = new MapPopupManager();
        this.mapContainer = createRef<HTMLDivElement>();

        this.mapEvents = { map: {}, layers: {}, tooltips: {}, mapSelect: {} };
        const newEvents = [globalMapEvents, transitionMapEvents];
        const newEventsArr = newEvents.flatMap((ev) => ev);
        newEventsArr.forEach((eventDescriptor) => {
            if (eventDescriptor.type === 'layer') {
                this.mapEvents.layers[eventDescriptor.layerName] =
                    this.mapEvents.layers[eventDescriptor.layerName] || {};
                const events = this.mapEvents.layers[eventDescriptor.layerName][eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEvents.layers[eventDescriptor.layerName][eventDescriptor.eventName] = events;
            } else if (eventDescriptor.type === 'tooltip') {
                this.mapEvents.tooltips[eventDescriptor.layerName] =
                    this.mapEvents.tooltips[eventDescriptor.layerName] || {};
                const events = this.mapEvents.tooltips[eventDescriptor.layerName][eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEvents.tooltips[eventDescriptor.layerName][eventDescriptor.eventName] = events;
            } else if (eventDescriptor.type === 'mapSelect') {
                this.mapEvents.mapSelect[eventDescriptor.layerName] =
                    this.mapEvents.mapSelect[eventDescriptor.layerName] || {};
                const events = this.mapEvents.mapSelect[eventDescriptor.layerName][eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEvents.mapSelect[eventDescriptor.layerName][eventDescriptor.eventName] = events;
            } else {
                const events = this.mapEvents.map[eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEvents.map[eventDescriptor.eventName] = events;
            }
        });
        this.mapCallbacks = {
            pickMultipleObjects: this.pickMultipleObjects
        };
    }

    fitBounds = (coordinates: [number, number]) => {
        this.map?.fitBounds(coordinates, {
            padding: 20,
            bearing: this.map.getBearing()
        });
    };

    setCenter = (coordinates: [number, number]) => {
        this.map?.setCenter(coordinates);
    };

    onEnableBoxZoom = () => {
        this.map?.boxZoom.enable();
    };

    onDisableBoxZoom = () => {
        this.map?.boxZoom.disable();
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
        serviceLocator.addService('layerManager', this.layerManager);
        serviceLocator.addService('pathLayerManager', this.pathLayerManager);
        this.layerManager.updateEnabledLayers(Preferences.current.map.layers[this.props.activeSection]);
        mapCustomEvents.addEvents(serviceLocator.eventManager);
        //elementResizedEvent(this.mapContainer, this.onResizeContainer);
        // TODO Are those events all ours? Or are some mapbox's? In any case, they should all be documented in a map API file: who should use when, and which parameters are expected
        serviceLocator.eventManager.on('map.updateEnabledLayers', this.updateEnabledLayers);
        (serviceLocator.eventManager as EventManager).onEvent<MapUpdateLayerEventType>(
            'map.updateLayer',
            this.updateLayer
        );
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
        serviceLocator.eventManager.on('map.showContextMenu', this.showContextMenu);
        serviceLocator.eventManager.on('map.hideContextMenu', this.hideContextMenu);
        serviceLocator.eventManager.on('map.handleDrawControl', this.handleDrawControl);
        //serviceLocator.eventManager.on('map.deleteSelectedNodes', this.deleteSelectedNodes);
        serviceLocator.eventManager.on('map.deleteSelectedPolygon', this.deleteSelectedPolygon);
        serviceLocator.eventManager.emit('map.loaded');
        Preferences.addChangeListener(this.onPreferencesChange);
    };

    onPreferencesChange = (updates: any) => {
        this.setState({ mapStyleURL: Preferences.get('mapStyleURL') });
    };

    componentWillUnmount = () => {
        serviceLocator.removeService('layerManager');
        serviceLocator.removeService('pathLayerManager');
        mapCustomEvents.removeEvents(serviceLocator.eventManager);
        // removeResizeListener(this.mapContainer, this.onResizeContainer);
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
        serviceLocator.eventManager.off('map.showContextMenu', this.showContextMenu);
        serviceLocator.eventManager.off('map.hideContextMenu', this.hideContextMenu);
        serviceLocator.eventManager.off('map.handleDrawControl', this.handleDrawControl);
        //serviceLocator.eventManager.off('map.deleteSelectedNodes', this.deleteSelectedNodes);
        serviceLocator.eventManager.off('map.deleteSelectedPolygon', this.deleteSelectedPolygon);
        this.map?.remove(); // this will clean up everything including events
    };

    onResizeContainer = () => {
        if (this.map) {
            this.map.resize();
        }
    };

    private executeEvent = (event: MapEventHandlerDescriptor, pointInfo: PointInfo, e: MjolnirEvent) => {
        if (event.condition === undefined || event.condition(this.props.activeSection)) {
            event.handler(pointInfo, e, this.mapCallbacks);
        }
    };

    private executeTooltipEvent = (
        event: TooltipEventHandlerDescriptor,
        pickInfo: PickingInfo
    ): string | undefined | { text: string; containsHtml: boolean } => {
        if (event.condition === undefined || event.condition(this.props.activeSection)) {
            return event.handler(pickInfo, this.mapCallbacks);
        }
        return undefined;
    };

    private executeMapSelectEvent = (
        event: MapSelectEventHandlerDescriptor,
        pickInfo: PickingInfo[],
        e: MjolnirEvent
    ) => {
        if (event.condition === undefined || event.condition(this.props.activeSection)) {
            return event.handler(pickInfo, e, this.mapCallbacks);
        }
        return undefined;
    };

    /* getEventHandler = (events: MapEventHandlerDescription[]) => {
        return (e) => this.executeEvents(e, events);
    }; */

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
        const map = this.map;
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
                /* Nothing to do */
            }
        );
    };

    /**
     * In the nodes active section, if you click on the map a new node will be create
     * If the user click on the tool for draw a polygon,
     * selectedNodes will put a value that will prevent a new node to be create
     * If the user click again on the tool for draw a polygon and selectedNodes does'nt contain nodes (type object)
     * selectedNodes will be clear so a new node can be create
     * @param {object} data The next mode, i.e. the mode that Draw is changing to (from mapbox-gl-draw API.md)
     */
    modeChangePolygonService = (data) => {
        if (data.mode && data.mode === 'draw_polygon') {
            serviceLocator.selectedObjectsManager.select('selectedNodes', 'draw_polygon');
        } else {
            const selectedNodes = serviceLocator.selectedObjectsManager.get('selectedNodes');
            if (selectedNodes && typeof selectedNodes !== 'object' && data.mode && data.mode === 'simple_select') {
                serviceLocator.selectedObjectsManager.select('selectedNodes', null);
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
            serviceLocator.selectedObjectsManager.select('selectedNodes', selectedNodes);
            serviceLocator.selectedObjectsManager.select(
                'isContainSelectedFrozenNodes',
                selectedNodes.length !== nodesInPolygon.length
            );
            serviceLocator.selectedObjectsManager.select('isDrawPolygon', true);
        }
    };

    deleteSelectedPolygon = () => {
        if (this.draw) {
            this.draw.deleteAll().getAll();
        }
        serviceLocator.selectedObjectsManager.select('selectedNodes', null);
        serviceLocator.selectedObjectsManager.select('isContainSelectedFrozenNodes', null);
        serviceLocator.selectedObjectsManager.select('isDrawPolygon', null);
        serviceLocator.eventManager.emit('selected.update.nodes');
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodesSelected: turfFeatureCollection([]),
            transitNodes250mRadius: turfFeatureCollection([]),
            transitNodes500mRadius: turfFeatureCollection([]),
            transitNodes750mRadius: turfFeatureCollection([]),
            transitNodes1000mRadius: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([])
        });
    };

    onDeleteSelectedNodes = () => {
        serviceLocator.eventManager.emit('progress', { name: 'DeletingNodes', progress: 0.0 });
        const selectedNodes = serviceLocator.selectedObjectsManager.get('selectedNodes');

        deleteUnusedNodes(selectedNodes.map((n) => n.getId()))
            .then((_response) => {
                serviceLocator.selectedObjectsManager.deselect('node');
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
        const map = this.map;
        if (!map) return;
        if (section === 'nodes' && !this.draw) {
            this.setDrawPolygonService();
        } else if (section !== 'nodes' && this.draw) {
            this.deleteSelectedPolygon();
            removeMapBoxDraw(
                map,
                this.draw,
                () => {
                    /* Nothing to do */
                },
                () => {
                    /* Nothing to do */
                },
                () => {
                    /* Nothing to do */
                }
            );
            this.draw = null;
        }
    };

    addPopup = (popupId: string, popup: MapboxGL.Popup, removeAll = true) => {
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
        this.updateCounts[args.layerName] = (this.updateCounts[args.layerName] || 0) + 1;
        this.setState({ enabledLayers: this.layerManager.getEnabledLayers().map((layer) => layer.id) });
    };

    updateLayers = (geojsonByLayerName) => {
        this.layerManager.updateLayers(geojsonByLayerName);
        Object.keys(geojsonByLayerName).forEach(
            (layerName) => (this.updateCounts[layerName] = (this.updateCounts[layerName] || 0) + 1)
        );
        this.setState({ enabledLayers: this.layerManager.getEnabledLayers().map((layer) => layer.id) });
    };

    updateEnabledLayers = (enabledLayers: string[]) => {
        this.layerManager.updateEnabledLayers(enabledLayers);
        this.setState({ enabledLayers });
    };

    showContextMenu = (
        position: [number, number],
        elements: { key?: string; title: string; onClick: () => void; onHover?: () => void }[]
    ) => {
        const contextMenu = document.getElementById('tr__main-map-context-menu');
        if (!contextMenu) {
            return;
        }
        contextMenu.style.left = position[0] + 'px';
        contextMenu.style.top = position[1] + 'px';
        contextMenu.style.display = 'block';

        createRoot(contextMenu).render(
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
        const contextMenu = document.getElementById('tr__main-map-context-menu');
        if (!contextMenu) {
            return;
        }
        contextMenu.style.display = 'none';
        createRoot(contextMenu).render(<React.Fragment></React.Fragment>);
    };

    onLayerFilter = (context: FilterContext): boolean => {
        return true;
    };

    private updateUserPrefs = _debounce((viewStateChange) => {
        // Save map zoom and center to user preferences
        Preferences.update(
            {
                'map.zoom': viewStateChange.viewState.zoom,
                'map.center': [viewStateChange.viewState.longitude, viewStateChange.viewState.latitude]
            },
            serviceLocator.socketEventManager
        );
    }, 500);

    // FIXME: Find the type for this
    onViewStateChange = (viewStateChange) => {
        this.setState({ viewState: viewStateChange.viewState });
        this.updateUserPrefs(viewStateChange);
    };

    onClick = (pickInfo: PickingInfo, event: MjolnirGestureEvent) => {
        if (event.handled) return;
        if (pickInfo.picked === false) {
            if (event.leftButton) {
                // Do the map's click events
                const events = this.mapEvents.map.onLeftClick || [];
                events.forEach((ev) =>
                    this.executeEvent(
                        ev,
                        { coordinates: pickInfo.coordinate as number[], pixel: pickInfo.pixel as [number, number] },
                        event
                    )
                );
            } else if (event.rightButton) {
                // Do the map's right click events
                const events = this.mapEvents.map.onRightClick || [];
                events.forEach((ev) =>
                    this.executeEvent(
                        ev,
                        { coordinates: pickInfo.coordinate as number[], pixel: pickInfo.pixel as [number, number] },
                        event
                    )
                );
            }
        } else {
            const eventName = event.leftButton ? 'onLeftClick' : event.rightButton ? 'onRightClick' : undefined;
            if (!eventName) return;

            // See if there are multiple picks to call proper mapSelect events
            // TODO Update the radius to not have an hard-coded value, fine-tune as necessary
            const objects: PickingInfo[] = (this.mapContainer.current as Deck).pickMultipleObjects({
                x: pickInfo.x,
                y: pickInfo.y,
                radius: 4,
                layerIds: this.state.enabledLayers
            });
            const objectsByLayer: { [layerName: string]: PickingInfo[] } = {};
            objects.forEach((picked) => {
                if (picked.layer && picked.object) {
                    const allPicked = objectsByLayer[picked.layer.id] || [];
                    allPicked.push(picked);
                    objectsByLayer[picked.layer.id] = allPicked;
                }
            });
            Object.keys(objectsByLayer).forEach((layerName) => {
                if (this.mapEvents.mapSelect[layerName] && this.mapEvents.mapSelect[layerName][eventName]) {
                    (this.mapEvents.mapSelect[layerName][eventName] as MapSelectEventHandlerDescriptor[]).forEach(
                        (ev) => {
                            this.executeMapSelectEvent(ev, objectsByLayer[layerName], event);
                        }
                    );
                }
            });
        }
    };

    onTooltip = (pickInfo: PickingInfo) => {
        if (pickInfo.picked === true && pickInfo.layer) {
            if (pickInfo.layer && !pickInfo.object) {
                console.log('it is indeed possible to have a layer and no object', pickInfo.layer.id);
                return null;
            }
            const tooltipEvents = (this.mapEvents.tooltips[pickInfo.layer.id] || {}).onTooltip;
            if (tooltipEvents) {
                for (let i = 0; i < tooltipEvents.length; i++) {
                    const tooltip = this.executeTooltipEvent(tooltipEvents[i], pickInfo);
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
        return null;
    };

    setDragging = (dragging: boolean) => {
        this.setState({ isDragging: dragging });
    };

    pickMultipleObjects: typeof Deck.prototype.pickMultipleObjects = (opts: {
        x: number;
        y: number;
        radius?: number | undefined;
        depth?: number | undefined;
        layerIds?: string[] | undefined;
        unproject3D?: boolean | undefined;
    }): PickingInfo[] => (this.mapContainer.current as Deck).pickMultipleObjects(opts);

    render() {
        // TODO: Deck.gl Migration: Should this be a state? To avoid recalculating for every render? See how often we render when the migration is complete
        const enabledLayers = this.layerManager.getEnabledLayers();
        const layers: Layer[] = enabledLayers
            .map((layer) =>
                getLayer({
                    layerDescription: layer,
                    viewState: this.state.viewState,
                    events: this.mapEvents.layers[layer.id],
                    activeSection: this.props.activeSection,
                    setDragging: this.setDragging,
                    mapCallbacks: this.mapCallbacks,
                    updateCount: this.updateCounts[layer.id] || 0
                })
            )
            .filter((layer) => layer !== undefined) as Layer[];

        if (this.state.xyzTileLayer) {
            layers.unshift(this.state.xyzTileLayer);
        }

        return (
            <section id="tr__main-map">
                <div id="tr__main-map-context-menu" className="tr__main-map-context-menu"></div>
                {this.props.children}
                <div onContextMenu={(evt) => evt.preventDefault()}>
                    <DeckGL
                        ref={this.mapContainer}
                        viewState={this.state.viewState}
                        controller={{ scrollZoom: true, dragPan: !this.state.isDragging }}
                        layers={layers}
                        onViewStateChange={this.onViewStateChange}
                        onClick={this.onClick}
                        getTooltip={this.onTooltip}
                    >
                        <MapLibreMap mapStyle={this.state.mapStyleURL} />
                    </DeckGL>
                </div>
            </section>
        );
    }
}

export default withTranslation(['transit', 'main'])(MainMap);
