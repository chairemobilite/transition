/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { Json2CapnpBase, collectionCacheParams, objectCacheParams, objectFromCacheParams } from './Json2CapnpBase';
import json2CapnpService from '../../utils/json2capnp/Json2CapnpService';

/**
 * Json2Capnp service provider which saves/loads capnp data from an external
 * server, for example the json2capnp Rust server.
 *
 * @class Json2CapnpRust
 * @implements {Json2CapnpBase}
 */
class Json2CapnpRust implements Json2CapnpBase {
    async collectionToCache(args: collectionCacheParams) {
        if (typeof (args.collection as any).toGeojson === 'function') {
            args.bodyData[args.cacheName] = (args.collection as any).toGeojson(args.parser);
        } else if (typeof (args.collection as any).forJson === 'function') {
            args.bodyData[args.cacheName] = (args.collection as any).forJson(args.parser);
        } else {
            console.error(`error saving ${args.cacheName} collection cache (cannot convert to geojson or json)`);
            throw new TrError(
                `Cannot save ${args.cacheName} collection (cannot convert to geojson or json)`,
                'CAQCTC0003',
                'CannotSaveCacheBecauseError'
            );
        }

        if (args.dataSourceId) {
            args.bodyData.data_source_uuid = args.dataSourceId;
        }

        return await json2CapnpService.writeCache(args.cacheName, args.bodyData, args.cachePathDirectory);
    }

    async collectionFromCache(args: collectionCacheParams) {
        const collectionName = args.cacheName;
        const response = await json2CapnpService.readCache(args.cacheName, args.bodyData);

        if (response.data && response.data[collectionName]) {
            if (response.data[collectionName].type === 'FeatureCollection') {
                // geojson collection
                args.collection.setFeatures(response.data[collectionName].features);
            } else {
                if (typeof args.parser === 'function') {
                    const features = response.data[collectionName].map((attributes) => args.parser(attributes));
                    args.collection.setFeatures(features);
                } else {
                    args.collection.setFeatures(response.data[collectionName]);
                }
            }
            return args.collection;
        } else {
            console.error(`error loading ${collectionName} collection cache using json2capnp`);
            throw new TrError(`Cannot load ${collectionName} collection`, 'CAQCFC0001', 'CannotLoadCacheBecauseError');
        }
    }

    async objectToCache(args: objectCacheParams) {
        let attributes = typeof args.parser === 'function' ? args.parser(args.object) : args.object;
        if (attributes.attributes) {
            attributes = attributes.attributes;
        }

        args.bodyData[args.cacheName] = attributes;

        return await json2CapnpService.writeCache(args.cacheName, args.bodyData);
    }

    async objectFromCache(args: objectFromCacheParams) {
        args.bodyData.uuid = args.objectUuid;

        const response = await json2CapnpService.readCache(args.cacheName, args.bodyData);
        if (response && response.data && response.data[args.cacheName]) {
            const attributes =
                typeof args.parser === 'function'
                    ? args.parser(response.data[args.cacheName])
                    : response.data[args.cacheName];
            const object = args.newObject(attributes);
            return object;
        } else {
            console.error(
                `error loading ${args.cacheName} object cache using json2capnp with data: ${JSON.stringify(
                    args.bodyData
                )}`
            );
            return undefined;
        }
    }
}

const instance = new Json2CapnpRust();
export default instance;
