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
export type PointInfo = { coordinates: number[]; pixel: [number, number] };
export type MapEventHandler = (pointInfo: PointInfo, e: MjolnirEvent, mapCallbacks: MapCallbacks) => void;
export type MapSelectEventHandler = (pickInfo: PickingInfo[], e: MjolnirEvent, mapCallbacks: MapCallbacks) => void;
export type MapLayerEventHandler = (pickInfo: PickingInfo, e: MjolnirEvent, mapCallbacks: MapCallbacks) => void;
export type TooltipEventHandler = (
    pickInfo: PickingInfo,
    mapCallbacks: MapCallbacks
) => string | undefined | { text: string; containsHtml: boolean };

export type layerEventNames = 'onLeftClick' | 'onRightClick' | 'onDragStart' | 'onDrag' | 'onDragEnd' | 'onHover';
export type tooltipEventNames = 'onTooltip';
export type mapEventNames = 'onLeftClick' | 'onRightClick';

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
