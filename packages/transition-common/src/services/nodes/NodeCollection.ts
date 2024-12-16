/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import snakeCase from 'lodash/snakeCase';
import camelCase from 'lodash/camelCase';

import { Node, NodeAttributes } from './Node';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericPlaceCollection from 'chaire-lib-common/lib/utils/objects/GenericPlaceCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

/**
 * A collection of transit nodes
 */
export class NodeCollection extends GenericPlaceCollection<NodeAttributes, Node> implements Progressable {
    protected static displayName = 'NodeCollection';
    protected static socketPrefix = 'transitNodes';
    protected static instanceClass = Node;

    private _eventManager: EventManager | undefined;

    constructor(features: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>[], attributes, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${NodeCollection.displayName}${progressEventName}`, completeRatio);
    }

    newObject(feature: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>, isNew = false, collectionManager?): Node {
        return new Node(
            Object.assign({}, feature.properties, { geography: feature.geometry }),
            isNew,
            collectionManager
        );
    }

    forCsv() {
        return this.features.map((node) => {
            const geographyCoordinates = node.geometry.coordinates;
            return {
                uuid: node.properties.id,
                integer_id: node.properties.integer_id,
                code: node.properties.code,
                name: node.properties.name,
                latitude: geographyCoordinates[1] || null,
                longitude: geographyCoordinates[0] || null,
                station_uuid: node.properties.station_id,
                internal_id: node.properties.internal_id,
                color: node.properties.color,
                routing_radius_meters: node.properties.routing_radius_meters,
                default_dwell_time_seconds: node.properties.default_dwell_time_seconds
            };
        });
    }

    updateOdTripsWeights(socket, dataSourceId): Promise<void> {
        return new Promise((resolve, _reject) => {
            socket.emit('nodes.calculateOdTripsWeights', dataSourceId, () => {
                resolve();
            });
        });
    }

    updateOdTripsAccessibleNodes(socket, dataSourceId): Promise<void> {
        return new Promise((resolve, _reject) => {
            socket.emit('odTrips.updateAccessibleNodes', dataSourceId, () => {
                resolve();
            });
        });
    }

    nodesInBirdRadiusMetersAround(geometry, birdRadiusMeters = 1000) {
        return this.pointsInBirdRadiusMetersAround(geometry, birdRadiusMeters);
    }

    setNetworkTravelTimesForBirdDistanceAccessibleNodes(object, geojson, prefix, mode: RoutingMode = 'walking') {
        // geojson: origin or destination geojson
        return new Promise((resolve, _reject) => {
            if (_isBlank(geojson) && typeof object.toGeojson === 'function') {
                geojson = object.toGeojson();
            }

            if (_isBlank(geojson)) {
                console.log(`no geojson provided for object ${object.get('id')}`);
                resolve(0);
            }

            if (this.size() === 0) {
                console.log('no node in nodeCollection');
                resolve(0);
            }

            const maxAccessEgressBirdDistanceMeters =
                Preferences.get('transit.nodes.defaultWalkingSpeedMps') *
                Preferences.get('transit.nodes.maxAccessEgressWalkingTravelTimeSeconds');
            const birdDistanceAccessibleNodes = this.nodesInBirdRadiusMetersAround(
                geojson.geometry ? geojson.geometry : geojson, // TODO: fix the callers everywhere to be able to accept only a point.
                maxAccessEgressBirdDistanceMeters
            );
            const nodesPrefix = `${!_isBlank(prefix) ? camelCase(prefix) + 'Nodes' : 'nodes'}`;
            const attributePrefix = !_isBlank(prefix) ? snakeCase(prefix) + '_' : '';
            const routingService = routingServiceManager.getRoutingServiceForEngine('engine');

            if (birdDistanceAccessibleNodes.length === 0) {
                console.log(`no accessible node for object ${object.get('id')}`);
                resolve(0);
            }

            if (birdDistanceAccessibleNodes.length > 0) {
                routingService
                    .tableTo({ mode, origins: birdDistanceAccessibleNodes, destination: geojson })
                    .then((jsonResult) => {
                        const travelTimesSeconds = jsonResult.durations;
                        const distancesMeters = jsonResult.distances;
                        let accessibleNodesCount = 0;
                        object.attributes.data[`${nodesPrefix}`] = [];
                        object.attributes.data[`${nodesPrefix}TravelTimes`] = [];
                        object.attributes.data[`${nodesPrefix}Distances`] = [];
                        object.attributes[`walking_20min_${attributePrefix}accessible_nodes_count`] = 0;
                        object.attributes[`walking_15min_${attributePrefix}accessible_nodes_count`] = 0;
                        object.attributes[`walking_10min_${attributePrefix}accessible_nodes_count`] = 0;
                        object.attributes[`walking_5min_${attributePrefix}accessible_nodes_count`] = 0;

                        for (let i = 0, count = birdDistanceAccessibleNodes.length; i < count; i++) {
                            if (isNaN(Number(travelTimesSeconds[i])) || isNaN(Number(distancesMeters[i]))) {
                                console.log(
                                    `ERROR: OSRM mode ${mode}: duration or distance is NaN for object ${object.get(
                                        'id'
                                    )}`
                                );
                            } else if (
                                travelTimesSeconds[i] <=
                                Preferences.current.transit.nodes.maxAccessEgressWalkingTravelTimeSeconds
                            ) {
                                const node = birdDistanceAccessibleNodes[i];
                                object.attributes.data[`${nodesPrefix}`].push(node.properties.id);
                                object.attributes.data[`${nodesPrefix}TravelTimes`].push(
                                    Math.ceil(travelTimesSeconds[i])
                                );
                                object.attributes.data[`${nodesPrefix}Distances`].push(Math.ceil(distancesMeters[i]));
                                if (travelTimesSeconds[i] <= 1200) {
                                    object.attributes[`walking_20min_${attributePrefix}accessible_nodes_count`]++;
                                }
                                if (travelTimesSeconds[i] <= 900) {
                                    object.attributes[`walking_15min_${attributePrefix}accessible_nodes_count`]++;
                                }
                                if (travelTimesSeconds[i] <= 600) {
                                    object.attributes[`walking_10min_${attributePrefix}accessible_nodes_count`]++;
                                }
                                if (travelTimesSeconds[i] <= 300) {
                                    object.attributes[`walking_5min_${attributePrefix}accessible_nodes_count`]++;
                                }
                            }
                            accessibleNodesCount++;
                        }
                        resolve(accessibleNodesCount);
                    });
            } else {
                resolve(0);
            }
        });
    }

    async nodesInWalkingTravelTimeRadiusSecondsAround(
        geometry,
        maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
    ): Promise<{ id: string; walkingTravelTimesSeconds: number; walkingDistancesMeters: number }[]> {
        return this.pointsInWalkingTravelTimeRadiusSecondsAround(geometry, maxWalkingTravelTimeRadiusSeconds);
    }

    saveCache(socket, customCollection) {
        return CollectionCacheable.saveCache(this, socket, customCollection);
    }

    loadCache(socket) {
        return CollectionCacheable.loadCache(this, socket);
    }

    loadFromServer(socket) {
        return CollectionLoadable.loadGeojsonFromServer(this, socket);
    }

    loadFromCollection(collection) {
        return CollectionLoadable.loadGeojsonFromCollection(this, collection);
    }
}

export default NodeCollection;
