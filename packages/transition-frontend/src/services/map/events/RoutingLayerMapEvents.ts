/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the routingPoints layer, in any section */
import type { MapLayerMouseEvent } from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { addHoverClass, removeHoverClass } from '../MapCursorHelper';

const onRoutingPointMouseEnter = (e: MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        addHoverClass();
    }
};

const onRoutingPointMouseLeave = (_e: MapLayerMouseEvent) => {
    removeHoverClass();
};

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'layer', layerName: 'routingPoints', eventName: 'mouseenter', handler: onRoutingPointMouseEnter },
    { type: 'layer', layerName: 'routingPoints', eventName: 'mouseleave', handler: onRoutingPointMouseLeave }
];

export default nodeLayerEventDescriptors;
