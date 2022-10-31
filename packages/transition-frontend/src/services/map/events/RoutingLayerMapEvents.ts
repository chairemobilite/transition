/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the routingPoints layer, in any section */
import MapboxGL from 'mapbox-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';

const onRoutingPointMouseEnter = (e: MapboxGL.MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        e.target.getCanvas().style.cursor = 'pointer';
    }
};

const onRoutingPointMouseLeave = (e: MapboxGL.MapLayerMouseEvent) => {
    e.target.getCanvas().style.cursor = '';
};

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'layer', layerName: 'routingPoints', eventName: 'mouseenter', handler: onRoutingPointMouseEnter },
    { type: 'layer', layerName: 'routingPoints', eventName: 'mouseleave', handler: onRoutingPointMouseLeave }
];

export default nodeLayerEventDescriptors;
