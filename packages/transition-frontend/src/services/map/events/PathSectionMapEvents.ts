/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import maplibregl from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitPath from 'transition-common/lib/services/path/Path';
import TransitLine from 'transition-common/lib/services/line/Line';
import { unhoverPath } from './PathLayerMapEvents';

/* This file encapsulates map events specific for the 'nodes' section */

const isAgenciesActiveSection = (activeSection: string) => activeSection === 'agencies';

const onPathWaypointMouseDown = (e: maplibregl.MapLayerMouseEvent) => {
    // start drag:
    const removingWaypoint = serviceLocator.keyboardManager.keyIsPressed('alt');
    if (e.features && e.features[0] && !removingWaypoint) {
        const map = e.target as any;
        serviceLocator.eventManager.emit('map.disableDragPan');
        map._currentDraggingFeature = 'waypoint';
        serviceLocator.eventManager.emit('waypoint.startDrag', e.features[0]);
        e.originalEvent.stopPropagation();
    }
};

const onPathWaypointMouseUp = (e: maplibregl.MapMouseEvent) => {
    const map = e.target as any;
    // stop drag if on edit node:
    if (map._currentDraggingFeature === 'waypoint') {
        const features = e.target.queryRenderedFeatures(e.point);
        const featureSources = features.map((feature) => feature.source);
        const hoverNodeIndex = featureSources.indexOf('transitNodes');
        if (hoverNodeIndex >= 0) {
            // replace waypoint by node
            const nodeGeojson = features[hoverNodeIndex];
            const path = serviceLocator.selectedObjectsManager.getSingleSelection('path');
            const nodeIds = path.get('nodes');
            const hoveredNodeId = nodeGeojson.properties?.id;
            if (!nodeIds.includes(hoveredNodeId)) {
                //path.replaceWaypointByNodeId(nodeGeojson.properties.id, null);
                serviceLocator.eventManager.emit(
                    'waypoint.replaceByNodeId',
                    hoveredNodeId,
                    serviceLocator.keyboardManager.keyIsPressed('cmd') ? 'manual' : 'engine'
                );
            }
            // TODO What about the else? if the waypoint is _on_ an existing node, should it be removed? Now it does nothing, no even update it, so there are 2 waypoints drawn on the map...
        } else {
            serviceLocator.eventManager.emit('waypoint.update', e.lngLat.toArray());
        }
        map._currentDraggingFeature = null;
        serviceLocator.eventManager.emit('map.enableDragPan');
        e.originalEvent.stopPropagation();
    }
};

const onPathWaypointMouseMove = (e: maplibregl.MapMouseEvent) => {
    const map = e.target as any;
    if (map._currentDraggingFeature === 'waypoint') {
        serviceLocator.eventManager.emit('waypoint.drag', e.lngLat.toArray());
        e.originalEvent.stopPropagation();
    }
};

const selectPath = (pathGeojson) => {
    const pathId = pathGeojson.properties.id;
    serviceLocator.socketEventManager.emit('transitPath.read', pathId, null, (response) => {
        const transitPathEdit = new TransitPath({ ...response.path }, false, serviceLocator.collectionManager);
        const line = transitPathEdit.getLine();
        if (!line) {
            return;
        }
        const transitLine = line as TransitLine;
        transitLine.refreshSchedules(serviceLocator.socketEventManager).then(() => {
            transitLine.startEditing();
            transitPathEdit.startEditing();
            serviceLocator.eventManager.emit('map.disableBoxZoom');
            serviceLocator.selectedObjectsManager.setSelection('path', [transitPathEdit]);
            serviceLocator.selectedObjectsManager.setSelection('line', [line]);
            serviceLocator.eventManager.emit('selected.updateLayers.path');
        });
    });
};

const hoverPath = (pathGeojson, map: any) => {
    if (map._hoverPathIntegerId) {
        unhoverPath(map._hoverPathId);
        map.setFeatureState({ source: map._hoverPathSource, id: map._hoverPathIntegerId }, { size: 2, hover: false });
    }

    map.setFeatureState({ source: pathGeojson.source, id: pathGeojson.id }, { size: 4, hover: true });

    // See https://github.com/alex3165/react-mapbox-gl/issues/506
    map._hoverPathIntegerId = pathGeojson.id;
    map._hoverPathId = pathGeojson.properties.id;
    map._hoverPathSource = pathGeojson.source;
};

