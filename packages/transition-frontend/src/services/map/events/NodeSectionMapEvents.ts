/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MapboxGL from 'mapbox-gl';
import _uniq from 'lodash/uniq';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { metersToPixels } from 'chaire-lib-common/lib/utils/geometry/ConversionUtils';
import { permutationsWithRepetition } from 'chaire-lib-common/lib/utils/MathUtils';
import TransitNode from 'transition-common/lib/services/nodes/Node';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

/* This file encapsulates map events specific for the 'nodes' section */

const getRoadLabelAround = function (map: MapboxGL.Map, e: MapboxGL.MapMouseEvent, squareRadiusMeters = 100) {
    const searchLatitude = e.lngLat.toArray()[1];
    const mapZoom = map.getZoom();
    const searchSquareRadiusInPixels = metersToPixels(squareRadiusMeters, searchLatitude, mapZoom); // in fact it will be a square
    const bbox: [[number, number], [number, number]] = [
        [e.point.x - searchSquareRadiusInPixels, e.point.y - searchSquareRadiusInPixels],
        [e.point.x + searchSquareRadiusInPixels, e.point.y + searchSquareRadiusInPixels]
    ];
    const roadLabelFeatures = map.queryRenderedFeatures(bbox, {
        layers: ['road-label-xlarge', 'road-label-large', 'road-label-medium', 'road-label-small']
    });

    // find road labels at proximity:
    const roadlabels = _uniq(
        roadLabelFeatures.map((label) => {
            return label.properties?.name;
        })
    );

    const labelPermutations = permutationsWithRepetition(roadlabels.slice(0, 6), 2, [], false);
    const labelPermutationsJoined = labelPermutations.map((labelsPair) => {
        return labelsPair.join(' / ');
    });

    return labelPermutationsJoined;
};

const isNodeActiveSection = (activeSection: string) => activeSection === 'nodes';

// TODO Should we split this in individual functions with conditions instead?
// Test the performances first
// TODO Original code in click.events.js had a _draggingEventsOrder check. Is
// it still needed? If we have problems, there should be an event handler of
// higher priority to check it before running any other
const onNodeSectionMapClick = (e: MapboxGL.MapMouseEvent) => {
    const selectedNodes = serviceLocator.selectedObjectsManager.get('selectedNodes');
    const selectedNode = serviceLocator.selectedObjectsManager.get('node');
    // Ignore the event if there is a multiple selection
    if (selectedNodes) return;

    const features = e.target.queryRenderedFeatures(
        [
            [e.point.x - 1, e.point.y - 1],
            [e.point.x + 1, e.point.y + 1]
        ],
        { layers: ['transitNodes'] }
    );

    const map = e.target;
    // TODO: If there are multiple selected features, offer the choice instead of editing the first one
    const selectedFeature = features.length > 0 ? features[0] : undefined;

    const needsShiftKeyToCreateNode = Preferences.current?.transit?.nodes?.shiftClickToCreateNodes === true;

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
            transitNodeEdit.loadFromCache(serviceLocator.socketEventManager).then((response) => {
                transitNodeEdit.startEditing();
                serviceLocator.selectedObjectsManager.select('node', transitNodeEdit);
            });
        });
    } else if (!selectedNode && (!needsShiftKeyToCreateNode || e.originalEvent.shiftKey)) {
        // If there is no selected node, create a new one

        const newTransitNode = new TransitNode(
            {
                geography: { type: 'Point', coordinates: e.lngLat.toArray() },
                color: Preferences.get('transit.nodes.defaultColor'),
                routing_radius_meters: Preferences.get('transit.nodes.defaultRoutingRadiusMeters')
            },
            true,
            serviceLocator.collectionManager
        );
        newTransitNode.startEditing();
        serviceLocator.selectedObjectsManager.select('node', newTransitNode);
        serviceLocator.eventManager.emit('selected.updateAutocompleteNameChoices.node', getRoadLabelAround(map, e));
    } else if (selectedNode) {
        const selectedTransitNode = selectedNode as TransitNode;
        if (!selectedTransitNode.isFrozen()) {
            // Otherwise, update the position of the current node
            serviceLocator.eventManager.emit('selected.updateAutocompleteNameChoices.node', getRoadLabelAround(map, e));
            selectedTransitNode.set('geography.coordinates', e.lngLat.toArray());
            serviceLocator.eventManager.emit('selected.dragEnd.node', e.lngLat.toArray());
            serviceLocator.selectedObjectsManager.update('node', selectedNode);
        }
    }
    e.originalEvent.stopPropagation();
};

const onSelectedNodeMouseDown = (e: MapboxGL.MapLayerMouseEvent) => {
    const features = e.features;
    if (!features || features.length === 0) {
        return;
    }
    const selectedNode = serviceLocator.selectedObjectsManager.get('node');
    if (
        selectedNode &&
        e.features &&
        e.features[0].properties?.id === selectedNode.get('id') &&
        selectedNode.get('is_frozen') !== true
    ) {
        // TODO Adding a custom field to the map. Legal, but not clean... figure out how to do this, implementation-independent
        const map = e.target as any;
        serviceLocator.eventManager.emit('map.disableDragPan');
        map._currentDraggingFeature = 'node';
    }
};

const onSelectedNodeMouseUp = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    // stop drag if on edit node:
    if (map._currentDraggingFeature === 'node') {
        serviceLocator.eventManager.emit('selected.updateAutocompleteNameChoices.node', getRoadLabelAround(map, e));
        serviceLocator.eventManager.emit('selected.dragEnd.node', e.lngLat.toArray());
        map._currentDraggingFeature = null;
        e.originalEvent.stopPropagation();
    }
};

const onSelectedNodeMouseMove = (e: MapboxGL.MapMouseEvent) => {
    const map = e.target as any;
    if (map._currentDraggingFeature === 'node') {
        serviceLocator.eventManager.emit('selected.drag.node', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    }
};

const onNodeSectionContextMenu = (e: MapboxGL.MapMouseEvent) => {
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

    serviceLocator.eventManager.emit('map.showContextMenu', e, menu);
};

const nodeSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'click', condition: isNodeActiveSection, handler: onNodeSectionMapClick },
    {
        type: 'layer',
        eventName: 'mousedown',
        layerName: 'transitNodesSelected',
        condition: isNodeActiveSection,
        handler: onSelectedNodeMouseDown
    },
    { type: 'map', eventName: 'mouseup', condition: isNodeActiveSection, handler: onSelectedNodeMouseUp },
    { type: 'map', eventName: 'mousemove', condition: isNodeActiveSection, handler: onSelectedNodeMouseMove },
    { type: 'map', eventName: 'contextmenu', condition: isNodeActiveSection, handler: onNodeSectionContextMenu }
];

export default nodeSectionEventDescriptors;
