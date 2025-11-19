/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import maplibregl from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/* This file encapsulates map events specific for the 'accessibilityMap' section */

const isAccessMapActiveSection = (activeSection: string) =>
    activeSection === 'accessibilityMap' || activeSection === 'accessibilityComparison';

const isAccessMapComparisonActiveSection = (activeSection: string) => activeSection === 'accessibilityComparison';

const onAccessMapSectionMapClick = (e: maplibregl.MapMouseEvent) => {
    serviceLocator.eventManager.emit(
        'routing.transitAccessibilityMap.clickedOnMap',
        e.lngLat.toArray(),
        'accessibilityMapLocation'
    );
    e.originalEvent.stopPropagation();
};

const onAccessMapMouseDown = (e: maplibregl.MapLayerMouseEvent) => {
    if (!e.features || e.features.length === 0) {
        return;
    }
    // start drag:
    const feature = e.features[0];
    const map = e.target as any;
    serviceLocator.eventManager.emit('map.disableDragPan');
    map._currentDraggingFeature = feature.properties?.location;
    e.originalEvent.stopPropagation();
};

const onAccessMapMouseUp = (e: maplibregl.MapMouseEvent) => {
    const map = e.target as any;
    if (
        map._currentDraggingFeature === 'accessibilityMapLocation' ||
        map._currentDraggingFeature === 'accessibilityMapLocation2'
    ) {
        serviceLocator.eventManager.emit(
            'routing.transitAccessibilityMap.dragLocation',
            e.lngLat.toArray(),
            map._currentDraggingFeature
        );
        map._currentDraggingFeature = null;
        serviceLocator.eventManager.emit('map.enableDragPan');
        e.originalEvent.stopPropagation();
    }
};

const onAccessMapMouseMove = (e: maplibregl.MapMouseEvent) => {
    const map = e.target as any;
    if (
        map._currentDraggingFeature === 'accessibilityMapLocation' ||
        map._currentDraggingFeature === 'accessibilityMapLocation2'
    ) {
        serviceLocator.eventManager.emit(
            'routing.transitAccessibilityMap.dragLocation',
            e.lngLat.toArray(),
            map._currentDraggingFeature
        );
        e.originalEvent.stopPropagation();
    }
};

const onLocationComparisonContextMenu = (e: maplibregl.MapMouseEvent) => {
    serviceLocator.eventManager.emit('map.showMapComparisonContextMenu', e, [
        {
            title: 'transit:accessibilityComparison:contextMenu:SetAsLocation1',
            onClick: () =>
                serviceLocator.eventManager.emit(
                    'routing.transitAccessibilityMap.clickedOnMap',
                    e.lngLat.toArray(),
                    'accessibilityMapLocation'
                )
        },
        {
            title: 'transit:accessibilityComparison:contextMenu:SetAsLocation2',
            onClick: () =>
                serviceLocator.eventManager.emit(
                    'routing.transitAccessibilityMap.clickedOnMap',
                    e.lngLat.toArray(),
                    'accessibilityMapLocation2'
                )
        }
    ]);
};

const accessMapSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'click', condition: isAccessMapActiveSection, handler: onAccessMapSectionMapClick },
    {
        type: 'map',
        eventName: 'contextmenu',
        condition: isAccessMapComparisonActiveSection,
        handler: onLocationComparisonContextMenu
    },
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