// TODO Should we split this in individual functions with conditions instead?
// Test the performances first
// TODO Original code in click.events.js had a _draggingEventsOrder check. Is
// it still needed? If we have problems, there should be an event handler of
// higher priority to check it before running any other
const onPathSectionMapClick = async (e: maplibregl.MapMouseEvent) => {
    const features = e.target.queryRenderedFeatures([
        [e.point.x - 1, e.point.y - 1],
        [e.point.x + 1, e.point.y + 1]
    ]);

    const map = e.target;
    const featureSources = features.map((feature) => {
        return feature.source;
    });
    const clickedNodeIndex = featureSources.indexOf('transitNodes');
    const clickedWaypointIndex = featureSources.indexOf('transitPathWaypoints');
    const clickedSelectedNodeIndex = featureSources.indexOf('transitNodesSelected');
    const clickedPathIndex = featureSources.indexOf('transitPaths');
    const clickedSelectedPathIndex = featureSources.indexOf('transitPathsSelected');

    const selectedPath = serviceLocator.selectedObjectsManager.getSingleSelection('path');
    const selectedLine = serviceLocator.selectedObjectsManager.getSingleSelection('line');

    serviceLocator.eventManager.emit('map.hideContextMenu');

    const path = selectedPath ? (selectedPath as TransitPath) : undefined;

    if (path && !path.isFrozen()) {
        e.originalEvent.stopPropagation();
        if (
            // clicked on waypoint (remove)
            clickedWaypointIndex >= 0 &&
            clickedNodeIndex < 0
            //&& serviceLocator.keyboardManager.keyIsPressed('alt')
        ) {
            const attributes = features[clickedWaypointIndex].properties || {};
            const path = selectedPath as TransitPath;
            path.removeWaypoint(attributes.afterNodeIndex, attributes.waypointIndex).then((_response) => {
                serviceLocator.selectedObjectsManager.setSelection('path', [path]);
                serviceLocator.eventManager.emit('selected.updateLayers.path');
            });
        } else if (
            // insert waypoint in path at click
            clickedWaypointIndex < 0 &&
            clickedSelectedPathIndex >= 0 &&
            clickedNodeIndex < 0
        ) {
            const path = selectedPath;
            const waypointType = path.attributes.data.temporaryManualRouting
                ? 'manual'
                : path.getData('routingEngine', 'engine');
            path.insertWaypoint(e.lngLat.toArray(), waypointType, null, null).then((_response) => {
                path.validate();
                serviceLocator.selectedObjectsManager.setSelection('path', [path]);
                serviceLocator.eventManager.emit('selected.updateLayers.path');
            });
        } else if (
            // add or remove node or add waypoint to path
            clickedWaypointIndex < 0
        ) {
            // TODO Should not be determined here, the default value should be provided by the functions themselves
            const waypointType = path.attributes.data.temporaryManualRouting
                ? 'manual'
                : path.attributes.data.routingEngine || 'engine';
            let insertOrRemoveNodePromise: Promise<{ path: TransitPath }> | undefined = undefined;
            if (clickedNodeIndex >= 0 || clickedSelectedNodeIndex >= 0) {
                // add node
                // TODO Is it possible to have the selectedNode layer on at this time?
                const nodeGeojson = features[clickedNodeIndex] || features[clickedSelectedNodeIndex];
                const nodeId = nodeGeojson.properties?.id;
                if (nodeId && e.originalEvent.shiftKey) {
                    insertOrRemoveNodePromise = path.insertNodeId(nodeId, 0, waypointType);
                } else if (nodeId && e.originalEvent.altKey) {
                    insertOrRemoveNodePromise = path.removeNodeId(nodeId);
                } else if (nodeId) {
                    insertOrRemoveNodePromise = path.insertNodeId(nodeId, null, waypointType);
                }
            } else {
                // add waypoint
                const lastNodeIndex = path.attributes.nodes.length - 1;
                if (lastNodeIndex < 0) {
                    return;
                }
                insertOrRemoveNodePromise = path.insertWaypoint(
                    e.lngLat.toArray() as [number, number],
                    waypointType,
                    lastNodeIndex,
                    undefined
                );
            }

            if (insertOrRemoveNodePromise) {
                try {
                    const response = await insertOrRemoveNodePromise;
                    if (response.path) {
                        serviceLocator.selectedObjectsManager.setSelection('path', [response.path]);
                        serviceLocator.eventManager.emit('selected.updateLayers.path');
                    } else {
                        console.error('error', (response as any).error); // todo: better error handling
                    }
                } catch (error) {
                    console.error('error', error); // todo: better error handling
                }
            }
        } else if (
            // add waypoint to selected path or insert node
            clickedNodeIndex < 0 &&
            clickedSelectedPathIndex >= 0
        ) {
            // TODO Can this be part of the previous if? And not use an emit, but call a path function?
            map.getCanvas().style.cursor = 'pointer';
            serviceLocator.eventManager.emit('waypoint.insert', e.lngLat.toArray());
        }
    } else if (
        // select unique path, or show all paths
        (!path || (!path.hasChanged() && !selectedLine.hasChanged())) &&
        clickedPathIndex >= 0
    ) {
        if (
            !selectedLine ||
            (path && !path.hasChanged() && !selectedLine.hasChanged()) ||
            (selectedLine && !path && !selectedLine.hasChanged())
        ) {
            const paths = features.filter((feature) => feature.source === 'transitPaths');
            if (paths.length === 1) {
                selectPath(paths[0]);
            } else {
                const menu: any[] = [];

                paths.forEach((pathGeojson) => {
                    const pathById = serviceLocator.collectionManager.get('paths').getById(pathGeojson.properties?.id);
                    if (!pathById) return;
                    const path = new TransitPath(pathById.properties, false, serviceLocator.collectionManager);
                    const line = path.getLine() as TransitLine;
                    menu.push({
                        key: path.getId(),
                        title: `${line.toString(false)} • ${path.toString(false)}`,
                        onClick: () => selectPath(pathGeojson),
                        onHover: () => hoverPath(pathGeojson, e.target)
                    });
                });
                serviceLocator.eventManager.emit('map.showContextMenu', e, menu);
            }
            e.originalEvent.stopPropagation();
        }
    }
};

const nodeSectionEventDescriptors: MapEventHandlerDescription[] = [
    { type: 'map', eventName: 'click', condition: isAgenciesActiveSection, handler: onPathSectionMapClick },
    {
        type: 'layer',
        eventName: 'mousedown',
        layerName: 'transitPathWaypoints',
        condition: isAgenciesActiveSection,
        handler: onPathWaypointMouseDown
    },
    { type: 'map', eventName: 'mouseup', condition: isAgenciesActiveSection, handler: onPathWaypointMouseUp },
    { type: 'map', eventName: 'mousemove', condition: isAgenciesActiveSection, handler: onPathWaypointMouseMove }
];

export default nodeSectionEventDescriptors;
