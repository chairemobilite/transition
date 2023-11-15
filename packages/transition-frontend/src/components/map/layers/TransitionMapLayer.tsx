/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Layer, LayerProps } from '@deck.gl/core/typed';
import {
    layerEventNames,
    MapCallbacks,
    MapLayerEventHandlerDescriptor
} from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapLayer } from 'chaire-lib-frontend/lib/services/map/layers/LayerDescription';
import { ScatterplotLayer, PathLayer, GeoJsonLayer, PickingInfo, Deck } from 'deck.gl/typed';
import { MjolnirEvent, MjolnirGestureEvent } from 'mjolnir.js';
import AnimatedArrowPathLayer from './AnimatedArrowPathLayer';

// FIXME default color should probably be a app/user/theme preference?
const DEFAULT_COLOR = '#0086FF';
const defaultRGBA = [
    parseInt(DEFAULT_COLOR.substring(1, 3), 16),
    parseInt(DEFAULT_COLOR.substring(3, 5), 16),
    parseInt(DEFAULT_COLOR.substring(5), 16),
    255
] as [number, number, number, number];

type TransitionMapLayerProps = {
    layerDescription: MapLayer;
    // TODO Find the right type for this
    viewState;
    events?: { [evtName in layerEventNames]?: MapLayerEventHandlerDescriptor[] };
    activeSection: string;
    setDragging: (dragging: boolean) => void;
    mapCallbacks: MapCallbacks;
};

const stringToColor = (hexStringColor: string): [number, number, number] | [number, number, number, number] => [
    parseInt(hexStringColor.substring(1, 3), 16),
    parseInt(hexStringColor.substring(3, 5), 16),
    parseInt(hexStringColor.substring(5, 7), 16),
    hexStringColor.length === 9 ? parseInt(hexStringColor.substring(7, 9), 16) : 255
];

const propertyToColor = (
    feature: GeoJSON.Feature<GeoJSON.Geometry>,
    property: string,
    defaultColor?: string
): [number, number, number] | [number, number, number, number] => {
    if (!feature.properties || !feature.properties[property]) {
        return defaultRGBA;
    }
    const colorValue = feature.properties[property];
    return typeof colorValue === 'string' && colorValue.startsWith('#')
        ? stringToColor(colorValue)
        : Array.isArray(colorValue)
            ? [
                parseInt(colorValue[0]),
                parseInt(colorValue[1]),
                parseInt(colorValue[2]),
                colorValue[3] !== undefined ? parseInt(colorValue[3]) : 255
            ]
            : defaultColor
                ? stringToColor(defaultColor)
                : defaultRGBA;
};

const getLineLayer = (props: TransitionMapLayerProps, eventsToAdd): PathLayer =>
    new PathLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        getPath: (d) => d.geometry.coordinates,
        //getTimestamps: d => setTimestamps(d),
        getColor: (d) => propertyToColor(d, 'color'),
        opacity: 0.8,
        widthMinPixels: 2,
        widthScale: 4,
        rounded: true,
        fadeTrail: true,
        trailLength: 400,
        currentTime: 0,
        shadowEnabled: false,
        pickable: true,
        /*updateTriggers: {
      getWidth: routeIndex
    },*/
        ...eventsToAdd
    });

const getAnimatedArrowPathLayer = (props: TransitionMapLayerProps, eventsToAdd): AnimatedArrowPathLayer =>
    new AnimatedArrowPathLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        getPath: (d) => d.geometry.coordinates,
        pickable: true,
        getWidth: 100,
        /*
        getWidth: (d, i) => {
            return 70;
        },*/
        getColor: (d) => propertyToColor(d, 'color'),
        getSizeArray: [4, 4],
        speedDivider: 10,
        ...eventsToAdd
    });

const getPolygonLayer = (props: TransitionMapLayerProps, eventsToAdd): GeoJsonLayer =>
    new GeoJsonLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        pickable: true,
        stroked: true,
        filled: true,
        wireframe: true,
        lineWidthMinPixels: 1,
        /* getElevation: d => {
        console.log('elevation', d.properties);
        return 0;
    }, */
        getFillColor: (d) => propertyToColor(d, 'color'),
        getLineColor: [80, 80, 80],
        getLineWidth: 1,
        ...eventsToAdd
    });

