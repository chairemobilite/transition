/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MjolnirEvent } from 'mjolnir.js';
import { PickingInfo } from 'deck.gl';

import {
    MapCallbacks,
    MapEventHandlerDescription,
    PointInfo
} from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitPath from 'transition-common/lib/services/path/Path';
import TransitLine from 'transition-common/lib/services/line/Line';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
/* This file encapsulates map events specific for the 'agencies' section */

const isAgenciesActiveSection = (activeSection: string) => activeSection === 'agencies';

const isNotEditingPathOrLine = (activeSection: string): boolean => {
    if (!isAgenciesActiveSection(activeSection)) {
        return false;
    }

    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const selectedLine = serviceLocator.selectedObjectsManager.get('line');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;

    return !selectedLine || (!selectedLine.hasChanged() && (!path || !path.hasChanged()));
};

const isEditingPath = (activeSection: string): boolean => {
    if (!isAgenciesActiveSection(activeSection)) {
        return false;
    }

    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;

    return path !== undefined && !path.isFrozen();
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

            const nodesGeojsons = transitPathEdit.nodesGeojsons();
            // FIXME This code is also in the TransitPathEdit file, refactor to avoid duplication
            serviceLocator.eventManager.emit('map.updateLayers', {
                transitPathsSelected: turfFeatureCollection(pathGeojson.geometry ? [pathGeojson] : []),
                transitNodesSelected: turfFeatureCollection(nodesGeojsons),
                transitNodesRoutingRadius: turfFeatureCollection(nodesGeojsons),
                transitPathWaypoints: turfFeatureCollection(transitPathEdit.waypointsGeojsons())
            });
        });
    });
};

const onSelectedPathMapClicked = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    // Add a waypoint at the location of the click
    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;
    if (!path) {
        return false;
    }
    const waypointType = path.getAttributes().data.temporaryManualRouting
        ? 'manual'
        : (path.getData('routingEngine', 'engine') as string);

    // Add the waypoint at the end of the path. TODO: This should be automatic once finding the insert location is not done by the path anymore
    const insertIndex = path.attributes.nodes.length === 0 ? undefined : path.attributes.nodes.length - 1;
    path.insertWaypoint(pointInfo.coordinates as [number, number], waypointType, insertIndex, undefined).then(() => {
        path.validate();
        serviceLocator.selectedObjectsManager.update('path', path);
        serviceLocator.eventManager.emit('selected.updateLayers.path');
    });
    return true;
};

const onPathsClicked = (pickInfo: PickingInfo[], _event: MjolnirEvent) => {
    if (pickInfo.length === 1) {
        selectPath(pickInfo[0].object);
    } else {
        const paths = pickInfo.map((picked) => picked.object);
        const menu: any[] = [];

        paths.forEach((pathGeojson) => {
            const pathById = serviceLocator.collectionManager.get('paths').getById(pathGeojson.properties?.id);
            if (!pathById) return;
            const path = new TransitPath(pathById.properties, false, serviceLocator.collectionManager);
            const line = path.getLine() as TransitLine;
            menu.push({
                key: path.getId(),
                title: `${line.toString(false)} • ${path.toString(false)}`,
                onClick: () => selectPath(pathGeojson)
                // onHover: () => hoverPath(pathGeojson, e.target)
            });
        });
        serviceLocator.eventManager.emit('map.showContextMenu', pickInfo[0].pixel, menu);
    }
    return true;
};

