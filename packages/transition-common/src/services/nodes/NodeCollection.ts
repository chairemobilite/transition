/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Node, NodeAttributes } from './Node';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericPlaceCollection from 'chaire-lib-common/lib/utils/objects/GenericPlaceCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

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

    async nodesInWalkingTravelTimeRadiusSecondsAround(
        geometry,
        maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
    ): Promise<{ id: string; walkingTravelTimesSeconds: number; walkingDistancesMeters: number }[]> {
        return this.pointsInWalkingTravelTimeRadiusSecondsAround(geometry, maxWalkingTravelTimeRadiusSeconds);
    }

    saveCache(socket) {
        return CollectionCacheable.saveCache(this, socket);
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
