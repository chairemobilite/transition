/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { MapEventHandlerDescription } from '../IMapEventHandler';

// TODO: Make zoomLimit modifiable by user
// const zoomLimit = 14; //Zoom levels smaller than this will not apply line separation
// const applyAestheticChangesNonce: object = new Object();

/* This file encapsulates global map events, that do not require a specific context */
/*
const onMouseOut = (_e: MapboxGL.MapMouseEvent) => {
    serviceLocator.eventManager.emit('map.updateMouseCoordinates', null);
};

const onZoomEnd = (_e: MapboxGL.MapMouseEvent) => {
    _debounce((e: MapboxGL.MapMouseEvent) => {
        Preferences.update(
            {
                'map.zoom': e.target.getZoom()
            },
            serviceLocator.socketEventManager
        );
    }, 1000);
    const boundsGL = _e.target.getBounds();
    applyAestheticChanges(boundsGL, _e.target.getZoom());
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
        Preferences.update(
            {
                'map.center': [centerLatLng.lng, centerLatLng.lat]
            },
            serviceLocator.socketEventManager
        );
    }, 1000)();
    const boundsGL = e.target.getBounds();
    applyAestheticChanges(boundsGL, e.target.getZoom());
};

const onDragStart = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    map._draggingEventsOrder = ['dragstart'];
};

const onMouseMove = (e: MjolnirEvent) => {
    serviceLocator.eventManager.emit('map.updateMouseCoordinates', e.lngLat.toArray());
};
*/
const globalEventDescriptors: MapEventHandlerDescription[] = [
    /*  { type: 'map', eventName: 'mouseout', handler: onMouseOut },
    { type: 'map', eventName: 'zoomend', handler: onZoomEnd },
    { type: 'map', eventName: 'dragend', handler: onDragEnd },
    { type: 'map', eventName: 'dragstart', handler: onDragStart },
    { type: 'map', eventName: 'mousemove', handler: onMouseMove } */
];

// TODO Move to Transition
/*
const applyAestheticChanges = async (boundsGL: MapboxGL.LngLatBounds, zoom: number): Promise<void> => {
    if (!Preferences.get('features.map.prettyDisplay', false)) {
        return;
    }

    const localNonce = (applyAestheticChangesNonce = new Object());
    const isCancelled = () => localNonce !== applyAestheticChangesNonce;

    if (zoom <= zoomLimit) {
        return;
    }

    if (isCancelled && isCancelled()) {
        return;
    }

    const sw = boundsGL.getSouthWest().toArray();
    const ne = boundsGL.getNorthEast().toArray();
    const bounds = [sw, ne];
    const boundsPolygon = bboxPolygon(bbox(lineString(bounds)));

    const layer = serviceLocator.layerManager._layersByName['transitPaths'].source.data;
    const linesInView = getLinesInView(boundsPolygon, layer);
    await offsetOverlappingLines(linesInView, isCancelled).catch(() => {
        return;
    }); // isCancelled is handled after
    if (isCancelled && isCancelled()) {
        return;
    }

    const transitNodes = serviceLocator.layerManager._layersByName['transitNodes'].source.data;
    const nodesInView = getNodesInView(boundsPolygon, transitNodes);
    await manageRelocatingNodes(nodesInView, linesInView, isCancelled).catch(() => {
        return;
    });
    if (isCancelled && isCancelled()) {
        return;
    }

    (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
        layerName: 'transitPaths',
        data: layer
    });

    serviceLocator.eventManager.emit('map.updateLayers', {
        transitNodes: transitNodes
    });
}; */

export default globalEventDescriptors;