const onSelectedWaypointDrag = (info: PickingInfo, _event: MjolnirEvent) => {
    const selectedPath = serviceLocator.selectedObjectsManager.getSingleSelection('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;
    if (!path) {
        return false;
    }
    const selectedFeature = info.object;
    const waypointIndex = selectedFeature.properties?.waypointIndex;
    const afterNodeIndex = selectedFeature.properties?.afterNodeIndex;
    if (waypointIndex === undefined || afterNodeIndex === undefined) {
        // Not a proper waypoint, ignore
        return false;
    }
    // Drag the waypoint
    serviceLocator.eventManager.emit('waypoint.drag', info.coordinate, waypointIndex, afterNodeIndex);
    return true;
};

const onSelectedWaypointDragEnd = (info: PickingInfo, _event: MjolnirEvent, mapCallbacks: MapCallbacks) => {
    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;
    if (!path) {
        return false;
    }
    const selectedFeature = info.object;
    const waypointIndex = selectedFeature.properties?.waypointIndex;
    const afterNodeIndex = selectedFeature.properties?.afterNodeIndex;
    if (waypointIndex === undefined || afterNodeIndex === undefined) {
        // Not a proper waypoint, ignore
        return false;
    }
    // Update the waypoint convert to node
    const nodes = mapCallbacks.pickMultipleObjects({ x: info.x, y: info.y, layerIds: ['transitNodes'] });
    const nodeIds = path.attributes.nodes;
    const selectedNodeId = nodes.length === 0 ? undefined : nodes[0].object?.properties?.id;
    if (selectedNodeId !== undefined && !nodeIds.includes(selectedNodeId)) {
        //path.replaceWaypointByNodeId(nodeGeojson.properties.id, null);
        serviceLocator.eventManager.emit(
            'waypoint.replaceByNodeId',
            selectedNodeId,
            serviceLocator.keyboardManager.keyIsPressed('cmd') ? 'manual' : 'engine',
            waypointIndex,
            afterNodeIndex
        );
    } else {
        serviceLocator.eventManager.emit('waypoint.update', info.coordinate, waypointIndex, afterNodeIndex);
    }
    return true;
};

const onSelectedPathClicked = (info: PickingInfo, _event: MjolnirEvent) => {
    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;
    if (!path) {
        return false;
    }

    const waypointType = path.getAttributes().data.temporaryManualRouting
        ? 'manual'
        : path.getData('routingEngine', 'engine');
    // TODO Here is where we should determine where to insert the point. Call a method which validates if the point is at distance x of path.
    path.insertWaypoint(info.coordinate as [number, number], waypointType as string, undefined, undefined).then(() => {
        path.validate();
        serviceLocator.selectedObjectsManager.update('path', path);
        serviceLocator.eventManager.emit('selected.updateLayers.path');
    });
    return true;
};

const removeNode = async (path: TransitPath, nodeId: string) => path.removeNodeId(nodeId);

const addNode = (path: TransitPath, nodeId: string, atEnd = true) => {
    // TODO Should not be determined here, the default value should be provided by the functions themselves
    const waypointType = path.getAttributes().data.temporaryManualRouting
        ? 'manual'
        : path.getAttributes().data.routingEngine || 'engine';
    return path.insertNodeId(nodeId, atEnd ? null : 0, waypointType);
};

const onWaypointClicked = (info: PickingInfo, _e: MjolnirEvent) => {
    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;
    if (!path) {
        return false;
    }
    path.removeWaypoint(info.object.properties.afterNodeIndex, info.object.properties.waypointIndex).then(() => {
        serviceLocator.selectedObjectsManager.update('path', path);
        serviceLocator.eventManager.emit('selected.updateLayers.path');
    });
    return true;
};

const onNodeClickedForPath = (info: PickingInfo, e: MjolnirEvent) => {
    const selectedPath = serviceLocator.selectedObjectsManager.get('path');
    const path = selectedPath ? (selectedPath as TransitPath) : undefined;

    if (e.srcEvent.ctrlKey === true) {
        return false;
    }
    const nodeId = (info.object.properties || {}).id;
    if (!nodeId || !path) {
        return false;
    }

    const nodeAddOrRemovePromise =
        e.srcEvent.altKey === true ? removeNode(path, nodeId) : addNode(path, nodeId, e.srcEvent.shiftKey !== true);
    nodeAddOrRemovePromise
        .then((response) => {
            if (response.path) {
                serviceLocator.selectedObjectsManager.update('path', response.path);
                serviceLocator.eventManager.emit('selected.updateLayers.path');
            } else {
                console.error('error', (response as any).error); // todo: better error handling
            }
        })
        .catch((error) => console.error('error adding node to path:', error));
    return true;
};

const pathSectionEventDescriptors: MapEventHandlerDescription[] = [
    // These events are for the agencies panel, when no path is selected
    {
        type: 'mapSelect',
        layerName: 'transitPaths',
        eventName: 'onLeftClick',
        condition: isNotEditingPathOrLine,
        handler: onPathsClicked
    },
    // The following events are for path editing
    {
        type: 'layer',
        layerName: 'transitPathsSelected',
        eventName: 'onLeftClick',
        condition: isEditingPath,
        handler: onSelectedPathClicked
    },
    {
        type: 'layer',
        layerName: 'transitNodes',
        eventName: 'onLeftClick',
        condition: isEditingPath,
        handler: onNodeClickedForPath
    },
    {
        type: 'layer',
        layerName: 'transitNodesSelected',
        eventName: 'onLeftClick',
        condition: isEditingPath,
        handler: onNodeClickedForPath
    },
    {
        type: 'layer',
        layerName: 'transitPathWaypoints',
        eventName: 'onDrag',
        condition: isEditingPath,
        handler: onSelectedWaypointDrag
    },
    {
        type: 'layer',
        layerName: 'transitPathWaypoints',
        eventName: 'onDragEnd',
        condition: isEditingPath,
        handler: onSelectedWaypointDragEnd
    },
    {
        type: 'layer',
        layerName: 'transitPathWaypoints',
        eventName: 'onLeftClick',
        condition: isEditingPath,
        handler: onWaypointClicked
    },
    { type: 'map', eventName: 'onLeftClick', condition: isEditingPath, handler: onSelectedPathMapClicked }
];

export default pathSectionEventDescriptors;
