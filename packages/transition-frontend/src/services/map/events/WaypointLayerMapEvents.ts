/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the waypoints layer */
import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { PickingInfo } from 'deck.gl';
import { t } from 'i18next';

const hoverWaypoint = (title: string) => {
    return `${title}`;
};

const onTooltip = (_info: PickingInfo): string | undefined | { text: string; containsHtml: boolean } => {
    return hoverWaypoint(t('transit:transitPath:ClickToRemoveWaypoint'));
};

const waypointLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'tooltip', layerName: 'transitPathWaypoints', eventName: 'onTooltip', handler: onTooltip }
];

export default waypointLayerEventDescriptors;
