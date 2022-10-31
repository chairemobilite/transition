/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericCollection from 'chaire-lib-common/lib/utils/objects/GenericCollection';
import { GenericAttributes, GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';

// TODO: Type the parsers and bodyData for each interface
export interface baseCacheParams {
    cacheName: string;
    bodyData: any;
}

export interface collectionCacheParams extends baseCacheParams {
    collection: GenericCollection<any>;
    parser?: any;
    dataSourceId?: string;
    cachePathDirectory?: string;
    cachePath?: string;
}

export interface objectCacheParams extends baseCacheParams {
    object: GenericObject<any>;
    parser?: any;
    cachePathDirectory?: string;
    cachePath?: string;
}

export interface objectFromCacheParams extends baseCacheParams {
    objectUuid: string;
    newObject: (attributes) => GenericObject<GenericAttributes>;
    parser?: any;
}

/**
 * Base class for Json2Capnp services providers
 *
 * @export
 * @class Json2CapnpBase
 */
export interface Json2CapnpBase {
    collectionToCache: (args: collectionCacheParams) => Promise<any>;
    collectionFromCache: (args: collectionCacheParams) => Promise<GenericCollection<any>>;
    objectToCache: (args: objectCacheParams) => Promise<any>;
    objectFromCache: (args: objectFromCacheParams) => Promise<GenericObject<any> | undefined>;
}
