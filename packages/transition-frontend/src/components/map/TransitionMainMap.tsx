/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { createRef, PropsWithChildren } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WithTranslation, withTranslation } from 'react-i18next';
import _debounce from 'lodash/debounce';

// deck.gl and maps
import DeckGL from '@deck.gl/react';
import { Layer, Deck, PickingInfo, WebMercatorViewport } from '@deck.gl/core';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// chaire-lib-common:
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

// chaire-lib-frontend:
import globalMapEvents from 'chaire-lib-frontend/lib/services/map/events/GlobalMapEvents';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
import MapPopupManager from 'chaire-lib-frontend/lib/services/map/MapPopupManager';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import {
    MapUpdateLayerEventType,
    MapFilterLayerEventType
} from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';

// transition-frontend:
import transitionMapEvents from '../../services/map/events';
import TransitPathFilterManager from '../../services/map/TransitPathFilterManager';
import { MapButton } from '../parts/MapButton';
import layersConfig, { sectionLayers } from '../../config/layers.config';
import getLayer from './layers/TransitionMapLayer';
import { MapEventsManager } from '../../services/map/MapEventsManager';
import { MapEditFeature, ToolConstructorOf } from './MapEditFeature';
import { MeasureToolMapFeature } from './tools/MapMeasureTool';
import { TransitionMapController } from '../../services/map/TransitionMapController';
import { PolygonDrawMapFeature } from './tools/MapPolygonDrawTool';

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
    time: number;
    contextMenu: HTMLElement | null;
    contextMenuRoot: Root | undefined;
    visibleLayers: string[];
    mapStyleURL: string;
    xyzTileLayer?: Layer; // Temporary! Move this somewhere else
    isDragging: boolean;
    mapEditTool?: MapEditFeature;
    editUpdateCount: number;
    activeMapEventManager: MapEventsManager;
}

const getTileLayer = () => {
    const opacity = Math.max(0, Math.min(Preferences.get('mapTileLayerOpacity'), 1));
    return process.env.CUSTOM_RASTER_TILES_XYZ_URL && opacity > 0
        ? new TileLayer({
            data: process.env.CUSTOM_RASTER_TILES_XYZ_URL,
            minZoom: process.env.CUSTOM_RASTER_TILES_MIN_ZOOM
                ? parseFloat(process.env.CUSTOM_RASTER_TILES_MIN_ZOOM)
                : 0,
            maxZoom: process.env.CUSTOM_RASTER_TILES_MAX_ZOOM
                ? parseFloat(process.env.CUSTOM_RASTER_TILES_MAX_ZOOM)
                : 22,
            opacity,
            tileSize: 256,
            renderSubLayers: (props) => {
                const {
                    boundingBox: [[west, south], [east, north]]
                } = props.tile;

                return new BitmapLayer(props, {
                    data: undefined,
                    image: props.data,
                    bounds: [west, south, east, north]
                });
            }
        })
        : undefined;
};

/**
 * TODO: For now, hard code the map for Transition here. But it should be in
 * chaire-lib and offer the possibility to pass the application modules when the
 * API for it has stabilised.
 */
class MainMap extends React.Component<MainMapProps & WithTranslation & PropsWithChildren, MainMapState> {
    private layerManager: MapLayerManager;
    private pathFilterManager: TransitPathFilterManager;
    private mapEventsManager: MapEventsManager;
    private popupManager: MapPopupManager;
    private mapContainer;
    private mapCallbacks: MapCallbacks;
    private updateCounts: { [layerName: string]: number } = {};
    // Viewport to convert pixels to coordinates. In a private field instead of
    // state as it is a side effect of state updates and we don't want to
    // re-render when it's updated
    private viewport: WebMercatorViewport;

    constructor(props: MainMapProps & WithTranslation) {
        super(props);

        // TODO: This should not be here
        const xyzTileLayer = getTileLayer();

        this.mapCallbacks = {
            pickMultipleObjects: this.pickMultipleObjects,
            pickObject: this.pickObject,
            pixelsToCoordinates: this.pixelsToCoordinates
        };

        const mapEvents = [globalMapEvents, transitionMapEvents];
        const mapEventsArr = mapEvents.flatMap((ev) => ev);
        this.mapEventsManager = new MapEventsManager(mapEventsArr, this.mapCallbacks);

        this.state = {
            time: 0,
            viewState: {
                longitude: props.center[0],
                latitude: props.center[1],
                zoom: props.zoom,
                pitch: 0,
                bearing: 0
            },
            contextMenu: null,
            contextMenuRoot: undefined,
            visibleLayers: [],
            mapStyleURL: Preferences.get('mapStyleURL'),
            xyzTileLayer: xyzTileLayer,
            isDragging: false,
            mapEditTool: undefined,
            editUpdateCount: 0,
            activeMapEventManager: this.mapEventsManager
        };
        this.viewport = new WebMercatorViewport(this.state.viewState);

        this.layerManager = new MapLayerManager(layersConfig);

        this.pathFilterManager = new TransitPathFilterManager();

        this.popupManager = new MapPopupManager();
        this.mapContainer = createRef<HTMLDivElement>();
    }