const getScatterLayer = (props: TransitionMapLayerProps, eventsToAdd): ScatterplotLayer<any> =>
    new ScatterplotLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        filled: true,
        stroked: true,
        getPosition: (d) => d.geometry.coordinates,
        getFillColor: (d) => propertyToColor(d, 'color'),
        getLineColor: [255, 255, 255, 255],
        getRadius: (d, i) => 10,
        radiusScale: 6,
        /* updateTriggers: {
          getRadius: nodeIndex
        }, */
        pickable: true,
        ...eventsToAdd
    });

const addEvents = (
    events: { [evtName in layerEventNames]?: MapLayerEventHandlerDescriptor[] },
    props: TransitionMapLayerProps
) => {
    const layerEvents: any = {};
    const leftClickEvents = events.onLeftClick;
    const rightClickEvents = events.onRightClick;
    const checkHandler = (handlerDes: MapLayerEventHandlerDescriptor) =>
        handlerDes.condition === undefined || handlerDes.condition(props.activeSection);
    const onLeftClickEvt = leftClickEvents === undefined ? [] : leftClickEvents;
    const onRightClickEvt = rightClickEvents === undefined ? [] : rightClickEvents;
    layerEvents.onClick = (info: PickingInfo, e: MjolnirGestureEvent) => {
        if (e.leftButton) {
            onLeftClickEvt.filter(checkHandler).forEach((ev) => ev.handler(info, e, props.mapCallbacks));
        } else if (e.rightButton) {
            onRightClickEvt.filter(checkHandler).forEach((ev) => ev.handler(info, e, props.mapCallbacks));
        }
    };
    const onDragEvt = events.onDrag;
    const onDragEndEvt = events.onDragEnd;
    const onDragStartEvt = events.onDragStart;
    if (onDragStartEvt || onDragEvt || onDragEndEvt) {
        const onDragStartArr = onDragStartEvt === undefined ? [] : onDragStartEvt;
        layerEvents.onDragStart = (info: PickingInfo, e: MjolnirGestureEvent) => {
            props.setDragging(true);
            onDragStartArr.filter(checkHandler).forEach((ev) => ev.handler(info, e, props.mapCallbacks));
        };
    }

    if (onDragEvt) {
        layerEvents.onDrag = (info: PickingInfo, e: MjolnirGestureEvent) => {
            onDragEvt.filter(checkHandler).forEach((ev) => ev.handler(info, e, props.mapCallbacks));
        };
    }

    if (onDragStartEvt || onDragEvt || onDragEndEvt) {
        const onDragEndArr = onDragEndEvt === undefined ? [] : onDragEndEvt;
        layerEvents.onDragEnd = (info: PickingInfo, e: MjolnirGestureEvent) => {
            props.setDragging(false);
            onDragEndArr.filter(checkHandler).forEach((ev) => ev.handler(info, e, props.mapCallbacks));
        };
    }

    return layerEvents;
};

const getLayer = (props: TransitionMapLayerProps): Layer<LayerProps> | undefined => {
    if (props.layerDescription.layerData === undefined) {
        console.log('layer data is undefined', props.layerDescription.id);
        return undefined;
    }
    const eventsToAdd = props.events !== undefined ? addEvents(props.events, props) : {};
    if (props.layerDescription.configuration.type === 'circle') {
        // FIXME Try not to type as any
        return getScatterLayer(props, eventsToAdd) as any;
    } else if (props.layerDescription.configuration.type === 'line') {
        return getLineLayer(props, eventsToAdd) as any;
    } else if (props.layerDescription.configuration.type === 'fill') {
        return getPolygonLayer(props, eventsToAdd) as any;
    } else if (props.layerDescription.configuration.type === 'animatedArrowPath') {
        return getAnimatedArrowPathLayer(props, eventsToAdd) as any;
    }
    console.log('unknown layer', props.layerDescription.configuration);
    return undefined;
};

export default getLayer;
