/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MjolnirGestureEvent, MjolnirPointerEvent } from 'mjolnir.js';
import { PickingInfo } from '@deck.gl/core';
import {
    MapEventHandlerDescriptor,
    mapEventNames,
    MapSelectEventHandlerDescriptor,
    TooltipEventHandlerDescriptor,
    MapCallbacks,
    MapEventHandlerDescription,
    MapLayerEventHandlerDescriptor,
    layerEventNames,
    tooltipEventNames,
    BaseMapEventHandlerDescriptor,
    PointInfo
} from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';

/**
 * A class handling event management for the map. It manages and event handlers
 * and prepares them by layer. It properly executes the events when they are
 * triggered.
 */
export class MapEventsManager {
    private mapEventDescriptors: {
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
    private mapCallbacks: MapCallbacks;

    constructor(mapEvents: MapEventHandlerDescription[], mapCallbacks: MapCallbacks) {
        this.mapEventDescriptors = { map: {}, layers: {}, tooltips: {}, mapSelect: {} };
        this.mapCallbacks = mapCallbacks;

        mapEvents.forEach((eventDescriptor) => {
            if (eventDescriptor.type === 'layer') {
                this.mapEventDescriptors.layers[eventDescriptor.layerName] =
                    this.mapEventDescriptors.layers[eventDescriptor.layerName] || {};
                const events =
                    this.mapEventDescriptors.layers[eventDescriptor.layerName][eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEventDescriptors.layers[eventDescriptor.layerName][eventDescriptor.eventName] = events;
            } else if (eventDescriptor.type === 'tooltip') {
                this.mapEventDescriptors.tooltips[eventDescriptor.layerName] =
                    this.mapEventDescriptors.tooltips[eventDescriptor.layerName] || {};
                const events =
                    this.mapEventDescriptors.tooltips[eventDescriptor.layerName][eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEventDescriptors.tooltips[eventDescriptor.layerName][eventDescriptor.eventName] = events;
            } else if (eventDescriptor.type === 'mapSelect') {
                this.mapEventDescriptors.mapSelect[eventDescriptor.layerName] =
                    this.mapEventDescriptors.mapSelect[eventDescriptor.layerName] || {};
                const events =
                    this.mapEventDescriptors.mapSelect[eventDescriptor.layerName][eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEventDescriptors.mapSelect[eventDescriptor.layerName][eventDescriptor.eventName] = events;
            } else {
                const events = this.mapEventDescriptors.map[eventDescriptor.eventName] || [];
                events.push(eventDescriptor);
                this.mapEventDescriptors.map[eventDescriptor.eventName] = events;
            }
        });
    }

    private getEventHandlerConditionCheck =
        (activeSection: string) => (eventHandlerDes: BaseMapEventHandlerDescriptor) =>
            eventHandlerDes.condition === undefined || eventHandlerDes.condition(activeSection);

    executeTooltipEvent(
        eventHandlerDes: TooltipEventHandlerDescriptor,
        pickInfo: PickingInfo,
        activeSection: string
    ): string | undefined | { text: string; containsHtml: boolean } {
        if (this.getEventHandlerConditionCheck(activeSection)(eventHandlerDes)) {
            return eventHandlerDes.handler(pickInfo, this.mapCallbacks);
        }
        return undefined;
    }

    executeMapSelectEventsForObjects(
        eventName: mapEventNames,
        ev: MjolnirGestureEvent | MjolnirPointerEvent,
        objectsByLayer: { [layerName: string]: PickingInfo[] },
        activeSection: string
    ) {
        const handledEvents = Object.keys(objectsByLayer).map((layerName) => {
            const mapSelectEvents = this.getMapSelectEvents(layerName);
            if (mapSelectEvents && mapSelectEvents[eventName]) {
                return (
                    mapSelectEvents[eventName]
                        .filter(this.getEventHandlerConditionCheck(activeSection))
                        .map((event: MapSelectEventHandlerDescriptor) =>
                            event.handler(objectsByLayer[layerName], ev, this.mapCallbacks)
                        ).length > 0
                );
            }
            return false;
        });
        return handledEvents.some((handled) => handled);
    }

    executeMapEvents(
        eventName: mapEventNames,
        ev: MjolnirGestureEvent | MjolnirPointerEvent,
        pointInfo: PointInfo,
        activeSection: string
    ): boolean {
        const events = this.mapEventDescriptors.map[eventName];
        if (!events) {
            return false;
        }
        const handledEvents = events
            .filter(this.getEventHandlerConditionCheck(activeSection))
            .map((mapEvent) => mapEvent.handler(pointInfo, ev, this.mapCallbacks));
        return handledEvents.length > 0;
    }

    getTooltipEvents(layerName: string) {
        return this.mapEventDescriptors.tooltips[layerName] || {};
    }

    getLayerEvents(layerName: string) {
        return this.mapEventDescriptors.layers[layerName] || {};
    }

    getMapSelectEvents(layerName: string) {
        return this.mapEventDescriptors.mapSelect[layerName] || {};
    }
}
