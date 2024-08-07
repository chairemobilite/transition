/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PickingInfo } from 'deck.gl/typed';
import { MjolnirEvent } from 'mjolnir.js';

import { MapEventHandlerDescription, PointInfo } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitNode from 'transition-common/lib/services/nodes/Node';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

/* This file encapsulates map events specific for the 'nodes' section */

const isNodeActiveSection = (activeSection: string) => activeSection === 'nodes';

const onSelectedNodeDrag = (info: PickingInfo, _event: MjolnirEvent) => {
    const selectedNode = serviceLocator.selectedObjectsManager.get('node');
    const selectedFeature = info.object;
    if (
        selectedNode &&
        selectedFeature.properties?.id === selectedNode.get('id') &&
        selectedNode.get('is_frozen') !== true
    ) {
        serviceLocator.eventManager.emit('selected.drag.node', info.coordinate);
    }
};

const onSelectedNodeDragEnd = (info: PickingInfo, _event: MjolnirEvent) => {
    const selectedNode = serviceLocator.selectedObjectsManager.get('node');
    const selectedFeature = info.object;
    if (
        selectedNode &&
        selectedFeature.properties?.id === selectedNode.get('id') &&
        selectedNode.get('is_frozen') !== true
    ) {
        // TODO Re-implement this with deck gl/openstreetmap
        // serviceLocator.eventManager.emit('selected.updateAutocompleteNameChoices.node', getRoadLabelAround(map, e));
        serviceLocator.eventManager.emit('selected.dragEnd.node', info.coordinate);
    }
};

const onNodeSectionContextMenu = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    const selectedNodes = serviceLocator.selectedObjectsManager.get('selectedNodes');
    const menu: { title: string; onClick: () => void }[] = [];

    if (
        selectedNodes !== undefined &&
        typeof selectedNodes === 'object' &&
        Array.isArray(selectedNodes) &&
        selectedNodes.length > 0
    ) {
        menu.push(
            {
                title: 'transit:transitNode:editSelectedNodes',
                onClick: () => {
                    serviceLocator.eventManager.emit('map.editUpdateMultipleNodes');
                }
            },
            {
                title: 'transit:transitNode:deleteSelectedNodes',
                onClick: () => {
                    serviceLocator.eventManager.emit('map.deleteSelectedNodes');
                }
            }
        );
    }

    menu.push({
        title: 'transit:transitNode:deleteSelectedPolygon',
        onClick: () => {
            serviceLocator.eventManager.emit('map.deleteSelectedPolygon');
        }
    });

    serviceLocator.eventManager.emit('map.showContextMenu', pointInfo.pixel, menu);
};

// TODO Should we split this in individual functions with conditions instead?
// Test the performances first
// TODO Original code in click.events.js had a _draggingEventsOrder check. Is
// it still needed? If we have problems, there should be an event handler of
// higher priority to check it before running any other
/**
 * Event handler called when a node in the node layer and section was clicked.
 * It should edit the selected node if there are no current modifications and it
 * is not a multiple selection.
 * @param info
 * @param e
 * @returns
 */
const onNodeSelected = (info: PickingInfo, e: MjolnirEvent) => {
    // disable map click if measure tool is selected:
    if (serviceLocator.selectedObjectsManager.isSelected('measureTool')) {
        return;
    }

    const selectedNodes = serviceLocator.selectedObjectsManager.get('selectedNodes');
    const selectedNode = serviceLocator.selectedObjectsManager.get('node');

    // Ignore the event if there is a multiple selection
    if (selectedNodes) return;

    const selectedFeature = info.object;

    if (selectedFeature) {
        // Clicked on a feature, edit it if possible, ignore if a node is selected and has changed
        if (selectedNode && selectedNode.hasChanged()) return;

        // Deselect previous node and select current one
        if (selectedNode) {
            serviceLocator.selectedObjectsManager.deselect('node');
        }
        const attributes = selectedFeature.properties || {};
        serviceLocator.socketEventManager.emit('transitNode.read', attributes.id, null, (response) => {
            const transitNodeEdit = new TransitNode({ ...response.node }, false, serviceLocator.collectionManager);
            transitNodeEdit.loadFromCache(serviceLocator.socketEventManager).then(() => {
                transitNodeEdit.startEditing();
                serviceLocator.selectedObjectsManager.select('node', transitNodeEdit);
            });
        });
        e.handled = true;
    }
};

// TODO Should we split this in individual functions with conditions instead?
// Test the performances first
// TODO Original code in click.events.js had a _draggingEventsOrder check. Is
// it still needed? If we have problems, there should be an event handler of
// higher priority to check it before running any other
const onMapClicked = (pointInfo: PointInfo, e: MjolnirEvent) => {
    // disable map click if measure tool is selected:
    if (serviceLocator.selectedObjectsManager.isSelected('measureTool')) {
        return;
    }

    const selectedNodes = serviceLocator.selectedObjectsManager.get('selectedNodes');
    // Ignore the event if there is a multiple selection
    if (selectedNodes) return;

    const selectedNode = serviceLocator.selectedObjectsManager.get('node');

    const needsShiftKeyToCreateNode = Preferences.current?.transit?.nodes?.shiftClickToCreateNodes === true;

    if (!selectedNode && (!needsShiftKeyToCreateNode || e.srcEvent.shiftKey)) {
        // If there is no selected node, create a new one

        const newTransitNode = new TransitNode(
            {
                geography: { type: 'Point', coordinates: pointInfo.coordinates },
                color: Preferences.get('transit.nodes.defaultColor'),
                routing_radius_meters: Preferences.get('transit.nodes.defaultRoutingRadiusMeters')
            },
            true,
            serviceLocator.collectionManager
        );
        newTransitNode.startEditing();
        serviceLocator.selectedObjectsManager.select('node', newTransitNode);
        // FIXME Migration to DeckGL: reimplement this
        // serviceLocator.eventManager.emit('selected.updateAutocompleteNameChoices.node', getRoadLabelAround(map, e));
    } else if (selectedNode) {
        const selectedTransitNode = selectedNode as TransitNode;
        if (!selectedTransitNode.isFrozen()) {
            // Otherwise, update the position of the current node
            // FIXME Migration to DeckGL: Reimplement
            // serviceLocator.eventManager.emit('selected.updateAutocompleteNameChoices.node', getRoadLabelAround(map, e));
            selectedTransitNode.set('geography.coordinates', pointInfo.coordinates);
            // This updates the position on the map.
            serviceLocator.eventManager.emit('selected.drag.node', pointInfo.coordinates);
            serviceLocator.selectedObjectsManager.update('node', selectedNode);
        }
    }
    // TODO Migration to DeckGL: Do we need to stop propagation?
    e.handled = true;
};

const nodeSectionEventDescriptors: MapEventHandlerDescription[] = [
    {
        type: 'layer',
        layerName: 'transitNodes',
        eventName: 'onLeftClick',
        condition: isNodeActiveSection,
        handler: onNodeSelected
    },
    { type: 'map', eventName: 'onLeftClick', condition: isNodeActiveSection, handler: onMapClicked },
    {
        type: 'layer',
        layerName: 'transitNodesSelected',
        eventName: 'onDrag',
        condition: isNodeActiveSection,
        handler: onSelectedNodeDrag
    },
    {
        type: 'layer',
        layerName: 'transitNodesSelected',
        eventName: 'onDragEnd',
        condition: isNodeActiveSection,
        handler: onSelectedNodeDragEnd
    },
    { type: 'map', eventName: 'onRightClick', condition: isNodeActiveSection, handler: onNodeSectionContextMenu }
];

export default nodeSectionEventDescriptors;
