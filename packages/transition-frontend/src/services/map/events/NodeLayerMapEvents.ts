/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the nodes layer, in any section */
import maplibregl from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Node from 'transition-common/lib/services/nodes/Node';

const hoverNode = (node: Node, nodeTitle = node.toString(false)) => {
    const popup = new maplibregl.Popup({
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

const onNodeMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
    // TODO Adding a custom field to the map. Legal, but not clean... figure out how to do this, implementation-independent
    const map = e.target as any;
    if (e.features && e.features[0]) {
        e.target.getCanvas().style.cursor = 'pointer';
        const nodeGeojson = e.features[0];
        const hoverNodeIntegerId = nodeGeojson.id;
        const hoverNodeId = nodeGeojson.properties?.id;
        const node = new Node(
            serviceLocator.collectionManager.get('nodes').getById(hoverNodeId).properties,
            false,
            serviceLocator.collectionManager
        );

        // unhover previous node:
        if (map._hoverNodeIntegerId) {
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

const onNodeMouseLeave = (e: maplibregl.MapLayerMouseEvent) => {
    const map = e.target as any;
    e.target.getCanvas().style.cursor = '';

    if (map._hoverNodeIntegerId) {
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

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'layer', layerName: 'transitNodes', eventName: 'mouseenter', handler: onNodeMouseEnter },
    { type: 'layer', layerName: 'transitNodes', eventName: 'mouseleave', handler: onNodeMouseLeave }
];

export default nodeLayerEventDescriptors;
