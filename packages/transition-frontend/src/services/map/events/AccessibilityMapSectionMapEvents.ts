/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MapboxGL from 'mapbox-gl';
import _uniq from 'lodash.uniq';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/* This file encapsulates map events specific for the 'accessibilityMap' section */

const isAccessMapActiveSection = (activeSection: string) => activeSection === 'accessibilityMap';

const onAccessMapSectionMapClick = (e: MapboxGL.MapMouseEvent) => {
    serviceLocator.eventManager.emit('routing.transitAccessibilityMap.clickedOnMap', e.lngLat.toArray());
    e.originalEvent.stopPropagation();
};

const onAccessMapMouseDown = (e: MapboxGL.MapLayerMouseEvent) => {
    if (!e.features || e.features.length === 0) {
        return;
    }
    // start drag:
    const map = e.target as any;
    serviceLocator.eventManager.emit('map.disableDragPan');
    map._currentDraggingFeature = 'accessibilityMapLocation';
    e.originalEvent.stopPropagation();
};

const onAccessMapMouseUp = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    if (map._currentDraggingFeature === 'accessibilityMapLocation') {
        serviceLocator.eventManager.emit('routing.transitAccessibilityMap.dragLocation', e.lngLat.toArray());
        map._currentDraggingFeature = null;
        serviceLocator.eventManager.emit('map.enableDragPan');
        e.originalEvent.stopPropagation();
    }
};

const onAccessMapMouseMove = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    if (map._currentDraggingFeature === 'accessibilityMapLocation') {
        serviceLocator.eventManager.emit('routing.transitAccessibilityMap.dragLocation', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    }
};

const accessMapSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'click', condition: isAccessMapActiveSection, handler: onAccessMapSectionMapClick },
    {
        type: 'layer',
        eventName: 'mousedown',
        layerName: 'accessibilityMapPoints',
        condition: isAccessMapActiveSection,
        handler: onAccessMapMouseDown
    },
    { type: 'map', eventName: 'mouseup', condition: isAccessMapActiveSection, handler: onAccessMapMouseUp },
    { type: 'map', eventName: 'mousemove', condition: isAccessMapActiveSection, handler: onAccessMapMouseMove }
];

export default accessMapSectionEventDescriptors;
