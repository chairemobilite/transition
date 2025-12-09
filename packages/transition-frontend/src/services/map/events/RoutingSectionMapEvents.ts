/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import maplibregl from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/* This file encapsulates map events specific for the 'routing' section */

// TODO: Set a flag instead of checking if the section is part of a list, especially if we add a third routing section.
const isRoutingActiveSection = (activeSection: string) => {
    return activeSection === 'routing' || activeSection === 'comparison';
};

const onRoutingSectionMapClick = (e: maplibregl.MapMouseEvent) => {
    serviceLocator.eventManager.emit('routing.transit.clickedOnMap', e.lngLat.toArray());
    e.originalEvent.stopPropagation();
};

const onRoutingPointMouseDown = (e: maplibregl.MapLayerMouseEvent) => {
    const features = e.features;
    if (!features || features.length === 0) {
        return;
    }
    // start drag:
    if (e.features && e.features[0]) {
        const feature = e.features[0];
        const map = e.target as any;
        const location = feature.properties?.location;
        if (location) {
            // TODO Do not hardcode those strings
            map._currentDraggingFeature = location === 'origin' ? 'routingOrigin' : 'routingDestination';
            serviceLocator.eventManager.emit('map.disableDragPan');
        }
    }
};

const onRoutingPointMouseUp = (e: maplibregl.MapMouseEvent) => {
    const map = e.target as any;
    if (map._currentDraggingFeature === 'routingOrigin' || map._currentDraggingFeature === 'routingDestination') {
        serviceLocator.eventManager.emit(
            map._currentDraggingFeature === 'routingOrigin'
                ? 'routing.transit.updateOrigin'
                : 'routing.transit.updateDestination',
            e.lngLat.toArray()
        );
        map._currentDraggingFeature = null;
        serviceLocator.eventManager.emit('map.enableDragPan');
    }
};

const onRoutingPointMouseMove = (e: maplibregl.MapMouseEvent) => {
    const map = e.target as any;
    if (map._currentDraggingFeature === 'routingOrigin') {
        serviceLocator.eventManager.emit('routing.transit.dragOrigin', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    } else if (map._currentDraggingFeature === 'routingDestination') {
        serviceLocator.eventManager.emit('routing.transit.dragDestination', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    }
};

const onRoutingSectionContextMenu = (e: maplibregl.MapMouseEvent) => {
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
