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

const isAccessMapActiveSection = (activeSection: string) => activeSection === 'accessibilityMap';

const onAccessMapSectionMapClick = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    serviceLocator.eventManager.emit('routing.transitAccessibilityMap.clickedOnMap', pointInfo.coordinates);
};

const onLocationDrag = (info: PickingInfo, _event: MjolnirEvent) => {
    const location = info.object?.properties?.location;
    if (!location) {
        return;
    }
    serviceLocator.eventManager.emit('routing.transitAccessibilityMap.dragLocation', info.coordinate);
};

const onLocationDragEnd = (info: PickingInfo, _event: MjolnirEvent) => {
    const location = info.object?.properties?.location;
    if (!location) {
        return;
    }
    serviceLocator.eventManager.emit('routing.transitAccessibilityMap.dragLocation', info.coordinate);
};

const accessMapSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'onLeftClick', condition: isAccessMapActiveSection, handler: onAccessMapSectionMapClick },
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
