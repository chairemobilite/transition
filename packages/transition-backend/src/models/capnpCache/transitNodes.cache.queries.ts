/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _omit from 'lodash.omit';
import { point as turfPoint } from '@turf/turf';

import Node, { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import {
    deleteObjectCache as defaultDeleteObjectCache,
    objectToCache as defaultObjectToCache,
    objectsToCache as defaultObjectsToCache,
    objectFromCache as defaultObjectFromCache,
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import {
    boolToInt8,
    int8ToBool,
    nullToMinusOne,
    minusOneToUndefined,
    latLonCoordinateToInt,
    intCoordinateToLatLon
} from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { NodeCollection as CacheCollection } from '../capnpDataModel/nodeCollection.capnp';
import { Node as CacheObjectClass } from '../capnpDataModel/node.capnp';

const exportParser = function (object: Node, cacheObject: CacheObjectClass) {
    const attributes = object.getAttributes();

    const geography = attributes.geography;

    cacheObject.setUuid(attributes.id);
    cacheObject.setId(attributes.integer_id as number);
    cacheObject.setCode(attributes.code || '');
    cacheObject.setName(attributes.name || '');
    cacheObject.setInternalId(attributes.internal_id || '');
    cacheObject.setStationUuid(attributes.station_id || '');
    cacheObject.setColor(attributes.color || '');
    cacheObject.setLatitude(latLonCoordinateToInt(geography.coordinates[1]));
    cacheObject.setLongitude(latLonCoordinateToInt(geography.coordinates[0]));
    cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
    cacheObject.setDescription(attributes.description || '');
    cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
    cacheObject.setRoutingRadiusMeters(nullToMinusOne(attributes.routing_radius_meters));
    cacheObject.setDefaultDwellTimeSeconds(nullToMinusOne(attributes.default_dwell_time_seconds));
    cacheObject.setData(
        JSON.stringify(
            _omit(attributes.data || {}, ['transferableNodes', 'accessiblePlaces', 'accessibleResidentialEntrances'])
        )
    );

    // save transferable nodes and travel times
    const transferableNodes = attributes.data ? attributes.data.transferableNodes : null;
    let transferableNodesIds: string[] = [];
    let transferableNodesTravelTimes: number[] = [];
    let transferableNodesDistances: number[] = [];
    if (transferableNodes) {
        transferableNodesIds = transferableNodes.nodesIds || [];
        transferableNodesTravelTimes = transferableNodes.walkingTravelTimesSeconds || [];
        transferableNodesDistances = transferableNodes.walkingDistancesMeters || [];
    }
    const transferableNodesCount = transferableNodesIds.length;
    const transferableNodesCacheUuids = cacheObject.initTransferableNodesUuids(transferableNodesCount);
    const transferableNodesCacheTravelTimes = cacheObject.initTransferableNodesTravelTimes(transferableNodesCount);
    const transferableNodesCacheDistances = cacheObject.initTransferableNodesDistances(transferableNodesCount);

    for (let i = 0; i < transferableNodesCount; i++) {
        const nodeId = transferableNodesIds[i];
        const nodeTravelTimeSeconds = nullToMinusOne(transferableNodesTravelTimes[i]);
        const nodeDistance = nullToMinusOne(transferableNodesDistances[i]);
        transferableNodesCacheUuids.set(i, nodeId);
        transferableNodesCacheTravelTimes.set(i, Math.ceil(nodeTravelTimeSeconds));
        transferableNodesCacheDistances.set(i, Math.ceil(nodeDistance));
    }
};

const importParser = function (cacheObject: CacheObjectClass) {
    const geography = {
        type: 'Point' as const,
        coordinates: [
            intCoordinateToLatLon(cacheObject.getLongitude()),
            intCoordinateToLatLon(cacheObject.getLatitude())
        ]
    };

    const attributes = {
        id: cacheObject.getUuid(),
        integer_id: cacheObject.getId(),
        code: _emptyStringToNull(cacheObject.getCode()),
        name: _emptyStringToNull(cacheObject.getName()),
        internal_id: _emptyStringToNull(cacheObject.getInternalId()),
        station_id: _emptyStringToNull(cacheObject.getStationUuid()),
        color: _emptyStringToNull(cacheObject.getColor()),
        is_enabled: int8ToBool(cacheObject.getIsEnabled()),
        is_frozen: int8ToBool(cacheObject.getIsFrozen()),
        geography: geography,
        description: _emptyStringToNull(cacheObject.getDescription()),
        data: JSON.parse(cacheObject.getData()),
        routing_radius_meters: minusOneToUndefined(cacheObject.getRoutingRadiusMeters()),
        default_dwell_time_seconds: minusOneToUndefined(cacheObject.getDefaultDwellTimeSeconds())
    };

    const transferableNodesUuids = cacheObject.getTransferableNodesUuids().map((nodeUuid) => {
        return nodeUuid;
    });
    const transferableNodesTravelTimes = cacheObject.getTransferableNodesTravelTimes().map((travelTimeSeconds) => {
        return travelTimeSeconds !== -1 ? travelTimeSeconds : null;
    });
    const transferableNodesDistances = cacheObject.getTransferableNodesDistances().map((distanceMeters) => {
        return distanceMeters !== -1 ? distanceMeters : null;
    });

    attributes.data.transferableNodes = {
        nodesIds: transferableNodesUuids,
        walkingTravelTimesSeconds: transferableNodesTravelTimes,
        walkingDistancesMeters: transferableNodesDistances
    };

    return new Node(attributes, false);
};

const deleteObjectCache = function (objectId: string, cachePathDirectory?: string) {
    return defaultDeleteObjectCache({
        cacheName: 'node',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/nodes` : 'nodes',
        objectId
    });
};

const objectToCache = function (object: Node, cachePathDirectory?: string) {
    return defaultObjectToCache({
        cacheName: 'node',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/nodes` : 'nodes',
        object,
        CacheObjectClass,
        ObjectClass: Node,
        capnpParser: exportParser
    });
};

const objectsToCache = function (objects: Node[], cachePathDirectory?: string) {
    return defaultObjectsToCache(objectToCache, {
        cachePathDirectory,
        objects
    });
};

const objectFromCache = function (nodeId: string, cachePathDirectory?: string) {
    return defaultObjectFromCache({
        cacheName: 'node',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/nodes` : 'nodes',
        objectId: nodeId,
        ObjectClass: Node,
        CacheObjectClass,
        capnpParser: importParser
    });
};

const collectionToCache = function (collection: NodeCollection, cachePathDirectory?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'nodes',
        cachePathDirectory,
        pluralizedCollectionName: 'Nodes',
        maxNumberOfObjectsPerFile: 50000,
        CacheCollection,
        CollectionClass: NodeCollection,
        capnpParser: function (object: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>, cacheObject) {
            const attributes = object.properties;

            const geography = attributes.geography || object.geometry;

            cacheObject.setUuid(attributes.id);
            cacheObject.setId(attributes.integer_id);
            cacheObject.setCode(attributes.code || '');
            cacheObject.setName(attributes.name || '');
            cacheObject.setInternalId(attributes.internal_id || '');
            cacheObject.setStationUuid(attributes.station_id || '');
            cacheObject.setColor(attributes.color || '');
            cacheObject.setLatitude(latLonCoordinateToInt(geography.coordinates[1]));
            cacheObject.setLongitude(latLonCoordinateToInt(geography.coordinates[0]));
            cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setRoutingRadiusMeters(nullToMinusOne(attributes.routing_radius_meters));
            cacheObject.setDefaultDwellTimeSeconds(nullToMinusOne(attributes.default_dwell_time_seconds));
            cacheObject.setData(
                JSON.stringify(
                    _omit(attributes.data || {}, [
                        'transferableNodes',
                        'accessiblePlaces',
                        'accessibleResidentialEntrances'
                    ])
                )
            );
        }
    });
};

const collectionFromCache = function (cachePathDirectory?: string) {
    // for now we only return geojson instead of objects for geojson collection

    return defaultCollectionFromCache({
        collection: new NodeCollection([], {}, undefined),
        cacheName: 'nodes',
        cachePathDirectory,
        pluralizedCollectionName: 'Nodes',
        CollectionClass: NodeCollection,
        CacheCollection,
        capnpParser: function (cacheObject) {
            const geography = {
                type: 'Point',
                coordinates: [
                    intCoordinateToLatLon(cacheObject.getLongitude()),
                    intCoordinateToLatLon(cacheObject.getLatitude())
                ]
            };

            const data = JSON.parse(cacheObject.getData());

            const attributes = {
                id: cacheObject.getUuid(),
                integer_id: cacheObject.getId(),
                code: _emptyStringToNull(cacheObject.getCode()),
                name: _emptyStringToNull(cacheObject.getName()),
                internal_id: _emptyStringToNull(cacheObject.getInternalId()),
                station_id: _emptyStringToNull(cacheObject.getStationUuid()),
                color: _emptyStringToNull(cacheObject.getColor()),
                is_enabled: int8ToBool(cacheObject.getIsEnabled()),
                is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                geography: geography,
                description: _emptyStringToNull(cacheObject.getDescription()),
                data,
                routing_radius_meters: minusOneToUndefined(cacheObject.getRoutingRadiusMeters()),
                default_dwell_time_seconds: minusOneToUndefined(cacheObject.getDefaultDwellTimeSeconds())
            };

            return turfPoint(geography.coordinates, attributes);
        }
    });
};

export { objectToCache, objectsToCache, objectFromCache, deleteObjectCache, collectionToCache, collectionFromCache };
