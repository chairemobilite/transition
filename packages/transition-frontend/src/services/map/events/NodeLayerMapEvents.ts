/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the nodes layer, in any section */
import { Popup as MapLibrePopup } from 'maplibre-gl';
import type { MapLayerMouseEvent } from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapWithCustomEventsState } from 'chaire-lib-frontend/lib/services/map/MapWithCustomEventsState';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Node from 'transition-common/lib/services/nodes/Node';
import { setPointerCursor, resetCursor } from '../MapCursorHelper';

const hoverNode = (node: Node, nodeTitle = node.toString(false)) => {
    const popup = new MapLibrePopup({
        offset: 10,
        anchor: 'bottom'
    });
    const nodeId = node.get('id');
    popup.setLngLat(serviceLocator.collectionManager.get('nodes').getById(nodeId).geometry.coordinates);
    if (serviceLocator && serviceLocator.keyboardManager && serviceLocator.keyboardManager.keyIsPressed('alt')) {
        popup.setHTML(
            `<p>${nodeTitle}<br />${nodeId}${
                node.attributes.data.weight ? `<br />w${Math.round(node.attributes.data.weight)}` : ''
            }</p>`
        );
    } else {
        popup.setHTML(`<p>${nodeTitle}</p>`);
    }
    serviceLocator.eventManager.emit('map.addPopup', nodeId, popup);
};

const unhoverNode = (nodeId: string) => {
    if (serviceLocator && serviceLocator.keyboardManager && serviceLocator.keyboardManager.keyIsPressed('alt')) {
        // keep popup for now when alt is pressed
    } else {
        serviceLocator.eventManager.emit('map.removePopup', nodeId);
    }
};

const onNodeMouseEnter = (e: MapLayerMouseEvent) => {
    const map = e.target as MapWithCustomEventsState;
    if (e.features && e.features[0]) {
        setPointerCursor();
        const nodeGeojson = e.features[0];
        const hoverNodeIntegerId = nodeGeojson.id;
        const hoverNodeId = nodeGeojson.properties?.id;
        const node = new Node(
            serviceLocator.collectionManager.get('nodes').getById(hoverNodeId).properties,
            false,
            serviceLocator.collectionManager
        );

        // unhover previous node:
        if (map._hoverNodeIntegerId && map._hoverNodeSource && map._hoverNodeId) {
            serviceLocator.eventManager.emit('node.unhover', map._hoverNodeId);
            e.target.setFeatureState(
                { source: map._hoverNodeSource, id: map._hoverNodeIntegerId },
                { size: 1, hover: false }
            );
        }
        e.target.setFeatureState({ source: nodeGeojson.source, id: hoverNodeIntegerId }, { size: 1.5, hover: true });

        // See https://github.com/alex3165/react-mapbox-gl/issues/506
        map._hoverNodeIntegerId = hoverNodeIntegerId;
        map._hoverNodeId = hoverNodeId;
        map._hoverNodeSource = nodeGeojson.source;

        hoverNode(node);
    }
};

const onNodeMouseLeave = (e: MapLayerMouseEvent) => {
    const map = e.target as MapWithCustomEventsState;
    resetCursor();

    if (map._hoverNodeIntegerId && map._hoverNodeSource && map._hoverNodeId) {
        unhoverNode(map._hoverNodeId);
        e.target.setFeatureState(
            { source: map._hoverNodeSource, id: map._hoverNodeIntegerId },
            { size: 1, hover: false }
        );
    }

    map._hoverNodeIntegerId = null;
    map._hoverNodeId = null;
    map._hoverNodeSource = null;
};

const onSelectedNodeMouseEnter = (e: MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        setPointerCursor();
    }
};

const onSelectedNodeMouseLeave = () => {
    resetCursor();
};

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'layer', layerName: 'transitNodes', eventName: 'mouseenter', handler: onNodeMouseEnter },
    { type: 'layer', layerName: 'transitNodes', eventName: 'mouseleave', handler: onNodeMouseLeave },
    { type: 'layer', layerName: 'transitNodesSelected', eventName: 'mouseenter', handler: onSelectedNodeMouseEnter },
    { type: 'layer', layerName: 'transitNodesSelected', eventName: 'mouseleave', handler: onSelectedNodeMouseLeave }
];

export default nodeLayerEventDescriptors;
