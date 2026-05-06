/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { getWaypointMinZoom, TRANSIT_PATH_WAYPOINT_MAP_LAYER_NAMES } from '../../config/layers.config';

/** Generic event the map subscribes to to update the minzoom of a list of layers. */
export const MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT = 'map.updateLayersMinZoom';

/** Payload of {@link MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT}. */
export type MapUpdateLayersMinZoomPayload = {
    layerNames: string[];
    minZoom: number;
};

/**
 * Bridges the waypoint min-zoom preference to a generic map event so the map
 * does not need to know about a specific preference.
 *
 * On `preferences.updated` (and on demand via {@link applyNow}) it reads
 * `getWaypointMinZoom()` and emits {@link MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT} with
 * the path waypoint layer names and the resolved min zoom.
 */
class PathWaypointZoomSync {
    private _eventManager: EventEmitter | undefined;

    /** Subscribe to preference updates. Idempotent. */
    start(eventManager: EventEmitter): void {
        if (this._eventManager) {
            return;
        }
        this._eventManager = eventManager;
        eventManager.on('preferences.updated', this._onPreferencesUpdated);
    }

    /** Unsubscribe. Safe to call when not started. */
    stop(): void {
        if (!this._eventManager) {
            return;
        }
        this._eventManager.off('preferences.updated', this._onPreferencesUpdated);
        this._eventManager = undefined;
    }

    /** Emit the generic event now (e.g. after the map first loads). */
    applyNow(eventManager: EventEmitter): void {
        const payload: MapUpdateLayersMinZoomPayload = {
            layerNames: [...TRANSIT_PATH_WAYPOINT_MAP_LAYER_NAMES],
            minZoom: getWaypointMinZoom()
        };
        eventManager.emit(MAP_UPDATE_LAYERS_MIN_ZOOM_EVENT, payload);
    }

    private _onPreferencesUpdated = (): void => {
        if (this._eventManager) {
            this.applyNow(this._eventManager);
        }
    };
}

export default new PathWaypointZoomSync();
