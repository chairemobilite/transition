/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { onPathTooltip } from './PathLayerMapEvents';

/* This file encapsulates map events specific for the 'scenarios' section */

const scenarioSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'tooltip', layerName: 'transitPathsForServices', eventName: 'onTooltip', handler: onPathTooltip }
];

export default scenarioSectionEventDescriptors;