    onEditLayerUpdate = () => {
        this.setState({
            editUpdateCount: this.state.editUpdateCount + 1
        });
    };

    enableEditTool = (ToolConstructor: ToolConstructorOf) => {
        const mapEditTool = new ToolConstructor({
            onUpdate: this.onEditLayerUpdate,
            onDisable: this.disableEditTool
        });
        this.setState({
            mapEditTool: mapEditTool,
            activeMapEventManager: new MapEventsManager(mapEditTool.getMapEvents(), this.mapCallbacks)
        });
    };

    disableEditTool = () => {
        this.setState({
            mapEditTool: undefined,
            activeMapEventManager: this.mapEventsManager
        });
    };

    updateMeasureToolDistance = () => {
        console.log('distance was updated, do something');
    };
    showPathsByAttribute = (attribute: string, value: any) => {
        // attribute must be agency_id or line_id
        if (attribute === 'agency_id') {
            this.pathFilterManager.showAgencyId(value);
        } else if (attribute === 'line_id') {
            this.pathFilterManager.showLineId(value);
        }
    };

    hidePathsByAttribute = (attribute: string, value: any) => {
        // attribute must be agency_id or line_id
        if (attribute === 'agency_id') {
            this.pathFilterManager.hideAgencyId(value);
        } else if (attribute === 'line_id') {
            this.pathFilterManager.hideLineId(value);
        }
    };

    clearPathsFilter = () => {
        this.pathFilterManager.clearFilter();
    };

    componentDidMount = () => {
        serviceLocator.addService('layerManager', this.layerManager);
        serviceLocator.addService('pathLayerManager', this.pathFilterManager);
        this.layerManager.updateEnabledLayers(sectionLayers[this.props.activeSection]);
        //elementResizedEvent(this.mapContainer, this.onResizeContainer);
        // TODO Are those events all ours? Or are some mapbox's? In any case, they should all be documented in a map API file: who should use when, and which parameters are expected
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
        (serviceLocator.eventManager as EventManager).onEvent<MapFilterLayerEventType>(
            'map.layers.updateFilter',
            this.updateFilter
        );
        serviceLocator.eventManager.on('map.updateLayers', this.updateLayers);
        serviceLocator.eventManager.on('map.clearFilter', this.clearFilter);
        serviceLocator.eventManager.on('map.showLayer', this.showLayer);
        serviceLocator.eventManager.on('map.hideLayer', this.hideLayer);
        serviceLocator.eventManager.on('map.fitBounds', this.fitBounds);
        serviceLocator.eventManager.on('map.paths.byAttribute.show', this.showPathsByAttribute);
        serviceLocator.eventManager.on('map.paths.byAttribute.hide', this.hidePathsByAttribute);
        serviceLocator.eventManager.on('map.paths.clearFilter', this.clearPathsFilter);
        serviceLocator.eventManager.on('map.showContextMenu', this.showContextMenu);
        serviceLocator.eventManager.on('map.hideContextMenu', this.hideContextMenu);
        serviceLocator.eventManager.emit('map.loaded');
        Preferences.addChangeListener(this.onPreferencesChange);
    };

    onPreferencesChange = (updates: any) => {
        if (Object.keys(updates).some((key) => ['mapStyleURL', 'mapTileLayerOpacity'].includes(key))) {
            this.setState({
                mapStyleURL: Preferences.get('mapStyleURL'),
                xyzTileLayer: getTileLayer()
            });
        }
    };

    componentWillUnmount = () => {
        serviceLocator.removeService('layerManager');
        serviceLocator.removeService('pathLayerManager');
        // removeResizeListener(this.mapContainer, this.onResizeContainer);
        serviceLocator.eventManager.off('map.updateEnabledLayers', this.updateEnabledLayers);
        serviceLocator.eventManager.off('map.updateLayer', this.updateLayer);
        serviceLocator.eventManager.off('map.updateLayers', this.updateLayers);
        serviceLocator.eventManager.off('map.layers.updateFilter', this.updateFilter);
        serviceLocator.eventManager.off('map.clearFilter', this.clearFilter);
        serviceLocator.eventManager.off('map.showLayer', this.showLayer);
        serviceLocator.eventManager.off('map.hideLayer', this.hideLayer);
        serviceLocator.eventManager.off('map.fitBounds', this.fitBounds);
        serviceLocator.eventManager.off('map.paths.byAttribute.show', this.showPathsByAttribute);
        serviceLocator.eventManager.off('map.paths.byAttribute.hide', this.hidePathsByAttribute);
        serviceLocator.eventManager.off('map.paths.clearFilter', this.clearPathsFilter);
        serviceLocator.eventManager.off('map.showContextMenu', this.showContextMenu);
        serviceLocator.eventManager.off('map.hideContextMenu', this.hideContextMenu);
    };

