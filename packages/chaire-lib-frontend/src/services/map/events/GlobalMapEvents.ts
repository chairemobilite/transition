/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MapboxGL from 'mapbox-gl';
import _debounce from 'lodash.debounce';
import { lineString, bboxPolygon, bbox, feature } from '@turf/turf';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { MapEventHandlerDescription } from '../IMapEventHandler';
import { getLinesInView, manageOverlappingLines } from 'chaire-lib-common/lib/services/geodata/ManageOverlappingLines';
import { getNodesInView, manageRelocatingNodes } from 'chaire-lib-common/lib/services/geodata/RelocateNodes';

const zoomLimit = 14; //Zoom levels smaller than this will not apply line separation
// TODO: Make zoomLimit modifiable by user

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
        Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, {
            'map.center': [centerLatLng.lng, centerLatLng.lat]
        });
    }, 1000)();
    const boundsGL = e.target.getBounds();
    applyAestheticChanges(boundsGL, e.target.getZoom());
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

const applyAestheticChanges = (boundsGL: MapboxGL.LngLatBounds, zoom: number): void => {
    if (zoom <= zoomLimit) {
        return;
    }
    
    const sw = boundsGL.getSouthWest().toArray();
    const ne = boundsGL.getNorthEast().toArray();
    const bounds = [sw, ne];
    const boundsPolygon = bboxPolygon(bbox(lineString(bounds)));
    
    let layer = (serviceLocator.layerManager._layersByName['transitPaths'].source.data);
    const linesInView = getLinesInView(boundsPolygon, layer);
    manageOverlappingLines(linesInView);

    const transitNodes = serviceLocator.layerManager._layersByName['transitNodes'].source.data; 
    const nodesInView = getNodesInView(boundsPolygon, transitNodes);
    manageRelocatingNodes(nodesInView, linesInView);

    serviceLocator.eventManager.emit(
        'map.updateLayer',
        'transitPaths',
        layer
    );

    serviceLocator.eventManager.emit('map.updateLayers', {
        transitNodes: transitNodes
    }); 
};

export default globalEventDescriptors;
