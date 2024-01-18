/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Layer, LayerProps } from '@deck.gl/core/typed';
import { propertiesContainsFilter } from '@turf/turf';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import {
    layerEventNames,
    MapCallbacks,
    MapLayerEventHandlerDescriptor
} from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import * as LayerDescription from 'chaire-lib-frontend/lib/services/map/layers/LayerDescription';
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

// FIXME Deck.gl types the viewState as `any`, as if it could change depending
// on... what?. Here we just type the parameters that we know are available to
// our map, but maybe it is wrong to do so?
export type ViewState = {
    zoom: number;
    latitude: number;
    longitude: number;
    [key: string]: any;
};

type TransitionMapLayerProps = {
    layerDescription: LayerDescription.MapLayer;
    viewState: ViewState;
    events?: { [evtName in layerEventNames]?: MapLayerEventHandlerDescriptor[] };
    activeSection: string;
    setDragging: (dragging: boolean) => void;
    mapCallbacks: MapCallbacks;
    updateCount: number;
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

const layerColorGetter = (
    getter: LayerDescription.FeatureColor | undefined,
    defaultValue: string
):
    | undefined
    | [number, number, number]
    | [number, number, number, number]
    | ((feature: GeoJSON.Feature) => [number, number, number] | [number, number, number, number]) => {
    if (getter === undefined) {
        return stringToColor(defaultValue);
    }
    if (typeof getter === 'string') {
        return stringToColor(getter);
    }
    if (Array.isArray(getter)) {
        return getter;
    }
    if (typeof getter === 'function') {
        return (feature: GeoJSON.Feature) => {
            const color = getter(feature);
            return typeof color === 'string' ? stringToColor(color) : color;
        };
    }
    if (getter.type === 'property') {
        return (feature: GeoJSON.Feature) => propertyToColor(feature, getter.property, defaultValue);
    }
    return undefined;
};

const propertytoNumber = (feature: GeoJSON.Feature<GeoJSON.Geometry>, property: string, defaultNumber = 0): number => {
    if (!feature.properties || !feature.properties[property]) {
        return 0;
    }
    const numberValue = feature.properties[property];
    return typeof numberValue === 'number'
        ? numberValue
        : typeof numberValue === 'string'
            ? parseInt(numberValue)
            : defaultNumber;
};

const layerNumberGetter = (
    getter: LayerDescription.FeatureNumber | undefined,
    defaultValue: number | undefined
): undefined | number | ((feature: GeoJSON.Feature) => number) => {
    if (getter === undefined) {
        return defaultValue;
    }
    if (typeof getter === 'number' || typeof getter === 'function') {
        return getter;
    }
    if (getter.type === 'property') {
        return (feature: GeoJSON.Feature) => propertytoNumber(feature, getter.property, defaultValue);
    }
    return undefined;
};

const getCommonProperties = (props: TransitionMapLayerProps, config: LayerDescription.CommonLayerConfiguration) => {
    const layerProperties: any = {};
    const minZoom = config.minZoom === undefined ? undefined : layerNumberGetter(config.minZoom, undefined);
    if (typeof minZoom === 'number' && props.viewState.zoom <= minZoom) {
        return undefined;
    } else if (typeof minZoom === 'function') {
        console.log('Function for minZoom level not supported yet');
    }
    const maxZoom = config.maxZoom === undefined ? undefined : layerNumberGetter(config.maxZoom, undefined);
    if (typeof maxZoom === 'number' && props.viewState.zoom >= maxZoom) {
        return undefined;
    } else if (typeof maxZoom === 'function') {
        console.log('Function for maxZoom level not supported yet');
    }
    const color = config.color === undefined ? undefined : layerColorGetter(config.color, '#ffffff');
    if (color !== undefined) {
        layerProperties.getColor = color;
    }
    const opacity = config.opacity === undefined ? undefined : layerNumberGetter(config.opacity, 1);
    if (opacity !== undefined) {
        layerProperties.opacity = opacity;
    }
    const autoHighlight = config.autoHighlight === undefined ? undefined : config.autoHighlight;
    if (autoHighlight !== undefined) {
        layerProperties.autoHighlight = autoHighlight;
    }
    return layerProperties;
};

const getCommonLineProperties = (
    props: TransitionMapLayerProps,
    config: LayerDescription.BaseLineLayerConfiguration
) => {
    const layerProperties: any = getCommonProperties(props, config);

    const lineWidth = config.width === undefined ? undefined : layerNumberGetter(config.width, 10);
    if (lineWidth !== undefined) {
        layerProperties.getWidth = lineWidth;
    }
    const widthScale = config.widthScale === undefined ? undefined : layerNumberGetter(config.widthScale, 1);
    if (widthScale !== undefined) {
        layerProperties.lineWidthScale = widthScale;
    }
    const widthMinPixels =
        config.widthMinPixels === undefined ? undefined : layerNumberGetter(config.widthMinPixels, 1);
    if (widthMinPixels !== undefined) {
        layerProperties.widthMinPixels = widthMinPixels;
    }
    const widthMaxPixels =
        config.widthMaxPixels === undefined ? undefined : layerNumberGetter(config.widthMaxPixels, 50);
    if (widthMaxPixels !== undefined) {
        layerProperties.widthMaxPixels = widthMaxPixels;
    }
    const capRounded = config.capRounded === undefined ? undefined : config.capRounded;
    if (capRounded !== undefined) {
        layerProperties.capRounded = capRounded;
    }
    const jointRounded = config.jointRounded === undefined ? undefined : config.jointRounded;
    if (jointRounded !== undefined) {
        layerProperties.jointRounded = jointRounded;
    }

    const pickable =
        config.pickable === undefined
            ? true
            : typeof config.pickable === 'function'
                ? config.pickable()
                : config.pickable;
    layerProperties.pickable = pickable;
    return layerProperties;
};

const getLineLayer = (
    props: TransitionMapLayerProps,
    config: LayerDescription.LineLayerConfiguration,
    eventsToAdd
): PathLayer | undefined => {
    const layerProperties: any = getCommonLineProperties(props, config);

    return new PathLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        getPath: (d) => d.geometry.coordinates,
        updateTriggers: {
            getPath: props.updateCount,
            getColor: props.updateCount
        },
        ...eventsToAdd,
        ...layerProperties
    });
};

