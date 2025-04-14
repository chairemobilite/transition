/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MjolnirEvent } from 'mjolnir.js';
import { PickingInfo } from 'deck.gl';

import { MapEventHandlerDescription, PointInfo } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/* This file encapsulates map events specific for the 'accessibilityMap' section */

const isAccessMapActiveSection = (activeSection: string) =>
    activeSection === 'accessibilityMap' || activeSection === 'accessibilityComparison';

const isAccessMapComparisonActiveSection = (activeSection: string) => activeSection === 'accessibilityComparison';

const onAccessMapSectionMapClick = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    serviceLocator.eventManager.emit(
        'routing.transitAccessibilityMap.clickedOnMap',
        pointInfo.coordinates,
        'accessibilityMapLocation'
    );
    return true;
};

const onLocationDrag = (info: PickingInfo, _event: MjolnirEvent) => {
    const location = info.object?.properties?.location;
    if (!location) {
        return false;
    }
    serviceLocator.eventManager.emit('routing.transitAccessibilityMap.dragLocation', info.coordinate, location);
    return true;
};

const onLocationDragEnd = (info: PickingInfo, _event: MjolnirEvent) => {
    const location = info.object?.properties?.location;
    if (!location) {
        return false;
    }
    serviceLocator.eventManager.emit('routing.transitAccessibilityMap.dragLocation', info.coordinate, location);
    return true;
};

const onLocationComparisonContextMenu = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    serviceLocator.eventManager.emit('map.showMapComparisonContextMenu', pointInfo.pixel, [
        {
            title: 'transit:accessibilityComparison:contextMenu:SetAsLocation1',
            onClick: () =>
                serviceLocator.eventManager.emit(
                    'routing.transitAccessibilityMap.clickedOnMap',
                    pointInfo.coordinates,
                    'accessibilityMapLocation'
                )
        },
        {
            title: 'transit:accessibilityComparison:contextMenu:SetAsLocation2',
            onClick: () =>
                serviceLocator.eventManager.emit(
                    'routing.transitAccessibilityMap.clickedOnMap',
                    pointInfo.coordinates,
                    'accessibilityMapLocation2'
                )
        }
    ]);
    return true;
};

const accessMapSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'onLeftClick', condition: isAccessMapActiveSection, handler: onAccessMapSectionMapClick },
    {
        type: 'map',
        eventName: 'onRightClick',
        condition: isAccessMapComparisonActiveSection,
        handler: onLocationComparisonContextMenu
    },
    {
        type: 'layer',
        layerName: 'accessibilityMapPoints',
        eventName: 'onDrag',
        condition: isAccessMapActiveSection,
        handler: onLocationDrag
    },
    {
        type: 'layer',
        layerName: 'accessibilityMapPoints',
        eventName: 'onDragEnd',
        condition: isAccessMapActiveSection,
        handler: onLocationDragEnd
    }
];

export default accessMapSectionEventDescriptors;
