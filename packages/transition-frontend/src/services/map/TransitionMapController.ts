/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { MapController, PickingInfo } from '@deck.gl/core';
import { MjolnirEvent, MjolnirGestureEvent, MjolnirPointerEvent } from 'mjolnir.js';
import { MapEventsManager } from './MapEventsManager';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';

type TransitionMapControllerProps = {
    mapEventsManager?: MapEventsManager;
    mapCallbacks?: MapCallbacks;
    activeSection?: string;
};

/**
 * Main map controller, used to override default event handling, as the
 * Deck.GL's component does not expose all events we need, for example
 * 'pointermove'
 */
export class TransitionMapController extends MapController {
    // The current event manager containing the active event descriptors
    private mapEventsManager: MapEventsManager | undefined;
    // The callbacks to interact with the map
    private mapCallbacks: MapCallbacks | undefined;
    // The active section, used when calling the events
    private activeSection: string | undefined;

    constructor(props: Parameters<MapController['setProps']>[0] & TransitionMapControllerProps) {
        super(props as any);

        this.events = ['click'];
    }

    setProps(props: Parameters<MapController['setProps']>[0] & TransitionMapControllerProps) {
        super.setProps(props);
        this.mapEventsManager = props.mapEventsManager;
        this.mapCallbacks = props.mapCallbacks;
        this.activeSection = props.activeSection;
    }

    // Main event handler, overriding parent's handler. Returns whether the event was handled
    handleEvent(event: MjolnirEvent) {
        if (event.handled) return true;
        if (event.type === 'pointermove') {
            return this._onPointerMove(event);
        }
        if (event.type === 'click') {
            const pickInfo = this.mapCallbacks?.pickObject({
                x: event.offsetCenter.x,
                y: event.offsetCenter.y,
                radius: 4
            });
            // When tapCount is 2, it's a double click
            if (event.tapCount === 2) {
                return this._onDblClick(pickInfo, event);
            }
            return this._onClick(pickInfo, event);
        } else {
            return super.handleEvent(event);
        }
    }
    private _onPointerMove(_event: MjolnirGestureEvent | MjolnirPointerEvent) {
        // TODO Implement the pointermove event in our API
        return false;
    }
    private _onDblClick(_pickInfo: PickingInfo | null | undefined, _event: MjolnirGestureEvent) {
        // TODO Implement the double click event in our API
        return false;
    }

    private _onClick(pickInfo: PickingInfo | null | undefined, event: MjolnirGestureEvent): boolean {
        let handled = false;

        if (pickInfo) {
            // See if there are multiple picks to call proper mapSelect events
            // TODO Update the radius to not have an hard-coded value, fine-tune as necessary
            const objects: PickingInfo[] = this.mapCallbacks!.pickMultipleObjects({
                x: pickInfo.x,
                y: pickInfo.y,
                radius: 4,
                layerIds: this.state.visibleLayers
            });
            const objectsByLayer: { [layerName: string]: PickingInfo[] } = {};
            objects.forEach((picked) => {
                if (picked.layer && picked.object) {
                    const allPicked = objectsByLayer[picked.layer.id] || [];
                    allPicked.push(picked);
                    objectsByLayer[picked.layer.id] = allPicked;
                }
            });
            // Execute the map selection events on picked objects
            handled = this.mapEventsManager!.executeMapSelectEventsForObjects(
                event,
                objectsByLayer,
                this.activeSection!
            );
        }
        if (!handled) {
            // Execute map events, if there was no event handled by the selection or if the selection is missing
            const coordinates = pickInfo
                ? (pickInfo.coordinate as number[])
                : this.mapCallbacks?.pixelsToCoordinates([event.offsetCenter.x, event.offsetCenter.y]);
            if (!coordinates) return false;
            const pointInfo = {
                coordinates: coordinates,
                pixel: [event.offsetCenter.x, event.offsetCenter.y] as [number, number]
            };
            handled = this.mapEventsManager!.executeMapEvents(event, pointInfo, this.activeSection!);
        }
        return handled;
    }
}