    fitBounds = (bounds: [[number, number], [number, number]]) => {
        // Use a mercator viewport to fit the bounds, as suggested by https://stackoverflow.com/questions/69744838/how-to-use-fitbounds-in-deckgl-on-timer-without-npm-and-es6
        this.viewport = new WebMercatorViewport(this.state.viewState).fitBounds(bounds, {
            padding: 20
        });
        const { latitude, longitude, zoom } = this.viewport;
        this.setState({
            viewState: {
                ...this.state.viewState,
                latitude,
                longitude,
                zoom
            }
        });
    };

    private updateVisibleLayers = () =>
        this.setState({
            visibleLayers: this.layerManager
                .getEnabledLayers()
                .filter((layer) => layer.visible)
                .map((layer) => layer.id)
        });

    /* getEventHandler = (events: MapEventHandlerDescription[]) => {
        return (e) => this.executeEvents(e, events);
    }; */

    showLayer = (layerName: string) => {
        this.layerManager.showLayer(layerName);
        this.updateVisibleLayers();
    };

    hideLayer = (layerName: string) => {
        this.layerManager.hideLayer(layerName);
        this.updateVisibleLayers();
    };

    clearFilter = (layerName: string) => {
        this.layerManager.clearFilter(layerName);
        this.updateVisibleLayers();
    };

    updateFilter = (args: { layerName: string; filter: ((feature: GeoJSON.Feature) => 0 | 1) | undefined }) => {
        this.layerManager.updateFilter(args.layerName, args.filter);
        this.updateCounts[args.layerName] = (this.updateCounts[args.layerName] || 0) + 1;
        this.updateVisibleLayers();
    };

    setRef = (ref) => {
        this.mapContainer = ref;
    };

