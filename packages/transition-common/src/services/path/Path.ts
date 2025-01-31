/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _get from 'lodash/get';
import _mean from 'lodash/mean';
import _isNumber from 'lodash/isNumber';
import _isFinite from 'lodash/isFinite';
import {
    distance as turfDistance,
    length as turfLength,
    lineSlice as turfLineSlice,
    helpers as turfHelpers
} from '@turf/turf';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { MapObject, MapObjectAttributes } from 'chaire-lib-common/lib/utils/objects/MapObject';
import updatePathGeography from './PathGeographyUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals, median } from 'chaire-lib-common/lib/utils/MathUtils';
// TODO Should not be needed
// import ODProximityLineGenerator from './generators/ODProximityLineGenerator';
import lineModesConfig from '../../config/lineModes';
import { GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import { EventEmitter } from 'events';
import NodeCollection from '../nodes/NodeCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const lineModesConfigByMode = {};
for (let i = 0, countI = lineModesConfig.length; i < countI; i++) {
    const lineMode = lineModesConfig[i];
    lineModesConfigByMode[lineMode.value] = lineMode;
}

interface PathStatistics {
    d_p?: number | null;
    n_q_p?: number | null;
    d_l_min?: number | null;
    d_l_max?: number | null;
    d_l_avg?: number | null;
    d_l_med?: number | null;
    T_o_p?: number | null;
    n_s_p?: number | null;
}

export interface TimeAndDistance {
    distanceMeters: number | null;
    travelTimeSeconds: number;
}

export const pathDirectionArray = ['loop', 'outbound', 'inbound', 'other'] as const;
export type PathDirection = (typeof pathDirectionArray)[number];

export interface PathAttributesData {
    defaultLayoverRatioOverTotalTravelTime?: number;
    defaultMinLayoverTimeSeconds?: number;
    defaultRoutingEngine?: 'manual' | 'engine' | 'engineCustom';
    defaultRoutingMode?: string;
    defaultAcceleration?: number;
    defaultDeceleration?: number;
    defaultDwellTimeSeconds?: number;
    ignoreNodesDefaultDwellTimeSeconds?: boolean; // if true, will ignore defaultDwellTimeSeconds from nodes and line mode
    defaultRunningSpeedKmH?: number;
    variables?: PathStatistics;
    routingFailed?: boolean;
    routingMode?: string;
    routingEngine?: 'manual' | 'engine' | 'engineCustom';
    geographyErrors?: {
        error: string;
        nodes?: GeoJSON.Feature<GeoJSON.Point>[];
        waypoints?: GeoJSON.Feature<GeoJSON.Point>[];
    };
    minMatchingTimestamp?: number; // timestamp used for map matching routing, in seconds
    // The following properties contain array of data per node.
    nodeTypes: string[];
    waypoints: [number, number][][];
    waypointTypes: string[][];
    segments?: TimeAndDistance[];
    dwellTimeSeconds?: number[];
    gtfs?: {
        shape_id: string;
    };
    increaseRoutingRadiiToIncludeExistingPathShape?: boolean;
    // FIXME: Consider putting all those calculated path data in a single object where each is not optional
    operatingTimeWithoutLayoverTimeSeconds?: number;
    birdDistanceBetweenTerminals?: number;
    directRouteBetweenTerminalsDistanceMeters?: number;
    travelTimeWithoutDwellTimesSeconds?: number;
    directRouteBetweenTerminalsTravelTimeSeconds?: number;
    operatingSpeedMetersPerSecond?: number;
    operatingTimeWithLayoverTimeSeconds?: number;
    maxRunningSpeedKmH?: number;
    totalTravelTimeWithReturnBackSeconds?: number;
    averageSpeedWithoutDwellTimesMetersPerSecond?: number;
    customLayoverMinutes?: number;
    totalDistanceMeters?: number;
    temporaryManualRouting?: boolean;
    [key: string]: unknown;
}
export interface PathAttributes extends MapObjectAttributes<GeoJSON.LineString> {
    direction: PathDirection;
    line_id: string;
    is_enabled?: boolean;
    /** array of node ids in this path */
    nodes: string[];
    /** TODO what's the difference with nodes? */
    stops?: string[];
    /** An array containing the index in the geography's coordinates of the node
     * starting this segment. This array should have the same size as the nodes
     * array. */
    segments: number[];
    mode?: string;
    color?: string;
    data: PathAttributesData;
}

/**
 * Specific sequence of stops associated with a line. Has a sequence of nodes
 * (less precise) or stops (more precise)
 *
 * TODO: Test coverage is very limited, but many methods might be moved to a
 * utility service instead of being in this class. Node insertion/update could
 * easily be further tested
 */
export class Path extends MapObject<GeoJSON.LineString, PathAttributes> implements Saveable {
    protected static displayName = 'Path';

    constructor(attributes = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew, collectionManager);
        if (_isBlank(this._attributes.data.variables)) {
            this.refreshStats();
        }
        this.setDefaultValues();
    }

    _prepareAttributes(attributes: Partial<PathAttributes>) {
        if (!attributes.data) {
            attributes.data = {
                waypoints: [],
                waypointTypes: [],
                nodeTypes: []
            };
        } else {
            if (!attributes.data.waypoints) {
                attributes.data.waypoints = [];
            }
            if (!attributes.data.waypointTypes) {
                attributes.data.waypointTypes = [];
            }
        }
        if (_isBlank(attributes.data.variables)) {
            attributes.data.variables = {};
        }
        attributes.nodes = attributes.nodes || [];
        attributes.segments = attributes.segments || [];

        return super._prepareAttributes(attributes);
    }

    getClonedAttributes(deleteSpecifics = true): Partial<PathAttributes> {
        const newAttributes = super.getClonedAttributes(deleteSpecifics);
        delete newAttributes.data?.gtfs;
        return newAttributes;
    }

    setDefaultValues() {
        if (!this.attributes.data.nodeTypes || this.countNodes() !== this.attributes.data.nodeTypes.length) {
            const nodeTypes: string[] = [];
            for (let i = 0, count = this.countNodes(); i < count; i++) {
                nodeTypes.push(this.attributes.data.defaultRoutingEngine || 'engine');
            }
            this.attributes.data.nodeTypes = nodeTypes;
        }

        const line: any = this.getLine();
        const mode = this.getMode();

        if (_isBlank(this.attributes.direction) && line?.paths && line?.paths.length === 0) {
            this.attributes.direction = 'outbound';
        }

        const preferencesDefaultValues = Preferences.get('transit.paths', {});

        for (const defaultValueAttribute in preferencesDefaultValues) {
            if (defaultValueAttribute === 'data') {
                for (const defaultDataValueAttribute in preferencesDefaultValues.data) {
                    if (_isBlank(this.attributes.data[defaultDataValueAttribute])) {
                        this.attributes.data[defaultDataValueAttribute] =
                            preferencesDefaultValues.data[defaultDataValueAttribute];
                    }
                }
            } else if (defaultValueAttribute !== 'generator') {
                // ignore generator default values
                if (_isBlank(this.attributes[defaultValueAttribute])) {
                    this.attributes[defaultValueAttribute] = preferencesDefaultValues[defaultValueAttribute];
                }
            }
        }

        if (!_isBlank(mode)) {
            for (const defaultValueAttribute in lineModesConfigByMode[mode].defaultValues) {
                if (defaultValueAttribute === 'data') {
                    for (const defaultDataValueAttribute in lineModesConfigByMode[mode].defaultValues.data) {
                        if (_isBlank(this.attributes.data[defaultDataValueAttribute])) {
                            this.attributes.data[defaultDataValueAttribute] = Preferences.get(
                                `transit.lines.lineModesDefaultValues.${mode}.${defaultDataValueAttribute}`,
                                lineModesConfigByMode[mode].defaultValues.data[defaultDataValueAttribute]
                            );
                        }
                    }
                } else {
                    if (_isBlank(this.attributes[defaultValueAttribute])) {
                        this.attributes[defaultValueAttribute] =
                            lineModesConfigByMode[mode].defaultValues[defaultValueAttribute];
                    }
                }
            }
        }
    }

    get collectionManager(): any {
        return this._collectionManager;
    }

    isFrozen() {
        if (super.isFrozen()) {
            return true;
        }
        const line = this.getLine();
        return line ? line.isFrozen() : false;
    }

    toGeojson() {
        //LineStringUtils.offset(
        return {
            id: this.attributes.integer_id,
            geometry: this.attributes.geography,
            type: 'Feature' as const,
            properties: this.attributes
        };
    }

    /* This is used for manual routing only: when you import from a gtfs,
       the coordinates are imported from the shape.
       However, if routing engine is manual (click on map), we loose the
       waypoints, so when we refresh the path, it will just draw a straight
       line. This method converts the coordinates to waypoints so we can
       keep them and keep the imported shape after refreshing the path.
       returns null if routing engine is not manual and force is not true.
       If force param is set to true, the waypoints will be added even
       if the routing engine is not manual.
       TODO: testing!
    */
    convertAllCoordinatesToWaypoints(force = false) {
        const routingEngine = this.attributes.data.routingEngine || 'engine';
        if (force || routingEngine === 'manual') {
            const globalCoordinates = this.attributes.geography.coordinates;
            const globalCoordinatesLength = globalCoordinates.length;
            const nodesCount = this.countNodes();
            const segments = this.attributes.segments;
            const segmentsCount = segments.length;
            const nodeTypes: string[] = [];
            const waypointsByNodeIndex: [number, number][][] = [];
            const waypointTypesByNodeIndex: string[][] = [];

            for (let i = 0; i < nodesCount; i++) {
                nodeTypes.push(routingEngine);
            }

            let coordinateIndex = 0;
            for (let i = 0; i < segmentsCount - 1; i++) {
                waypointsByNodeIndex[i] = [];
                waypointTypesByNodeIndex[i] = [];
                const segment = segments[i];
                const nextSegment = segments[i + 1];
                const coordinatesLength = nextSegment - segment;
                for (let j = 0; j < coordinatesLength; j++) {
                    waypointsByNodeIndex[i].push(globalCoordinates[coordinateIndex] as [number, number]);
                    waypointTypesByNodeIndex[i].push(routingEngine);
                    coordinateIndex++;
                }
            }

            waypointsByNodeIndex.push([]);
            waypointTypesByNodeIndex.push([]);
            // add last segment:
            for (let i = coordinateIndex; i < globalCoordinatesLength; i++) {
                waypointsByNodeIndex[waypointsByNodeIndex.length - 1].push(globalCoordinates[i] as [number, number]);
                waypointTypesByNodeIndex[waypointTypesByNodeIndex.length - 1].push(routingEngine);
            }

            // save waypoints:
            this._attributes.data.nodeTypes = nodeTypes;
            this._attributes.data.waypoints = waypointsByNodeIndex;
            this._attributes.data.waypointTypes = waypointTypesByNodeIndex;
            this._updateHistory();
        }
    }

    removeConsecutiveDuplicateNodes() {
        const nodeIds = this.getAttributes().nodes;
        const nodesTypes = this.getAttributes().data.nodeTypes;
        const waypoints = this.getAttributes().data.waypoints;
        const waypointTypes = this.getAttributes().data.waypointTypes;

        const nodesCount = nodeIds.length;

        const cleanedNodeIds = [nodeIds[0]];
        const cleanedNodesTypes = [nodesTypes[0]];
        const cleanedWaypoints = [waypoints[0]];
        const cleanedWaypointTypes = [waypointTypes[0]];

        for (let i = 1; i < nodesCount; i++) {
            if (nodeIds[i] !== nodeIds[i - 1]) {
                cleanedNodeIds.push(nodeIds[i]);
                cleanedNodesTypes.push(nodesTypes[i]);
                cleanedWaypoints.push(waypoints[i]);
                cleanedWaypointTypes.push(waypointTypes[i]);
            }
        }
        this._attributes.nodes = cleanedNodeIds;
        this._attributes.data.nodeTypes = cleanedNodesTypes;
        this._attributes.data.waypoints = cleanedWaypoints;
        this._attributes.data.waypointTypes = cleanedWaypointTypes;
    }

    /**
     * Insert a node ID at a specific location
     * @param nodeId The ID of the node to insert
     * @param insertIndex The index at which to insert the node
     * @param nodeType The type of this node. Defaults to `engine`
     * @returns The updated path
     */
    insertNodeId(nodeId: string, insertIndex: number | null, nodeType = 'engine'): Promise<{ path: Path }> {
        const nodeIds = this.getAttributes().nodes;
        const nodeTypes = this.getAttributes().data.nodeTypes || [];
        const waypointsByNodeIndex = this.getAttributes().data.waypoints || [];
        const waypointTypesByNodeIndex = this.getAttributes().data.waypointTypes || [];
        if (insertIndex === undefined || insertIndex === null) {
            insertIndex = nodeIds.length;
            nodeIds.push(nodeId);
            nodeTypes.push(nodeType);
            waypointsByNodeIndex.push([]);
            waypointTypesByNodeIndex.push([]);
        } else {
            nodeIds.splice(insertIndex, 0, nodeId);
            nodeTypes.splice(insertIndex, 0, nodeType);
            waypointsByNodeIndex.splice(insertIndex, 0, []);
            waypointTypesByNodeIndex.splice(insertIndex, 0, []);
        }
        this._attributes.nodes = nodeIds;
        this._attributes.data.nodeTypes = nodeTypes;
        this._attributes.data.waypoints = waypointsByNodeIndex;
        this._attributes.data.waypointTypes = waypointTypesByNodeIndex;
        this.removeConsecutiveDuplicateNodes();
        this._updateHistory();
        return this.updateGeography();
    }

    /**
     * Remove a node in the path, identified by ID
     * @param removeNodeId The ID of the node to remove
     * @returns the updated path
     */
    async removeNodeId(removeNodeId: string): Promise<{ path: Path }> {
        // only if only one instance of the node in path
        const nodeIds = this.attributes.nodes;
        let countInstancesOfNodeId = 0;
        let removeNodeIndex = -1;
        nodeIds.forEach((nodeId, nodeIdx) => {
            if (nodeId === removeNodeId) {
                countInstancesOfNodeId++;
                removeNodeIndex = nodeIdx;
            }
        });
        if (countInstancesOfNodeId === 1 && removeNodeIndex >= 0) {
            return this.removeNode(removeNodeIndex);
        }
        // can't remove node (doesn't exist or at least two instances of the node in the path)
        return { path: this };
    }

    /**
     * Remove a node from the path, identified by its index in the path
     * @param removeIndex The index of the node to remove
     * @returns The updated path
     */
    async removeNode(removeIndex: number): Promise<{ path: Path }> {
        const nodeIds = this.attributes.nodes;
        const nodeTypes = this.attributes.data.nodeTypes;
        let recomputePath = false;
        if (nodeIds.length > 0 && removeIndex < nodeIds.length) {
            nodeIds.splice(removeIndex, 1);
            nodeTypes.splice(removeIndex, 1);
            this.attributes.nodes = nodeIds;
            this.attributes.data.nodeTypes = nodeTypes;
            // FIXME: This has the effect of removing all waypoints on the node before and the node to remove. Is that desired? Or should we rather merge them?
            const waypointsByNodeIndex = this.attributes.data.waypoints;
            const waypointTypesByNodeIndex = this.attributes.data.waypointTypes;
            waypointsByNodeIndex.splice(removeIndex, 1);
            waypointTypesByNodeIndex.splice(removeIndex, 1);
            if (waypointsByNodeIndex[removeIndex - 1]) {
                waypointsByNodeIndex[removeIndex - 1] = []; //afterNodeWaypoints;
                waypointTypesByNodeIndex[removeIndex - 1] = []; //afterNodeWaypointTypes;
            }
            this._attributes.nodes = nodeIds;
            this._attributes.data.nodeTypes = nodeTypes;
            this._attributes.data.waypoints = waypointsByNodeIndex;
            this._attributes.data.waypointTypes = waypointTypesByNodeIndex;
            if (nodeIds.length > 1) {
                this.removeConsecutiveDuplicateNodes();
            }
            recomputePath = true;
        } else if (nodeIds.length === 0) {
            // Path has no nodes, make sure all data is initialized
            this.attributes.nodes = [];
            this.attributes.data.nodeTypes = [];
            this.attributes.data.waypoints = [];
            this.attributes.data.waypointTypes = [];
            //this.emptyGeography();
        } else {
            // No node at index
            return { path: this };
        }
        this._updateHistory();
        return recomputePath ? this.updateGeography() : { path: this };
    }

    /**
     * Insert a waypoint at a given location
     *
     * @param waypointCoordinates The coordinates of the waypoint to insert
     * @param waypointType The type of the waypoint
     * @param afterNodeIndex The index of the node after which to insert this
     * waypoint. If not set, it is added at the end of the path
     * @param insertIndex The index at which to insert this waypoint. If not
     * set, it is added at the end of the waypoints for this path
     * @returns The updated path
     */
    async insertWaypoint(
        waypointCoordinates: [number, number],
        waypointType = 'engine',
        afterNodeIndex?: number,
        insertIndex?: number
    ): Promise<{ path: Path }> {
        const nodeIds = this.attributes.nodes;
        //console.log('inserting waypoint', waypointCoordinates, 'after node index: ' + afterNodeIndex + ' at insert index: ' + insertIndex);
        let afterNodeWaypoints: [number, number][] = [];
        let afterNodeWaypointTypes: string[] = [];
        if (_isBlank(insertIndex) && !_isBlank(afterNodeIndex)) {
            afterNodeWaypoints = this.getAttributes().data.waypoints[afterNodeIndex as number] || [];
            afterNodeWaypointTypes = this.getAttributes().data.waypointTypes[afterNodeIndex as number] || [];
            afterNodeWaypoints.push(waypointCoordinates);
            afterNodeWaypointTypes.push(waypointType);
        } else if (!_isBlank(insertIndex) && !_isBlank(afterNodeIndex)) {
            afterNodeWaypoints = this.getAttributes().data.waypoints[afterNodeIndex as number] || [];
            afterNodeWaypointTypes = this.getAttributes().data.waypointTypes[afterNodeIndex as number] || [];
            afterNodeWaypoints.splice(insertIndex as number, 0, waypointCoordinates);
            afterNodeWaypointTypes.splice(insertIndex as number, 0, waypointType);
        } else if (this.attributes.geography === undefined) {
            // No geography, insert at the end, or don't insert if path is empty
            if (this.getAttributes().nodes.length === 0) {
                return { path: this };
            }
            afterNodeIndex = this.getAttributes().nodes.length - 1;
            afterNodeWaypoints = this.getAttributes().data.waypoints[afterNodeIndex] || [];
            afterNodeWaypointTypes = this.getAttributes().data.waypointTypes[afterNodeIndex] || [];
            afterNodeWaypoints.push(waypointCoordinates);
            afterNodeWaypointTypes.push(waypointType);
        } else {
            // we need to determine where to put waypoint on path, if the point is close enough to the line, take this point
            // TODO Move the search of the best location out of this function and add the waypoint at the end of the path is indexes are not set instead
            const waypointsByNodeIndex = this.getAttributes().data.waypoints;
            const waypointTypesByNodeIndex = this.getAttributes().data.waypointTypes;
            const globalCoordinates = this.attributes.geography.coordinates;
            const segmentBeforeWaypoint = turfLineSlice(
                turfHelpers.point(globalCoordinates[0]),
                turfHelpers.point(waypointCoordinates),
                turfHelpers.lineString(globalCoordinates)
            );
            const segmentBeforeWaypointLength = turfLength(segmentBeforeWaypoint, { units: 'meters' });
            //console.log('segmentBeforeLength', segmentBeforeWaypointLength, 'segmentBeforeCoordinates', segmentBeforeWaypoint.geometry.coordinates, 'globalCoordinates', globalCoordinates);
            afterNodeIndex = undefined;
            insertIndex = 0;
            const segments = this.attributes.segments;
            let segmentsLengthSoFar = 0;
            for (let i = 0, count = segments.length; i < count; i++) {
                const segmentGeojson = this.segmentGeojson(i, i + 1);
                segmentsLengthSoFar += turfLength(segmentGeojson, { units: 'meters' });
                if (segmentsLengthSoFar > segmentBeforeWaypointLength) {
                    //console.log(i, "segmentsLengthSoFar", segmentsLengthSoFar, 'segmentBeforeWaypointLength', segmentBeforeWaypointLength);
                    afterNodeIndex = i;
                    break;
                }
            }
            if (afterNodeIndex === undefined) {
                afterNodeIndex = nodeIds.length - 1;
            }
            //console.log('inserted waypoint will be after node index', afterNodeIndex);
            afterNodeWaypoints = waypointsByNodeIndex[afterNodeIndex] || [];
            afterNodeWaypointTypes = waypointTypesByNodeIndex[afterNodeIndex] || [];
            const segmentGeojson = this.segmentGeojson(afterNodeIndex, afterNodeIndex + 1);
            for (let i = 0, count = afterNodeWaypoints.length; i < count; i++) {
                const waypoint = afterNodeWaypoints[i];
                const segmentBeforeExistingWaypoint = turfLineSlice(
                    turfHelpers.point(segmentGeojson.geometry.coordinates[0]),
                    turfHelpers.point(waypoint),
                    segmentGeojson
                );
                const segmentBeforeExistingLength = turfLength(segmentBeforeExistingWaypoint, { units: 'meters' });
                const segmentBeforeWaypoint = turfLineSlice(
                    turfHelpers.point(segmentGeojson.geometry.coordinates[0]),
                    turfHelpers.point(waypointCoordinates),
                    segmentGeojson
                );
                const segmentBeforeLength = turfLength(segmentBeforeWaypoint, { units: 'meters' });
                if (segmentBeforeLength >= segmentBeforeExistingLength) {
                    insertIndex = i + 1;
                    //console.log('inserted waypoint will be after waypoint index', insertIndex);
                    //break;
                } else {
                    break;
                }
            }
            if (!_isBlank(insertIndex) && !_isBlank(afterNodeIndex)) {
                afterNodeWaypoints.splice(insertIndex, 0, waypointCoordinates);
                afterNodeWaypointTypes.splice(insertIndex, 0, waypointType);
            }
        }
        this._attributes.data.waypoints[afterNodeIndex as number] = afterNodeWaypoints;
        this._attributes.data.waypointTypes[afterNodeIndex as number] = afterNodeWaypointTypes;
        this._updateHistory();
        return this.updateGeography();
    }

    /**
     * Replace waypoint coordinates by new ones. If the waypoint does not exist,
     * the path is not changed.
     *
     * @param waypointCoordinates The new coordinates of the waypoint
     * @param waypointType The type of this updated waypoint
     * @param afterNodeIndex The index of the node after which the waypoint is
     * located
     * @param waypointIndex The index of the waypoint to update
     * @returns The updated path
     */
    async updateWaypoint(
        waypointCoordinates: [number, number],
        waypointType: string | undefined = undefined,
        afterNodeIndex: number,
        waypointIndex: number
    ): Promise<{ path: Path }> {
        // Make sure waypoint exists
        if (
            _isBlank(this.attributes.data.waypoints[afterNodeIndex]) ||
            _isBlank(this.attributes.data.waypoints[afterNodeIndex][waypointIndex])
        ) {
            // Waypoint does not exist, just return
            return { path: this };
        }
        const afterNodeWaypoints = this.attributes.data.waypoints[afterNodeIndex];
        const afterNodeWaypointTypes = this.attributes.data.waypointTypes[afterNodeIndex];
        afterNodeWaypoints[waypointIndex] = waypointCoordinates;
        afterNodeWaypointTypes[waypointIndex] = waypointType || afterNodeWaypointTypes[waypointIndex] || 'engine';
        this.attributes.data.waypoints[afterNodeIndex] = afterNodeWaypoints;
        this.attributes.data.waypointTypes[afterNodeIndex] = afterNodeWaypointTypes;
        this._updateHistory();
        return this.updateGeography();
    }

    /**
     * Replace a waypoint by a transit node. The node is expected to exist. If
     * the waypoint does not exit, the path is not changed
     * @param nodeId The ID of the node to replace
     * @param afterNodeIndex The index of the node after which the waypoint to
     * replace is located
     * @param waypointIndex The index of the waypoint to replace
     * @param waypointType The type of the node
     * @returns The updated path.
     */
    async replaceWaypointByNodeId(
        nodeId: string,
        afterNodeIndex: number,
        waypointIndex: number,
        waypointType = 'engine'
    ): Promise<{ path: Path }> {
        // Make sure waypoint exists
        if (
            _isBlank(this.attributes.data.waypoints[afterNodeIndex]) ||
            _isBlank(this.attributes.data.waypoints[afterNodeIndex][waypointIndex])
        ) {
            // Waypoint does not exist, just return
            return { path: this };
        }
        const waypointsByNodeIndex = this.attributes.data.waypoints;
        const waypointTypesByNodeIndex = this.attributes.data.waypointTypes;
        const afterNodeWaypoints = waypointsByNodeIndex[afterNodeIndex];
        const afterNodeWaypointTypes = waypointTypesByNodeIndex[afterNodeIndex];
        const waypointsBefore = afterNodeWaypoints.slice(0, waypointIndex);
        const waypointTypesBefore = afterNodeWaypointTypes.slice(0, waypointIndex);
        const waypointsAfter = afterNodeWaypoints.slice(waypointIndex + 1);
        const waypointTypesAfter = afterNodeWaypointTypes.slice(waypointIndex + 1);
        const nodeIds = this.attributes.nodes;
        const nodeTypes = this.attributes.data.nodeTypes;
        nodeIds.splice(afterNodeIndex + 1, 0, nodeId);
        nodeTypes.splice(afterNodeIndex + 1, 0, waypointType);
        waypointsByNodeIndex.splice(afterNodeIndex + 1, 0, waypointsAfter);
        waypointTypesByNodeIndex.splice(afterNodeIndex + 1, 0, waypointTypesAfter);
        waypointsByNodeIndex[afterNodeIndex] = waypointsBefore;
        waypointTypesByNodeIndex[afterNodeIndex] = waypointTypesBefore;
        this._attributes.nodes = nodeIds;
        this._attributes.data.nodeTypes = nodeTypes;
        this._attributes.data.waypoints = waypointsByNodeIndex;
        this._attributes.data.waypointTypes = waypointTypesByNodeIndex;
        this.removeConsecutiveDuplicateNodes();
        this._updateHistory();
        return this.updateGeography();
    }

    /**
     * Remove a waypoint. If the waypoint does not exit, the path is not changed
     * @param afterNodeIndex The index of the node after which the waypoint to
     * replace is located
     * @param waypointIndex The index of the waypoint to replace
     * @returns The updated path.
     */
    async removeWaypoint(afterNodeIndex: number, waypointIndex: number): Promise<{ path: Path }> {
        // Make sure waypoint exists
        if (
            _isBlank(this.attributes.data.waypoints[afterNodeIndex]) ||
            _isBlank(this.attributes.data.waypoints[afterNodeIndex][waypointIndex])
        ) {
            // Waypoint does not exist, just return
            return { path: this };
        }
        const afterNodeWaypoints = this.attributes.data.waypoints[afterNodeIndex];
        const afterNodeWaypointTypes = this.attributes.data.waypointTypes[afterNodeIndex];
        afterNodeWaypoints.splice(waypointIndex, 1);
        afterNodeWaypointTypes.splice(waypointIndex, 1);
        this._attributes.data.waypoints[afterNodeIndex] = afterNodeWaypoints;
        this._attributes.data.waypointTypes[afterNodeIndex] = afterNodeWaypointTypes;
        this._updateHistory();
        return this.updateGeography();
    }

    /* Get the time arrival at node index if departure is at 0 seconds (cumulative travel time up to the node).
    TODO: add test
    */
    getCumulativeTimeForNodeIndex(nodeIndex: number): number | undefined {
        let tripTimeSoFar = 0;
        const segments = this.getAttributes().data.segments || [];
        const dwellTimes = this.getAttributes().data.dwellTimeSeconds || [];

        for (let i = 0; i < nodeIndex; i++) {
            const segment = segments[i];
            const dwellTime = dwellTimes[i];
            if (dwellTime) {
                tripTimeSoFar += dwellTime;
            }
            if (segment && segment.travelTimeSeconds !== null) {
                tripTimeSoFar += segment.travelTimeSeconds;
            } else {
                return undefined;
            }
        }

        return tripTimeSoFar;
    }

    /* Get the cumulative distance traveled until the node index .
    TODO: add test
    */
    getCumulativeDistanceForNodeIndex(nodeIndex: number): number | undefined {
        let tripDistanceSoFar = 0;
        const segments = this.getAttributes().data.segments || [];

        for (let i = 0; i < nodeIndex; i++) {
            const segment = segments[i];
            if (segment && segment.distanceMeters !== null) {
                tripDistanceSoFar += segment.distanceMeters;
            } else {
                return undefined;
            }
        }

        return tripDistanceSoFar;
    }

    /* Get the distance between the path geography and each node and get the routing radius for each node:
       If any diff (radius - distance) is < 0, that means that the routing may fail or may change when calculating again (take a detour to reach the node with a radius too small for the actual path geography)
       This will mostly happen for paths imported from gtfs or when a node routing radius is changed between path calculations
    */
    getNodesDistancesFromPathWithNodesRoutingRadii(
        nodeCollection: NodeCollection | undefined = this._collectionManager?.get('nodes')
    ): { nodeId: string; distanceMeters: number; routingRadiusMeters: number }[] {
        const nodeIds = this.getAttributes().nodes;
        const nodesCount = nodeIds.length;
        const coordinates = this.getAttributes().geography?.coordinates;
        const segments = this.getAttributes().segments;
        if (
            !nodeCollection ||
            !segments ||
            !coordinates ||
            _isBlank(coordinates) ||
            coordinates.length - 1 < segments[segments.length - 1] ||
            segments.length < nodesCount - 1 ||
            !nodeCollection
        ) {
            return []; // TODO: throw an error
        }
        const defaultRoutingRadiusMeters = Preferences.current.transit.nodes.defaultRoutingRadiusMeters;
        const nodesDistancesAndRadiiFromPath: {
            nodeId: string;
            distanceMeters: number;
            routingRadiusMeters: number;
        }[] = [];

        for (let i = 0; i < nodesCount; i++) {
            const nodeId = nodeIds[i];
            const nodeGeojson = nodeCollection.getById(nodeId);
            if (!nodeGeojson) {
                return []; // TODO: throw an error
            }
            // if last node, use last coordinate if no segment is available:
            const segmentCoordinates =
                i === nodesCount - 1 && !coordinates[segments[i]]
                    ? coordinates[coordinates.length - 1]
                    : coordinates[segments[i]];
            const distanceFromNode = turfDistance(turfHelpers.point(segmentCoordinates), nodeGeojson, {
                units: 'meters'
            });
            const routingRadiusMeters: number =
                nodeGeojson?.properties?.routing_radius_meters || defaultRoutingRadiusMeters;
            nodesDistancesAndRadiiFromPath[i] = {
                nodeId,
                distanceMeters: distanceFromNode,
                routingRadiusMeters
            };
        }
        return nodesDistancesAndRadiiFromPath;
    }

    // Any diff (radius-distance) < 5m may fail in routing (5m buffer) so we check for diff < 5:
    getDistancesForNodeIdsWithRoutingRadiusTooSmallForPathShape(
        nodeCollection = this._collectionManager?.get('nodes')
    ): { [key: string]: number } {
        const nodesDistancesFromAndDiffWithNodesRoutingRadii =
            this.getNodesDistancesFromPathWithNodesRoutingRadii(nodeCollection);
        const nodeIdsWithRoutingRadiusTooSmallForPathShape = {};
        for (let i = 0, count = nodesDistancesFromAndDiffWithNodesRoutingRadii.length; i < count; i++) {
            if (
                nodesDistancesFromAndDiffWithNodesRoutingRadii[i].routingRadiusMeters -
                    nodesDistancesFromAndDiffWithNodesRoutingRadii[i].distanceMeters <
                5
            ) {
                nodeIdsWithRoutingRadiusTooSmallForPathShape[nodesDistancesFromAndDiffWithNodesRoutingRadii[i].nodeId] =
                    nodesDistancesFromAndDiffWithNodesRoutingRadii[i].distanceMeters;
            }
        }
        return nodeIdsWithRoutingRadiusTooSmallForPathShape;
    }

    nodesGeojsons() {
        const nodeIds = this.attributes.nodes;
        const nodeTypes = this.attributes.data.nodeTypes;
        const nodesInError = this.attributes.data.geographyErrors?.nodes || [];
        const nodesGeojsons: GeoJSON.Feature<GeoJSON.Point>[] = [];
        if (this._collectionManager.get('nodes')) {
            for (let i = 0, count = nodeIds.length; i < count; i++) {
                const nodeId = nodeIds[i];
                const nodeType = nodeTypes[i];
                const nodeGeojson = _cloneDeep(this._collectionManager.get('nodes').getById(nodeId));
                const nodeInError = nodesInError.find((errNode) => errNode.properties?.id === nodeId) !== undefined;
                nodeGeojson.properties.type = nodeType;
                nodeGeojson.properties.isNodeIsError = nodeInError;
                nodesGeojsons.push(nodeGeojson);
            }
        }
        return nodesGeojsons;
    }

    waypointsGeojsons() {
        const waypointsByNodeIndex = this.attributes.data.waypoints || [];
        const waypointTypesByNodeIndex = this.attributes.data.waypointTypes || [];
        const waypointsInError = this.attributes.data.geographyErrors?.waypoints || [];
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        let featureId = 1;
        const defaultRoutingType = this.attributes.data.routingEngine || 'engine';
        waypointsByNodeIndex.forEach((waypoints, afterNodeIndex) => {
            if (!waypoints) {
                waypoints = [];
            }
            waypoints.forEach((waypoint, waypointIndex) => {
                const waypointType = _get(
                    waypointTypesByNodeIndex,
                    `[${afterNodeIndex}][${waypointIndex}]`,
                    defaultRoutingType
                );
                // Change color of waypoint if it has error
                // FIXME: this is not the best way to do it, we should have a better way to handle errors when we refactor the path generations
                const isWaypointInError =
                    waypointsInError.find((errWaypoint) => errWaypoint.geometry.coordinates === waypoint) !== undefined;
                features.push(
                    turfHelpers.point(
                        waypoint,
                        { afterNodeIndex, waypointIndex, type: waypointType, isWaypointInError },
                        { id: featureId }
                    )
                );
                featureId++;
            });
        });
        return features;
    }

    emptyGeography() {
        const newData = {
            segments: null, // the last segment is the return back to first stop
            dwellTimeSeconds: null, // the last travel time is the travel time to go back to first stop
            layoverTimeSeconds: null,
            travelTimeWithoutDwellTimesSeconds: null,
            totalDistanceMeters: null,
            operatingTimeWithoutLayoverTimeSeconds: null,
            operatingTimeWithLayoverTimeSeconds: null,
            averageSpeedWithoutDwellTimesMetersPerSecond: null,
            operatingSpeedMetersPerSecond: null,
            operatingSpeedWithLayoverMetersPerSecond: null,
            returnBackGeography: null,
            variables: {}
        };
        this.set('geography', null); // TODO: fix this, it should never be null when typing correctly, but setting coordinates to an empty array fails right now
        this.attributes.segments = [];
        this.attributes.data = Object.assign(this.attributes.data, newData);
        this._updateHistory();
    }

    /**
     * Get the geography between 2 nodes.
     *
     * @param nodeStartIndex The index of the node at the beginning of the
     * desired segment
     * @param nodeEndIndex The index of the node at the end of the desired
     * segment
     * @param properties Any additional property to add to the segment geojson
     * @returns A line string feature for the segment between nodes, or
     * undefined if the segment has no geometry or indexes are invalid
     * @throws TrError with code `PathNoGeography` if the path has no geography,
     * or `PathInvalidSegmentIndex` if the start/end nodes are invalid
     */
    segmentGeojson(
        nodeStartIndex: number,
        nodeEndIndex: number,
        properties: any = {}
    ): GeoJSON.Feature<GeoJSON.LineString> {
        if (this.attributes.geography === undefined) {
            throw new TrError('Path has no geography', 'PathNoGeography');
        }
        if (nodeStartIndex > this.attributes.segments.length || nodeStartIndex >= nodeEndIndex) {
            throw new TrError('Path segment geojson: invalid start index', 'PathInvalidSegmentIndex');
        }
        if (properties.color === undefined) {
            properties.color = this.get('color', this.getLine()?.get('color'));
        }
        const pathCoordinates = this.attributes.geography.coordinates;
        const pathSegments = this.attributes.segments;
        const pathCoordinatesStartIndex = pathSegments[nodeStartIndex];
        let pathCoordinatesEndIndex = 0;
        if (!_isBlank(pathSegments[nodeEndIndex])) {
            // last coordinate
            pathCoordinatesEndIndex = pathSegments[nodeEndIndex];
        } else {
            // last segment:
            pathCoordinatesEndIndex = pathCoordinates.length - 1;
        }
        const segmentCoordinates = pathCoordinates.slice(pathCoordinatesStartIndex, pathCoordinatesEndIndex + 1); // slice does not include end index
        // Make sure there are coordinates. If only one, repeat the coordinate to have a 0-length line string
        if (segmentCoordinates.length < 1) {
            throw new TrError('Path segment geojson: invalid line string length', 'PathInvalidSegmentIndex');
        } else if (segmentCoordinates.length === 1) {
            segmentCoordinates.push(segmentCoordinates[0]);
        }
        return {
            type: 'Feature' as const,
            id: this.attributes.integer_id,
            properties,
            geometry: {
                type: 'LineString' as const,
                coordinates: segmentCoordinates
            }
        };
    }

    refreshStats() {
        const variables: PathStatistics = {
            d_p: roundToDecimals(this.attributes.data.totalDistanceMeters || ''),
            n_q_p: this.countNodes(),
            d_l_min: null,
            d_l_max: null,
            d_l_avg: null,
            d_l_med: null,
            T_o_p: this.attributes.data.operatingTimeWithoutLayoverTimeSeconds
        };
        variables.n_s_p = variables.n_q_p;

        const segmentDistances: number[] = (this.attributes.data.segments || [])
            .map((segment) => {
                return segment.distanceMeters;
            })
            .filter((distance) => distance !== null) as number[];

        if (segmentDistances.length > 0) {
            variables.d_l_min = Math.ceil(Math.min(...segmentDistances));
            variables.d_l_max = Math.ceil(Math.max(...segmentDistances));
            variables.d_l_avg = roundToDecimals(_mean(segmentDistances), 0);
            variables.d_l_med = roundToDecimals(median(segmentDistances), 0);
        }

        this.attributes.data.variables = variables;
    }

    updateGeography() {
        return updatePathGeography(this);
    }

    isComplete() {
        // at least 2 nodes and valid shapes and segments
        const nodesCount = this.countNodes();
        const dwellTimesSeconds = this.attributes.data.dwellTimeSeconds || [];
        const segments = this.attributes.data.segments || [];
        /*
        console.log(nodesCount < 2, _isBlank(this.get('direction')), !_isNumber(this.getData('totalDistanceMeters')), !_isNumber(this.getData('operatingTimeWithLayoverTimeSeconds')),
        !_isNumber(this.getData('travelTimeWithoutDwellTimesSeconds')), !_isNumber(this.getData('totalDwellTimeSeconds')), !_isNumber(this.getData('layoverTimeSeconds')), this.getData('routingFailed') === true,
        this.get('segments', []).length !== nodesCount - 1, dwellTimesSeconds.length !== nodesCount, segments.length !== nodesCount - 1, !isFeature(this.toGeojson()));
        */
        if (
            nodesCount < 2 ||
            _isBlank(this.get('direction')) ||
            !_isNumber(this.getData('totalDistanceMeters')) ||
            !_isNumber(this.getData('operatingTimeWithLayoverTimeSeconds')) ||
            !_isNumber(this.getData('travelTimeWithoutDwellTimesSeconds')) ||
            !_isNumber(this.getData('totalDwellTimeSeconds')) ||
            !_isNumber(this.getData('layoverTimeSeconds')) ||
            this.getData('routingFailed') === true ||
            this.attributes.segments.length !== nodesCount - 1 ||
            dwellTimesSeconds.length !== nodesCount ||
            segments.length !== nodesCount - 1
        ) {
            return false;
        }
        for (let i = 0, count = nodesCount - 1; i < count; i++) {
            if (
                !_isNumber(dwellTimesSeconds[i]) ||
                dwellTimesSeconds[i] < 0 ||
                !segments[i] ||
                !_isNumber(segments[i].distanceMeters) ||
                segments[i].distanceMeters === null ||
                !_isNumber(segments[i].travelTimeSeconds) ||
                segments[i].travelTimeSeconds < 0
            ) {
                /*console.log(dwellTimesSeconds[i], segments[i])*/
                return false;
            }
        }
        return true;
    }

    // TODO: extract mode related validations to external function
    canRoute() {
        let canRoute = true;
        const errors: string[] = [];
        const pathData = this.getAttributes().data;

        if (this.countNodes() < 2) {
            canRoute = false;
            errors.push('transit:transitPath:errors:NeedAtLeast2NodesOrStops');
        }
        if (!this.get('direction')) {
            canRoute = false;
            errors.push('transit:transitPath:errors:DirectionIsRequired');
        }
        if (
            (['engineCustom', 'manual'].includes(pathData.routingEngine || '') || this.atLeastOneSegmentIsManual()) &&
            _isBlank(pathData.defaultRunningSpeedKmH)
        ) {
            canRoute = false;
            errors.push(
                'transit:transitPath:errors:DefaultRunningSpeedIsRequiredForManualAndEngineCustomRoutingEngines'
            );
        }
        if (_isBlank(pathData.routingEngine)) {
            canRoute = false;
            errors.push('transit:transitPath:errors:RoutingEngineIsRequired');
        }
        if (['engineCustom', 'engine'].includes(pathData.routingEngine || '') && _isBlank(pathData.routingMode)) {
            canRoute = false;
            errors.push('transit:transitPath:errors:RoutingModeIsRequired');
        }
        if (
            _isNumber(pathData.defaultRunningSpeedKmH) &&
            (pathData.defaultRunningSpeedKmH <= 0 || pathData.defaultRunningSpeedKmH > 500)
        ) {
            canRoute = false;
            errors.push('transit:transitPath:errors:DefaultRunningSpeedIsInvalid');
        }
        if (
            _isNumber(pathData.defaultDwellTimeSeconds) &&
            (pathData.defaultDwellTimeSeconds <= 0 || pathData.defaultDwellTimeSeconds > 600)
        ) {
            if (
                this.getMode() !== 'transferable' ||
                (this.getMode() === 'transferable' && pathData.defaultDwellTimeSeconds < 0)
            ) {
                canRoute = false;
                errors.push('transit:transitPath:errors:MinDwellTimeIsInvalid');
            }
        }
        if (!_isNumber(pathData.defaultAcceleration)) {
            canRoute = false;
            errors.push('transit:transitPath:errors:DefaultAccelerationIsRequired');
        } else {
            if (pathData.defaultAcceleration < 0) {
                canRoute = false;
                errors.push('transit:transitPath:errors:DefaultAccelerationIsInvalid');
            } else if (pathData.defaultAcceleration <= 0.3) {
                canRoute = false;
                errors.push('transit:transitPath:errors:DefaultAccelerationIsTooLow');
            } else if (pathData.defaultAcceleration > 1.5 && this.getMode() !== 'transferable') {
                canRoute = false;
                errors.push('transit:transitPath:errors:DefaultAccelerationIsTooHigh');
            }
        }
        if (!_isNumber(pathData.defaultDeceleration)) {
            canRoute = false;
            errors.push('transit:transitPath:errors:DefaultDecelerationIsRequired');
        } else {
            if (pathData.defaultDeceleration < 0) {
                canRoute = false;
                errors.push('transit:transitPath:errors:DefaultDecelerationIsInvalid');
            } else if (pathData.defaultDeceleration <= 0.3) {
                canRoute = false;
                errors.push('transit:transitPath:errors:DefaultDecelerationIsTooLow');
            } else if (pathData.defaultDeceleration > 1.5 && this.getMode() !== 'transferable') {
                canRoute = false;
                errors.push('transit:transitPath:errors:DefaultDecelerationIsTooHigh');
            }
        }
        if (
            _isNumber(pathData.defaultRunningSpeedKmH) &&
            _isNumber(pathData.maxRunningSpeedKmH) &&
            pathData.defaultRunningSpeedKmH > pathData.maxRunningSpeedKmH
        ) {
            canRoute = false;
            errors.push('transit:transitPath:errors:DefaultRunningSpeedIsTooHigh');
        }
        const travelTimeWithoutDwellTimesSeconds = this.getAttributes().data.travelTimeWithoutDwellTimesSeconds;
        const operatingSpeedMetersPerSecond = this.getAttributes().data.operatingSpeedMetersPerSecond;
        const operatingTimeWithoutLayoverTimeSeconds = this.getAttributes().data.operatingTimeWithoutLayoverTimeSeconds;
        if (
            this.getAttributes().nodes.length >= 2 &&
            this.getAttributes().geography &&
            (!travelTimeWithoutDwellTimesSeconds ||
                _isBlank(travelTimeWithoutDwellTimesSeconds) ||
                isNaN(travelTimeWithoutDwellTimesSeconds) ||
                !operatingSpeedMetersPerSecond ||
                _isBlank(operatingSpeedMetersPerSecond) ||
                isNaN(operatingSpeedMetersPerSecond) ||
                !operatingTimeWithoutLayoverTimeSeconds ||
                _isBlank(operatingTimeWithoutLayoverTimeSeconds) ||
                isNaN(operatingTimeWithoutLayoverTimeSeconds))
        ) {
            this.getAttributes().data.routingFailed = true;
            canRoute = false;
        }

        return {
            canRoute,
            errors
        };
    }

    validate() {
        super.validate();
        const data = this.getAttributes().data;
        const canRouteResults = this.canRoute();
        this._isValid = this._isValid && canRouteResults.canRoute;
        this._errors = canRouteResults.errors;

        if (data.routingFailed === true) {
            this._isValid = false;
            this._errors.push(
                data.geographyErrors?.error ? data.geographyErrors.error : 'transit:transitPath:errors:RoutingFailed'
            );
        }
        return this._isValid;
    }

    addError(message) {
        if (!this.errors) {
            this.errors = [];
        }
        if (!this.errors.includes(message)) {
            this.errors.push(message);
        }
    }

    removeError(message) {
        if (!this.errors) {
            this.errors = [];
        }
        const errorIndex = this.errors.indexOf(message);
        if (errorIndex >= 0) {
            this.errors.splice(errorIndex, 1);
        }
    }

    getDwellTimeSecondsAtNode(nodeDwellTimeSeconds: number | undefined): number {
        const defaultGeneralDwellTimeSeconds = Math.max(
            0,
            Preferences.get('transit.nodes.defaultDwellTimeSeconds', 20)
        );
        const pathDwellTimeSeconds: number = Math.max(
            0,
            this.getData('defaultDwellTimeSeconds', defaultGeneralDwellTimeSeconds) as number
        );

        if (this.getData('ignoreNodesDefaultDwellTimeSeconds', false) === true) {
            return pathDwellTimeSeconds;
        }
        const defaultNodeDwellTime: number =
            nodeDwellTimeSeconds !== undefined && nodeDwellTimeSeconds >= 0
                ? nodeDwellTimeSeconds
                : defaultGeneralDwellTimeSeconds;
        return Math.ceil(Math.max(defaultNodeDwellTime, pathDwellTimeSeconds));
    }

    getTemporalTortuosity() {
        if (this.countNodes() < 2) {
            return null;
        }
        if (
            _isFinite(this.attributes.data.operatingTimeWithoutLayoverTimeSeconds) &&
            _isFinite(this.attributes.data.directRouteBetweenTerminalsTravelTimeSeconds)
        ) {
            const nodes = this.attributes.nodes;
            if (nodes[0] === nodes[this.countNodes() - 1]) {
                return null; // loop
            }
            return (
                (this.attributes.data.operatingTimeWithoutLayoverTimeSeconds || 0) /
                (this.attributes.data.directRouteBetweenTerminalsTravelTimeSeconds as number)
            );
        }
        return null;
    }

    getTemporalTortuosityWithoutDwellTimes() {
        if (this.countNodes() < 2) {
            return null;
        }
        if (this.countNodes() === 2) {
            return 1.0;
        }
        if (
            _isFinite(this.attributes.data.travelTimeWithoutDwellTimesSeconds) &&
            _isFinite(this.attributes.data.directRouteBetweenTerminalsTravelTimeSeconds)
        ) {
            const nodes = this.attributes.nodes;
            if (nodes[0] === nodes[this.countNodes() - 1]) {
                return null; // loop
            }
            return (
                (this.attributes.data.travelTimeWithoutDwellTimesSeconds as number) /
                (this.attributes.data.directRouteBetweenTerminalsTravelTimeSeconds as number)
            );
        }
        return null;
    }

    getSpatialTortuosity() {
        if (this.countNodes() < 2) {
            return null;
        }
        if (this.countNodes() === 2) {
            return 1.0;
        }
        const nodes = this.attributes.nodes;
        if (
            _isFinite(this.attributes.data.totalDistanceMeters) &&
            _isFinite(this.attributes.data.directRouteBetweenTerminalsDistanceMeters)
        ) {
            if (nodes[0] === nodes[this.countNodes() - 1]) {
                return null; // loop
            }
            return (
                (this.attributes.data.totalDistanceMeters || 0) /
                (this.attributes.data.directRouteBetweenTerminalsDistanceMeters as number)
            );
        }
        return null;
    }

    getEuclidianTortuosity() {
        const nodes = this.attributes.nodes;
        if (this.countNodes() < 2) {
            return null;
        }
        if (
            _isFinite(this.attributes.data.totalDistanceMeters) &&
            _isFinite(this.attributes.data.birdDistanceBetweenTerminals)
        ) {
            if (nodes[0] === nodes[this.countNodes() - 1]) {
                return null; // loop
            }
            return (
                (this.attributes.data.totalDistanceMeters || 0) /
                (this.attributes.data.birdDistanceBetweenTerminals as number)
            );
        }
        return null;
    }

    getLine(): GenericObject<any> | null {
        // TODO This class cannot type the Line (because Line has Path), so it should be getContainer or getParent
        if (this._collectionManager && this._collectionManager.get('lines')) {
            return this._collectionManager.get('lines').getById(this.get('line_id'));
        } else {
            return null;
        }
    }

    toString(showId = false) {
        const attributes = this.getAttributes();
        const name = attributes.name;
        if (name) {
            return `${name}` + (showId ? ` ${attributes.id}` : '');
        }
        return showId ? attributes.id : '';
    }

    countNodes() {
        return this.attributes.nodes.length;
    }

    averageInterNodesDistanceMeters() {
        if (this.isComplete()) {
            return Math.ceil((this.attributes.data.totalDistanceMeters || 0) / (this.countNodes() - 1));
        }
        return null;
    }

    medianInterNodesDistanceMeters() {
        return median(this.getInterNodesDistances());
    }

    getInterNodesDistances() {
        const interNodesDistances: number[] = [];
        if (this.isComplete()) {
            this.getAttributes().data.segments?.forEach((segment) => {
                if (segment && segment.distanceMeters) {
                    interNodesDistances.push(segment.distanceMeters);
                }
            });
            return interNodesDistances;
        }
        return [];
    }

    hasNodeId(nodeId: string) {
        return (this.attributes.nodes || []).includes(nodeId);
    }

    getInterNodesTravelTimes() {
        const interNodesTravelTimes: number[] = [];
        if (this.isComplete()) {
            (this.attributes.data.segments || []).forEach((segment) => {
                if (segment && segment.travelTimeSeconds) {
                    interNodesTravelTimes.push(segment.travelTimeSeconds);
                }
            });
            return interNodesTravelTimes;
        }
        return null;
    }

    getTotalWeight() {
        let totalWeight = 0;
        (this.attributes.nodes || []).forEach((nodeId) => {
            const nodeWeight = _get(this._collectionManager?.get('nodes').getById(nodeId), 'properties.data.weight', 1);
            totalWeight += nodeWeight;
        });
        return totalWeight;
    }

    atLeastOneSegmentIsManual() {
        const nodeTypes = this.attributes.data.nodeTypes || [];
        return nodeTypes.includes('manual');
    }

    getAverageRelativeWeight() {
        let totalRelativeWeight = 0;
        let allWeightsFound = this.countNodes() >= 1;
        (this.attributes.nodes || []).forEach((nodeId) => {
            const nodeRelativeWeight = _get(
                this._collectionManager.get('nodes').getById(nodeId),
                'properties.data.relativeWeight'
            );
            if (nodeRelativeWeight) {
                totalRelativeWeight += _get(
                    this._collectionManager.get('nodes').getById(nodeId),
                    'properties.data.relativeWeight'
                );
            } else {
                allWeightsFound = false;
            }
        });
        return allWeightsFound ? totalRelativeWeight / this.countNodes() : null;
    }

    getMode() {
        const line = this.getLine();
        return line ? line.attributes.mode : this.attributes.mode;
    }

    countStops() {
        const stopIds = this.attributes.stops;

        if (stopIds) {
            return stopIds.length;
        }

        return 0;
    }

    getCoordinatesDistanceTraveledMeters() {
        const geography = this.attributes.geography;
        if (!geography || !geography.coordinates) {
            return [];
        }

        const coordinates = geography.coordinates;
        let distanceTravelSoFarMeters = 0;
        const distancesTraveledMeters: number[] = [];
        for (let i = 0, count = coordinates.length; i < count; i++) {
            const coordinate = coordinates[i];
            if (i > 0) {
                distanceTravelSoFarMeters += turfDistance(
                    turfHelpers.point(coordinates[i - 1]),
                    turfHelpers.point(coordinate),
                    { units: 'meters' }
                );
            }
            distancesTraveledMeters.push(distanceTravelSoFarMeters);
        }

        return distancesTraveledMeters;
    }

    static fromGeojson(geojsonFeature, isNew = false, collectionManager) {
        const path = new Path(geojsonFeature.properties, isNew, collectionManager);
        path.attributes.geography = geojsonFeature.geometry;
        return path;
    }

    static symbol() {
        return 'p';
    }

    delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        return new Promise((resolve, _reject) => {
            const line: any = this.getLine();
            SaveUtils.delete(this, socket, 'transitPath', this._collectionManager?.get('paths')).then(
                (response: Status.Status<{ id: string | undefined }>) => {
                    if (Status.isStatusOk(response) && Status.unwrap(response).id !== undefined) {
                        if (line) {
                            line.attributes.path_ids = line.attributes.path_ids.filter((pathId) => {
                                return pathId !== this.id;
                            });
                            // FIXME This should be one method only, to refresh the line from server
                            line.refreshPaths();
                            line.refreshStats();
                            line.refreshSchedules(socket).then(() => {
                                line.save(socket).then((_lineSaveResponse) => {
                                    resolve(response);
                                });
                            });
                        } else {
                            resolve(response);
                        }
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }

    public async save(socket: EventEmitter) {
        if (this.hasChanged() || this.isNew()) {
            this.refreshStats();
            return new Promise((resolve, _reject) => {
                const line: any = this.getLine();
                this.attributes.mode = this.getMode(); // force add mode since it could have been removed when updating
                SaveUtils.save(this, socket, 'transitPath', this._collectionManager?.get('paths')).then(
                    (response: any) => {
                        if (!response.error) {
                            if (line) {
                                if (!line.attributes.path_ids.includes(this.id)) {
                                    line.attributes.path_ids.push(this.id);
                                }
                                /*if (line.getScheduledPathIds().includes(this.id))
                            {
                              line.needToUpdateSchedules([this.id]);
                            }*/
                                // TODO Use an update callback
                                line.refreshPaths();
                                line.refreshStats();
                                line.save(socket).then((_lineSaveResponse) => {
                                    resolve(response);
                                });
                            } else {
                                resolve(response);
                            }
                        } else {
                            resolve(response);
                        }
                    }
                );
            });
        } else {
            return { id: this.id };
        }
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager?.get('nodes'));
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(this, this._collectionManager?.get('paths'));
    }

    static getPluralName() {
        return 'paths';
    }

    static getCapitalizedPluralName() {
        return 'Paths';
    }

    static getDisplayName() {
        return Path.displayName;
    }
}

export default Path;
