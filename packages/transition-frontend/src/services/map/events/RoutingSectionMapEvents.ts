/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MjolnirEvent } from 'mjolnir.js';

import { MapEventHandlerDescription, PointInfo } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { PickingInfo } from 'deck.gl';

/* This file encapsulates map events specific for the 'routing' section */

// TODO: Set a flag instead of checking if the section is part of a list, especially if we add a third routing section.
const isRoutingActiveSection = (activeSection: string) => {
    return activeSection === 'routing' || activeSection === 'comparison';
};

const onRoutingSectionMapClick = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    serviceLocator.eventManager.emit('routing.transit.clickedOnMap', pointInfo.coordinates);
    return true;
};

const onRoutingPointDrag = (info: PickingInfo, _event: MjolnirEvent) => {
    const location = info.object?.properties?.location;
    if (!location) {
        return false;
    }
    serviceLocator.eventManager.emit(
        `routing.transit.drag${location === 'origin' ? 'Origin' : 'Destination'}`,
        info.coordinate
    );
    return true;
};

const onRoutingPointDragEnd = (info: PickingInfo, _event: MjolnirEvent) => {
    const location = info.object?.properties?.location;
    if (!location) {
        return false;
    }
    serviceLocator.eventManager.emit(
        `routing.transit.update${location === 'origin' ? 'Origin' : 'Destination'}`,
        info.coordinate
    );
    return true;
};

const onRoutingSectionContextMenu = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    serviceLocator.eventManager.emit('map.showContextMenu', pointInfo.pixel, [
        {
            title: 'transit:transitRouting:contextMenu:SetAsOrigin',
            onClick: () => serviceLocator.eventManager.emit('routing.transit.clickedOnMap', pointInfo.coordinates, true)
        },
        {
            title: 'transit:transitRouting:contextMenu:SetAsDestination',
            onClick: () =>
                serviceLocator.eventManager.emit('routing.transit.clickedOnMap', pointInfo.coordinates, false)
        }
    ]);
    return true;
};

const routingSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'onRightClick', condition: isRoutingActiveSection, handler: onRoutingSectionContextMenu },
    { type: 'map', eventName: 'onLeftClick', condition: isRoutingActiveSection, handler: onRoutingSectionMapClick },
    {
        type: 'layer',
        layerName: 'routingPoints',
        eventName: 'onDrag',
        condition: isRoutingActiveSection,
        handler: onRoutingPointDrag
    },
    {
        type: 'layer',
        layerName: 'routingPoints',
        eventName: 'onDragEnd',
        condition: isRoutingActiveSection,
        handler: onRoutingPointDragEnd
    }
];

export default routingSectionEventDescriptors;
