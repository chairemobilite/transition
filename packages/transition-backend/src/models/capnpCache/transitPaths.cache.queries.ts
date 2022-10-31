/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import geobuf from 'geobuf';
import Pbf from 'pbf';
import { lineString as turfLineString } from '@turf/turf';

import { PathAttributes } from 'transition-common/lib/services/path/Path';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import {
    boolToInt8,
    int8ToBool,
    nullToMinusOne,
    minusOneToUndefined
} from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { PathCollection as CacheCollection, Path as CacheObject } from '../capnpDataModel/pathCollection.capnp';

const collectionToCache = function(collection: PathCollection, cachePathDirectory?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'paths',
        cachePathDirectory,
        pluralizedCollectionName: 'Paths',
        maxNumberOfObjectsPerFile: 20000,
        CacheCollection,
        CollectionClass: PathCollection,
        capnpParser: function(object: GeoJSON.Feature<GeoJSON.LineString, PathAttributes>, cacheObject: CacheObject) {
            const attributes = object.properties;
            const geography = attributes.geography || object.geometry;

            cacheObject.setUuid(attributes.id);
            cacheObject.setId(nullToMinusOne(attributes.integer_id));
            cacheObject.setLineUuid(attributes.line_id);
            cacheObject.setName(attributes.name || '');
            cacheObject.setDirection(attributes.direction || '');
            cacheObject.setInternalId(attributes.internal_id || '');
            cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setData(JSON.stringify(attributes.data || {}));

            const nodesCount = (attributes.nodes || []).length;
            if (nodesCount > 0) {
                const nodesCache = cacheObject.initNodesUuids(nodesCount);
                for (let j = 0; j < nodesCount; j++) {
                    nodesCache.set(j, attributes.nodes[j]);
                }
            }

            const stops = attributes.stops || [];
            const stopsCount = (attributes.stops || []).length;
            if (stopsCount > 0) {
                const stopsCache = cacheObject.initStopsUuids(stopsCount);
                for (let j = 0; j < stopsCount; j++) {
                    stopsCache.set(j, stops[j]);
                }
            }

            //cacheObject.setGeography(JSON.stringify(geography || {}));
            if (geography && geography.coordinates) {
                const geobufData = geobuf.encode(turfLineString(geography.coordinates), new Pbf());
                const geoData = cacheObject.initGeography(geobufData.length);
                geoData.copyBuffer(Buffer.from(geobufData));
                cacheObject.setGeography(geoData);
            }
            //cacheObject.setGeography(JSON.stringify(geography || {}));
            //}

            const segmentsCount = (attributes.segments || []).length;
            if (segmentsCount > 0) {
                const segmentsCache = cacheObject.initSegments(segmentsCount);
                for (let j = 0; j < segmentsCount; j++) {
                    segmentsCache.set(j, attributes.segments[j]);
                }
            }
        }
    });
};

const collectionFromCache = function(cachePathDirectory?: string) {
    return defaultCollectionFromCache({
        collection: new PathCollection([], {}),
        cacheName: 'paths',
        cachePathDirectory,
        pluralizedCollectionName: 'Paths',
        CollectionClass: PathCollection,
        CacheCollection,
        capnpParser: function(cacheObject: CacheObject) {
            const geography = cacheObject.getGeography();
            let geojsonGeometry = null;
            if (geography) {
                geojsonGeometry = geobuf.decode(new Pbf(geography.toArrayBuffer())).geometry;
            }

            return {
                type: 'Feature' as const,
                id: minusOneToUndefined(cacheObject.getId()) || 1,
                geometry: geojsonGeometry,
                properties: {
                    id: cacheObject.getUuid(),
                    integer_id: minusOneToUndefined(cacheObject.getId()),
                    line_id: cacheObject.getLineUuid(),
                    name: _emptyStringToNull(cacheObject.getName()),
                    direction: _emptyStringToNull(cacheObject.getDirection()),
                    internal_id: _emptyStringToNull(cacheObject.getInternalId()),
                    is_enabled: int8ToBool(cacheObject.getIsEnabled()),
                    is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                    description: _emptyStringToNull(cacheObject.getDescription()),
                    data: JSON.parse(cacheObject.getData()),
                    nodes: cacheObject.getNodesUuids().map((nodeUuid) => {
                        return nodeUuid;
                    }),
                    stops: cacheObject.getStopsUuids().map((stopUuid) => {
                        return stopUuid;
                    }),
                    segments: cacheObject.getSegments().map((segmentStartIndex) => {
                        return segmentStartIndex;
                    }),
                    geography: geojsonGeometry
                }
            };
        }
    });
};

export { collectionToCache, collectionFromCache };
