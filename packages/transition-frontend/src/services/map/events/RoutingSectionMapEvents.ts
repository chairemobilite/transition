/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapWithCustomEventsState } from 'chaire-lib-frontend/lib/services/map/MapWithCustomEventsState';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { addDraggingClass, removeDraggingClass, removeHoverClass } from '../MapCursorHelper';

/* This file encapsulates map events specific for the 'routing' section */

// TODO: Set a flag instead of checking if the section is part of a list, especially if we add a third routing section.
const isRoutingActiveSection = (activeSection: string) => {
    return activeSection === 'routing' || activeSection === 'comparison';
};

const onRoutingSectionMapClick = (e: MapMouseEvent) => {
    serviceLocator.eventManager.emit('routing.transit.clickedOnMap', e.lngLat.toArray());
    e.originalEvent.stopPropagation();
};

const onRoutingPointMouseDown = (e: MapLayerMouseEvent) => {
    const features = e.features;
    if (!features || features.length === 0) {
        return;
    }
    // start drag:
    if (e.features && e.features[0]) {
        const feature = e.features[0];
        const map = e.target as MapWithCustomEventsState;
        const location = feature.properties?.location;
        if (location) {
            // TODO Do not hardcode those strings
            map._currentDraggingFeature = location === 'origin' ? 'routingOrigin' : 'routingDestination';
            serviceLocator.eventManager.emit('map.disableDragPan');
            addDraggingClass();
        }
    }
};

const onRoutingPointMouseUp = (e: MapMouseEvent) => {
    const map = e.target as MapWithCustomEventsState;
    if (map._currentDraggingFeature === 'routingOrigin' || map._currentDraggingFeature === 'routingDestination') {
        serviceLocator.eventManager.emit(
            map._currentDraggingFeature === 'routingOrigin'
                ? 'routing.transit.updateOrigin'
                : 'routing.transit.updateDestination',
            e.lngLat.toArray()
        );
        map._currentDraggingFeature = null;
        removeDraggingClass();
        removeHoverClass(); // Clean up hover state since mouseleave doesn't fire during drag
        serviceLocator.eventManager.emit('map.enableDragPan');
    }
};

const onRoutingPointMouseMove = (e: MapMouseEvent) => {
    const map = e.target as MapWithCustomEventsState;
    if (map._currentDraggingFeature === 'routingOrigin') {
        serviceLocator.eventManager.emit('routing.transit.dragOrigin', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    } else if (map._currentDraggingFeature === 'routingDestination') {
        serviceLocator.eventManager.emit('routing.transit.dragDestination', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    }
};

const onRoutingSectionContextMenu = (e: MapMouseEvent) => {
    serviceLocator.eventManager.emit('map.showContextMenu', e, [
        {
            title: 'transit:transitRouting:contextMenu:SetAsOrigin',
            onClick: () => serviceLocator.eventManager.emit('routing.transit.clickedOnMap', e.lngLat.toArray(), true)
        },
        {
            title: 'transit:transitRouting:contextMenu:SetAsDestination',
            onClick: () => serviceLocator.eventManager.emit('routing.transit.clickedOnMap', e.lngLat.toArray(), false)
        }
    ]);
};

const routingSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'click', condition: isRoutingActiveSection, handler: onRoutingSectionMapClick },
    { type: 'map', eventName: 'contextmenu', condition: isRoutingActiveSection, handler: onRoutingSectionContextMenu },
    {
        type: 'layer',
        eventName: 'mousedown',
        layerName: 'routingPoints',
        condition: isRoutingActiveSection,
        handler: onRoutingPointMouseDown
    },
    { type: 'map', eventName: 'mouseup', condition: isRoutingActiveSection, handler: onRoutingPointMouseUp },
    { type: 'map', eventName: 'mousemove', condition: isRoutingActiveSection, handler: onRoutingPointMouseMove }
];

export default routingSectionEventDescriptors;
