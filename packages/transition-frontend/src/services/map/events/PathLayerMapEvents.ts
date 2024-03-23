/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the path* layer, in any section */
import { PickingInfo } from 'deck.gl/typed';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path from 'transition-common/lib/services/path/Path';

export const onPathTooltip = (info: PickingInfo): string | undefined | { text: string; containsHtml: boolean } => {
    const pathId = info.object!.properties.id;
    const path = new Path(
        serviceLocator.collectionManager.get('paths').getById(pathId).properties,
        false,
        serviceLocator.collectionManager
    );
    const line = path.getLine();

    return {
        text: `${line ? line.toString() : ''} • ${path.toString(false)} (${path.getAttributes().direction})`,
        containsHtml: true
    };
};

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'tooltip', layerName: 'transitPaths', eventName: 'onTooltip', handler: onPathTooltip }
];

export default nodeLayerEventDescriptors;
