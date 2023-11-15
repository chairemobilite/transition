/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the nodes layer, in any section */
import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitNode from 'transition-common/lib/services/nodes/Node';
import { PickingInfo } from 'deck.gl/typed';

const hoverNode = (node: TransitNode, nodeTitle = node.toString(false)) => {
    if (serviceLocator && serviceLocator.keyboardManager && serviceLocator.keyboardManager.keyIsPressed('alt')) {
        return {
            text: `<p>${nodeTitle}<br />${node.getId()}${
                node.getAttributes().data.weight ? `<br />w${Math.round(node.getAttributes().data.weight)}` : ''
            }</p>`,
            containsHtml: true
        };
    } else {
        return `${nodeTitle}`;
    }
};

const onTooltip = (info: PickingInfo): string | undefined | { text: string; containsHtml: boolean } => {
    const nodeId = info.object!.properties.id;
    const node = new TransitNode(
        serviceLocator.collectionManager.get('nodes').getById(nodeId).properties,
        false,
        serviceLocator.collectionManager
    );
    return hoverNode(node);
};

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'tooltip', layerName: 'transitNodes', eventName: 'onTooltip', handler: onTooltip }
];

export default nodeLayerEventDescriptors;
