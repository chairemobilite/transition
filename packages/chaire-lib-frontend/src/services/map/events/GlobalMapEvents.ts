/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MapboxGL from 'mapbox-gl';
import _debounce from 'lodash.debounce';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { MapEventHandlerDescription } from '../IMapEventHandler';
import { manageZoom } from 'chaire-lib-common/lib/services/geodata/ManageOverlappingLines';

/* This file encapsulates global map events, that do not require a specific context */

const onMouseOut = (_e: MapboxGL.MapMouseEvent) => {
    serviceLocator.eventManager.emit('map.updateMouseCoordinates', null);
};

const onZoomEnd = (_e: MapboxGL.MapMouseEvent) => {
    _debounce((e: MapboxGL.MapMouseEvent) => {
        Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, {
            'map.zoom': e.target.getZoom()
        });
    }, 1000);
    manageZoom(_e.target.getBounds(), _e.target.getZoom());
};

const onDragEnd = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    // TODO _draggingEventsOrder is a custom addition to the map, not typed or anything. Find a better way to do this
    if (map._draggingEventsOrder && map._draggingEventsOrder.length > 0) {
        // this helps reduce false click when dragging/panning the map
        if (map._draggingEventsOrder[map._draggingEventsOrder.length - 1] === 'mouseup') {
            map._draggingEventsOrder = [];
        } else {
            map._draggingEventsOrder.push('dragend');
        }
    }
    _debounce(() => {
        const centerLatLng = map.getCenter();
        Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, {
            'map.center': [centerLatLng.lng, centerLatLng.lat]
        });
    }, 1000)();
    manageZoom(e.target.getBounds(), e.target.getZoom());
};

const onDragStart = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    map._draggingEventsOrder = ['dragstart'];
};

const onMouseMove = (e: MapboxGL.MapMouseEvent) => {
    serviceLocator.eventManager.emit('map.updateMouseCoordinates', e.lngLat.toArray());
};

const globalEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'mouseout', handler: onMouseOut },
    { type: 'map', eventName: 'zoomend', handler: onZoomEnd },
    { type: 'map', eventName: 'dragend', handler: onDragEnd },
    { type: 'map', eventName: 'dragstart', handler: onDragStart },
    { type: 'map', eventName: 'mousemove', handler: onMouseMove }
];

export default globalEventDescriptors;
