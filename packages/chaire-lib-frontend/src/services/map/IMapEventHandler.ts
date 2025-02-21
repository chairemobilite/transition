/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MjolnirEvent } from 'mjolnir.js';
import { PickingInfo, Deck } from 'deck.gl';

export type MapCallbacks = {
    pickMultipleObjects: typeof Deck.prototype.pickMultipleObjects;
    pickObject: typeof Deck.prototype.pickObject;
    pixelsToCoordinates: (pixels: [number, number]) => number[];
};
/**
 * Information about a point on the map. Coordinates are in the map's coordinate
 * system (WSG84). Order is [longitude, latitude] (x, y). Pixel is the pixel
 * location on the screen (x, y)
 */
export type PointInfo = { coordinates: number[]; pixel: [number, number] };
/**
 * Map event handler function type. Called for interactions with the map,
 * without features underneath or when no other handler was executed.
 * @returns `true` if the event was handled, this will stop propagation of the
 * event, false otherwise
 */
export type MapEventHandler = (pointInfo: PointInfo, e: MjolnirEvent, mapCallbacks: MapCallbacks) => boolean;
/**
 * Map select event handler function type. Called when no layer event was
 * executed on a specific element but there are one or more features under the
 * event location.
 * @returns `true` if the event was handled, this will stop propagation of the
 * event, false otherwise
 */
export type MapSelectEventHandler = (pickInfo: PickingInfo[], e: MjolnirEvent, mapCallbacks: MapCallbacks) => boolean;
/**
 * Map layer event handler function type. These events are called for specific features of a specific layer.
 * @returns `true` if the event was handled, this will stop propagation of the event, false otherwise
 */
export type MapLayerEventHandler = (pickInfo: PickingInfo, e: MjolnirEvent, mapCallbacks: MapCallbacks) => boolean;
/**
 * Tolltip event handler function type. Called when the mouse hovers over a feature.
 * @returns The tooltip to display, or `undefined` if no tooltip should be displayed
 */
export type TooltipEventHandler = (
    pickInfo: PickingInfo,
    mapCallbacks: MapCallbacks
) => string | undefined | { text: string; containsHtml: boolean };

export type layerEventNames = 'onLeftClick' | 'onRightClick' | 'onDragStart' | 'onDrag' | 'onDragEnd' | 'onHover';
export type tooltipEventNames = 'onTooltip';
export type mapEventNames = 'onLeftClick' | 'onRightClick' | 'onLeftDblClick' | 'onRightDblClick' | 'onPointerMove';

export type BaseMapEventHandlerDescriptor = {
    /**
     * Condition function for which this handler applies. It will be checked
     * before actually calling the handler, so the handler can assume this is
     * true.
     *
     * TODO: This should depend on some application's state or context, that
     * should be passed here. For now, we pass the active section and the rest
     * can be accessed through the serviceLocator
     * */
    condition?: (activeSection: string) => boolean;
};

export type MapEventHandlerDescriptor = BaseMapEventHandlerDescriptor & {
    /** Type for handlers that only require the layer to be active */
    type: 'map';
    eventName: mapEventNames;
    /**
     * The event handler
     */
    handler: MapEventHandler;
};

/**
 * Type of event called when no layer event was handled on a specific element,
 * but there might be features under the event location. Ideal to handle
 * multiple features, as `MapLayerEventHandlerDescriptor` will only handle the
 * top-most selected element
 */
export type MapSelectEventHandlerDescriptor = BaseMapEventHandlerDescriptor & {
    /** Type for handlers that only require the layer to be active */
    type: 'mapSelect';
    layerName: string;
    eventName: mapEventNames;
    /**
     * The event handler
     */
    handler: MapSelectEventHandler;
};

export type MapLayerEventHandlerDescriptor = BaseMapEventHandlerDescriptor & {
    /** Type for handler that require selected features */
    type: 'layer';
    layerName: string;
    eventName: layerEventNames;
    /**
     * The event handler
     */
    handler: MapLayerEventHandler;
};

export type TooltipEventHandlerDescriptor = BaseMapEventHandlerDescriptor & {
    /** Type for handler that require selected features */
    type: 'tooltip';
    layerName: string;
    eventName: tooltipEventNames;
    /**
     * The event handler
     */
    handler: TooltipEventHandler;
};

export type MapEventHandlerDescription =
    | MapEventHandlerDescriptor
    | MapLayerEventHandlerDescriptor
    | TooltipEventHandlerDescriptor
    | MapSelectEventHandlerDescriptor;