const getAnimatedArrowPathLayer = (
    props: TransitionMapLayerProps,
    config: LayerDescription.AnimatedPathLayerConfiguration,
    eventsToAdd
): AnimatedArrowPathLayer =>
    new AnimatedArrowPathLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        getPath: (d) => d.geometry.coordinates,
        updateTriggers: {
            getPath: props.updateCount,
            getColor: props.updateCount
        },
        getDistanceBetweenArrows: 15,
        widthMaxPixels: 50,
        speedDivider: Preferences.get('enableMapAnimations', true) ? 10 : 0,
        ...eventsToAdd,
        ...getCommonLineProperties(props, config)
    });

const getPolygonLayer = (
    props: TransitionMapLayerProps,
    config: LayerDescription.PolygonLayerConfiguration,
    eventsToAdd
): GeoJsonLayer => {
    const layerProperties: any = getCommonProperties(props, config);
    if (layerProperties.getColor) {
        layerProperties.getFillColor = layerProperties.getColor;
        delete layerProperties.getColor;
    }

    const lineColor = config.lineColor === undefined ? undefined : layerColorGetter(config.lineColor, '#ffffff');
    layerProperties.getLineColor = lineColor !== undefined ? lineColor : [80, 80, 80];

    const lineWidth = config.lineWidth === undefined ? 1 : layerNumberGetter(config.lineWidth, 10);
    layerProperties.getLineWidth = lineWidth;

    const widthMinPixels =
        config.lineWidthMinPixels === undefined ? undefined : layerNumberGetter(config.lineWidthMinPixels, 1);
    if (widthMinPixels !== undefined) {
        layerProperties.lineWidthMinPixels = widthMinPixels;
    }

    const pickable =
        config.pickable === undefined
            ? true
            : typeof config.pickable === 'function'
                ? config.pickable()
                : config.pickable;
    layerProperties.pickable = pickable;

    return new GeoJsonLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        updateTriggers: {
            getFillColor: props.updateCount
        },
        stroked: true,
        filled: layerProperties.getFillColor !== undefined,
        wireframe: true,
        lineWidthMinPixels: 1,
        ...eventsToAdd,
        ...layerProperties
    });
};

const getScatterLayer = (
    props: TransitionMapLayerProps,
    config: LayerDescription.PointLayerConfiguration,
    eventsToAdd
): ScatterplotLayer<any> | undefined => {
    const layerProperties: any = getCommonProperties(props, config);
    const contourWidth =
        config.strokeWidth === undefined ? undefined : layerNumberGetter(config.strokeWidth, undefined);
    if (contourWidth !== undefined) {
        layerProperties.getLineWidth = contourWidth;
    }
    const circleRadius = config.radius === undefined ? undefined : layerNumberGetter(config.radius, 10);
    if (circleRadius !== undefined) {
        layerProperties.getRadius = circleRadius;
    }
    const contourColor = config.strokeColor === undefined ? undefined : layerColorGetter(config.strokeColor, '#ffffff');
    if (contourColor !== undefined) {
        layerProperties.getLineColor = contourColor;
    }
    const radiusScale = config.radiusScale === undefined ? undefined : layerNumberGetter(config.radiusScale, 1);
    if (radiusScale !== undefined) {
        layerProperties.radiusScale = radiusScale;
    }
    const lineWidthScale =
        config.strokeWidthScale === undefined ? undefined : layerNumberGetter(config.strokeWidthScale, 1);
    if (lineWidthScale !== undefined) {
        layerProperties.lineWidthScale = lineWidthScale;
    }
    const pickable =
        config.pickable === undefined
            ? true
            : typeof config.pickable === 'function'
                ? config.pickable()
                : config.pickable;
    return new ScatterplotLayer({
        id: props.layerDescription.id,
        data: props.layerDescription.layerData.features,
        filled: layerProperties.getColor !== undefined,
        stroked: contourColor !== undefined || contourWidth !== undefined,
        getPosition: (d) => d.geometry.coordinates,
        updateTriggers: {
            getPosition: props.updateCount,
            getFillColor: props.updateCount
        },
        pickable,
        ...eventsToAdd,
        ...layerProperties
    });
};

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
    if (LayerDescription.layerIsCircle(props.layerDescription.configuration)) {
        // FIXME Try not to type as any
        return getScatterLayer(props, props.layerDescription.configuration, eventsToAdd) as any;
    } else if (LayerDescription.layerIsLine(props.layerDescription.configuration)) {
        return getLineLayer(props, props.layerDescription.configuration, eventsToAdd) as any;
    } else if (LayerDescription.layerIsPolygon(props.layerDescription.configuration)) {
        return getPolygonLayer(props, props.layerDescription.configuration, eventsToAdd) as any;
    } else if (LayerDescription.layerIsAnimatedPath(props.layerDescription.configuration)) {
        return getAnimatedArrowPathLayer(props, props.layerDescription.configuration, eventsToAdd) as any;
    }
    console.log('unknown layer', props.layerDescription.configuration);
    return undefined;
};

export default getLayer;