    updateLayer = (args: {
        layerName: string;
        data: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection);
    }) => {
        this.layerManager.updateLayer(args.layerName, args.data);
        this.updateCounts[args.layerName] = (this.updateCounts[args.layerName] || 0) + 1;
        this.updateVisibleLayers();
    };

    updateLayers = (geojsonByLayerName) => {
        this.layerManager.updateLayers(geojsonByLayerName);
        Object.keys(geojsonByLayerName).forEach(
            (layerName) => (this.updateCounts[layerName] = (this.updateCounts[layerName] || 0) + 1)
        );
        this.updateVisibleLayers();
    };

    updateEnabledLayers = (enabledLayers: string[]) => {
        this.layerManager.updateEnabledLayers(enabledLayers);
        this.updateVisibleLayers();
    };

    showContextMenu = (
        position: [number, number],
        elements: { key?: string; title: string; onClick: () => void; onHover?: () => void }[]
    ) => {
        const contextMenu = document.getElementById('tr__main-map-context-menu');
        if (!contextMenu || !this.state.contextMenuRoot) {
            return;
        }
        contextMenu.style.left = position[0] + 'px';
        contextMenu.style.top = position[1] + 'px';
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
        this.viewport = new WebMercatorViewport(viewStateChange.viewState);
        this.updateUserPrefs(viewStateChange);
    };

    // Recreate the viewport with the correct width and height to convert
    // pixels to coordinates. It is not necessary to update the state here as
    // width and height are not property that we need to track in our state.
    // FIXME But should we update the state? it works fine without...
    onResize = ({ width, height }: { width: number; height: number }) => {
        this.viewport = new WebMercatorViewport({ ...this.state.viewState, width, height });
    };

    onTooltip = (pickInfo: PickingInfo) => {
        if (pickInfo.picked === true && pickInfo.layer) {
            if (pickInfo.layer && !pickInfo.object) {
                // it is indeed possible to have a layer and no object:
                return null;
            }
            const tooltipEvents = this.mapEventsManager.getTooltipEvents(pickInfo.layer.id).onTooltip;
            if (tooltipEvents) {
                for (let i = 0; i < tooltipEvents.length; i++) {
                    const tooltip = this.mapEventsManager.executeTooltipEvent(
                        tooltipEvents[i],
                        pickInfo,
                        this.props.activeSection
                    );
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
        // FIXME Do not drag if in editing mode?
        if (this.state.mapEditTool !== undefined) {
            return;
        }
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

    pickObject: typeof Deck.prototype.pickObject = (opts: {
        x: number;
        y: number;
        radius?: number | undefined;
        depth?: number | undefined;
        layerIds?: string[] | undefined;
        unproject3D?: boolean | undefined;
    }): PickingInfo | null => (this.mapContainer.current as Deck).pickObject(opts);

    pixelsToCoordinates = (pixels: [number, number]): number[] => {
        return this.viewport.unproject(pixels);
    };

    render() {
        // Disable events on layers if the map is in editing mode
        const mapEditTool = this.state.mapEditTool;
        // TODO: Deck.gl Migration: Should this be a state or a local field (equivalent of useMemo)? To avoid recalculating for every render? See how often we render when the migration is complete
        const enabledLayers = this.layerManager.getEnabledLayers().filter((layer) => layer.visible === true);
        const layers: Layer[] = enabledLayers
            .flatMap((layer) =>
                getLayer({
                    layerDescription: layer,
                    viewState: this.state.viewState,
                    events: mapEditTool === undefined ? this.mapEventsManager.getLayerEvents(layer.id) : undefined,
                    activeSection: this.props.activeSection,
                    setDragging: this.setDragging,
                    mapCallbacks: this.mapCallbacks,
                    updateCount: this.updateCounts[layer.id] || 0,
                    filter: this.layerManager.getFilter(layer.id)
                })
            )
            .filter((layer) => layer !== undefined) as Layer[];
        if (mapEditTool !== undefined) {
            layers.push(
                ...mapEditTool.getLayers({
                    viewState: this.state.viewState,
                    activeSection: this.props.activeSection,
                    setDragging: this.setDragging,
                    mapCallbacks: this.mapCallbacks,
                    updateCount: this.state.editUpdateCount
                })
            );
        }
        const needAnimation =
            Preferences.get('map.enableMapAnimations', true) &&
            enabledLayers.find((layer) => layer.configuration.type === 'animatedArrowPath') !== undefined;

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
                        controller={
                            {
                                scrollZoom: true,
                                doubleClickZoom: false,
                                dragPan: !this.state.isDragging,
                                type: TransitionMapController,
                                mapEventsManager: this.state.activeMapEventManager,
                                mapCallbacks: this.mapCallbacks,
                                activeSection: this.props.activeSection
                            } as any
                        }
                        _animate={needAnimation}
                        layers={layers}
                        onViewStateChange={this.onViewStateChange}
                        getTooltip={this.onTooltip}
                        onResize={this.onResize}
                        getCursor={({ isHovering, isDragging }) => {
                            // Show a crosshair cursor when the measure tool is enabled
                            // TODO Different edit tools may have different cursors, maybe add a function to the edit tool?
                            if (this.state.mapEditTool !== undefined) {
                                return 'crosshair';
                            }
                            return isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab';
                        }}
                    >
                        <MapLibreMap mapStyle={this.state.mapStyleURL} />
                    </DeckGL>
                    <div className="tr__map-button-container">
                        {/* FIXME Add a condition to enable this tool depending on the active section */}
                        <MapButton
                            title="main:MeasureTool"
                            key="mapbtn_measuretool"
                            className={`${this.state.mapEditTool?.getEditMode() === MeasureToolMapFeature.editMode ? 'active' : ''}`}
                            onClick={() => {
                                if (this.state.mapEditTool?.getEditMode() === MeasureToolMapFeature.editMode) {
                                    this.disableEditTool();
                                } else {
                                    this.enableEditTool(MeasureToolMapFeature);
                                }
                            }}
                            iconPath={'/dist/images/icons/interface/ruler_white.svg'}
                        />
                        {this.props.activeSection === 'nodes' && (
                            <MapButton
                                title="main:PolygonDrawTool"
                                key="mapbtn_polygontool"
                                className={`${this.state.mapEditTool?.getEditMode() === PolygonDrawMapFeature.editMode ? 'active' : ''}`}
                                onClick={() => {
                                    if (this.state.mapEditTool?.getEditMode() === PolygonDrawMapFeature.editMode) {
                                        this.disableEditTool();
                                    } else {
                                        this.enableEditTool(PolygonDrawMapFeature);
                                    }
                                }}
                                iconPath={'/dist/images/icons/interface/select_white.svg'}
                            />
                        )}
                    </div>
                    {this.state.mapEditTool && this.state.mapEditTool.getMapComponent()}
                </div>
            </section>
        );
    }
}

export default withTranslation(['transit', 'main'])(MainMap);
