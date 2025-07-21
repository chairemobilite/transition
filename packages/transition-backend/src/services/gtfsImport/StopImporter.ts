/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import PQueue from 'p-queue';
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import { Node, NodeAttributes, StopAttributes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { StopImportData, GtfsImportData, GtfsStop } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import { GtfsObjectPreparator } from './GtfsObjectPreparator';
import { getNodesInBirdDistanceFromPoint } from '../nodes/NodeCollectionUtils';

export class StopImporter implements GtfsObjectPreparator<StopImportData> {
    private _filePath: string;
    private _existingNodes: NodeCollection;

    constructor(options: { directoryPath: string; nodes: NodeCollection }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.stops.name
            : `${options.directoryPath}/${gtfsFiles.stops.name}`;
        this._existingNodes = options.nodes;
    }

    /**
     * Parse the data in the GTFS stops file and prepare it for import
     *
     * @return {*}  {Promise<StopImportData[]>}
     * @memberof StopImporter
     */
    async prepareImportData(): Promise<StopImportData[]> {
        const stops: StopImportData[] = [];
        await parseCsvFile(
            this._filePath,
            (data, _rowNum) => {
                const { stop_id, stop_lat, stop_lon, location_type, wheelchair_boarding, ...rest } = data;
                // Ignore if lat/lon are empty
                if (!stop_lat || !stop_lon) {
                    return;
                }
                const stop: GtfsStop = {
                    stop_id,
                    stop_lat: parseFloat(stop_lat),
                    stop_lon: parseFloat(stop_lon),
                    location_type: location_type ? (parseInt(location_type) as GtfsTypes.LocationType) : 0,
                    wheelchair_boarding: wheelchair_boarding
                        ? (parseInt(wheelchair_boarding) as GtfsTypes.WheelchairBoardingType)
                        : 0,
                    ...rest
                };
                if (data.tr_node_color) {
                    stop.tr_node_color = data.tr_node_color;
                }
                if (data.tr_routing_radius_meters) {
                    stop.tr_routing_radius_meters = parseInt(data.tr_routing_radius_meters);
                }
                if (data.tr_default_dwell_time_seconds) {
                    stop.tr_default_dwell_time_seconds = parseInt(data.tr_default_dwell_time_seconds);
                }
                if (data.tr_can_be_used_as_terminal) {
                    stop.tr_can_be_used_as_terminal = data.tr_can_be_used_as_terminal === 'true' ? true : false;
                }

                stops.push({ stop });
            },
            { header: true }
        );
        return stops;
    }

    /**
     * Import stops, aggregating them in the same nodes when they are within a
     * certain radius. Returns an object mapping the stop ID to the Node.
     *
     * @param {StopImportData[]} stops
     * @param {GtfsImportData} importData
     * @return {*}  {Promise<{ [key: string]: Node }>}
     * @memberof StopImporter
     */
    async import(stops: StopImportData[], importData: GtfsImportData): Promise<{ [key: string]: Node }> {
        const importedStops: { [key: string]: Node } = {};
        const defaultNodesColor = importData.nodes_color;

        const aggregationWalkingRadiusSeconds =
            importData.stopAggregationWalkingRadiusSeconds === undefined
                ? Preferences.get('transit.nodes.defaultStopAggregationWalkingRadiusSecondsWhenImportingFromGtfs', 60)
                : importData.stopAggregationWalkingRadiusSeconds;
        const updatedNodesById = {};

        // Split the nodes to import into already existing nodes to update and new nodes
        // FIXME Concurrency of 10 to mitigate the fact that the `nodesinWalkingTravelTimeRadiusSecondsAround` function takes a lot of time
        const nodeInRangePromiseQueue = new PQueue({ concurrency: 10 });
        const promiseProducer = async (stopData: StopImportData) => {
            // FIXME When radius is 0, KDBush sometimes does not return a node
            // even if one at the exact same location exists, so we force the
            // use of postgis in this case, we don't need osrm calculations
            // anyway. Ideally, getting nodes within radius should be done in
            // complete backend code and benefit from postgis (see
            // https://github.com/chairemobilite/transition/issues/921). We'll
            // need to refactor the current
            // nodesInWalkingTravelTimeRadiusSecondsAround methods to do so.
            const nodesInRadius =
                aggregationWalkingRadiusSeconds === 0
                    ? await getNodesInBirdDistanceFromPoint(
                        { type: 'Point' as const, coordinates: [stopData.stop.stop_lon, stopData.stop.stop_lat] },
                        0
                    )
                    : await this._existingNodes.nodesInWalkingTravelTimeRadiusSecondsAround(
                        {
                            type: 'Point',
                            coordinates: [stopData.stop.stop_lon, stopData.stop.stop_lat]
                        },
                        aggregationWalkingRadiusSeconds
                    );
            nodesInRadius.sort(
                (nodeInRadius1, nodeInRadius2) =>
                    nodeInRadius1.walkingTravelTimesSeconds - nodeInRadius2.walkingTravelTimesSeconds
            );

            if (nodesInRadius.length > 0) {
                const updatedNode = this.aggregateNode(stopData, nodesInRadius[0].id, updatedNodesById);
                updatedNodesById[updatedNode.getId()] = updatedNode;
                importedStops[stopData.stop.stop_id] = updatedNode;
            } else {
                const newNode = this.createNewNode(stopData, defaultNodesColor);
                updatedNodesById[newNode.getId()] = newNode;
                importedStops[stopData.stop.stop_id] = newNode;
            }
            return true;
        };

        const nodesInRangePromises = stops.map(async (feature) =>
            nodeInRangePromiseQueue.add(async () => promiseProducer(feature))
        );

        // Run all the promises, no matter their result.
        await Promise.allSettled(nodesInRangePromises);

        // TODO: Update the radius of nodes to make sure all of their included stops are inside the radius.

        // TODO: Batch update/create nodes when a method is readily available for it
        // Save one node at a time because of transferrable nodes calculation that have race condition if it is not the case.
        // FIXME Transferrable nodes calculation should be done only at the end of the import
        const savePromiseQueue = new PQueue({ concurrency: 1 });
        const updatePromises = Object.keys(updatedNodesById).map(async (key) =>
            savePromiseQueue.add(async () => updatedNodesById[key].save(serviceLocator.socketEventManager))
        );
        await Promise.allSettled(updatePromises);

        return importedStops;
    }

    private gtfsToNodeAttributes(gtfsObject: GtfsStop, defaultNodesColor?: string): Partial<NodeAttributes> {
        const data: any = {};
        const nodeAttributes: Partial<NodeAttributes> = {
            code: gtfsObject.stop_code || gtfsObject.stop_id,
            name: gtfsObject.stop_name || gtfsObject.stop_id,
            geography: {
                type: 'Point',
                coordinates: [gtfsObject.stop_lon, gtfsObject.stop_lat]
            },
            data
        };
        if (gtfsObject.tr_node_color) {
            nodeAttributes.color = gtfsObject.tr_node_color;
        } else if (defaultNodesColor) {
            nodeAttributes.color = defaultNodesColor;
        }
        if (gtfsObject.tr_routing_radius_meters) {
            nodeAttributes.routing_radius_meters = gtfsObject.tr_routing_radius_meters;
        }
        if (gtfsObject.tr_default_dwell_time_seconds) {
            nodeAttributes.default_dwell_time_seconds = gtfsObject.tr_default_dwell_time_seconds;
        }
        if (gtfsObject.tr_can_be_used_as_terminal === !!gtfsObject.tr_can_be_used_as_terminal) {
            data.canBeUsedAsTerminal = gtfsObject.tr_can_be_used_as_terminal;
        }

        return nodeAttributes;
    }

    private gtfsToStopAttributes(gtfsObject: GtfsStop): StopAttributes {
        const gtfs = {
            stop_id: gtfsObject.stop_id,
            stop_code: gtfsObject.stop_code,
            stop_name: gtfsObject.stop_name,
            stop_desc: gtfsObject.stop_desc,
            zone_id: gtfsObject.zone_id,
            location_type: gtfsObject.location_type,
            parent_station: gtfsObject.parent_station
        };
        // Remove undefined attributes from gtfs
        Object.keys(gtfs).forEach((key) => {
            if (gtfs[key] === undefined) {
                delete gtfs[key];
            }
        });
        const stopAttributes: StopAttributes = {
            id: gtfsObject.stop_id,
            code: gtfsObject.stop_code,
            name: gtfsObject.stop_name,
            geography: {
                type: 'Point',
                coordinates: [gtfsObject.stop_lon, gtfsObject.stop_lat]
            },
            data: { gtfs }
        };

        return stopAttributes;
    }

    createNewNode(stopData: StopImportData, defaultNodesColor?: string): Node {
        const newNode = new Node(this.gtfsToNodeAttributes(stopData.stop, defaultNodesColor), true);
        newNode.addStop(this.gtfsToStopAttributes(stopData.stop));
        this._existingNodes.add(newNode);
        this._existingNodes.updateSpatialIndex();
        return newNode;
    }

    aggregateNode(stopData: StopImportData, aggregateIn: string, updatedNodesById: { [key: string]: Node }): Node {
        let existingNode = updatedNodesById[aggregateIn];
        if (!existingNode) {
            const existingAttributes = this._existingNodes.getById(aggregateIn);
            if (!existingAttributes) {
                throw `Node not found: ${aggregateIn}`;
            }
            existingNode = this._existingNodes.newObject(existingAttributes, false);
        }
        existingNode.addStop(this.gtfsToStopAttributes(stopData.stop), { updateCentroid: existingNode.isNew() });
        if (existingNode.isNew()) {
            this._existingNodes.updateSpatialIndex();
        }
        this._existingNodes.updateById(existingNode.id, existingNode);
        return existingNode;
    }
}

export default StopImporter;
