/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import pQueue from 'p-queue';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import GenericCollection from 'chaire-lib-common/lib/utils/objects/GenericCollection';
import { GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';

/** Decides if we use a passed cache path directory or use the default one */
const getCacheDirectory = (cachePathDirectoryOverride?: string): string => {
    if (cachePathDirectoryOverride) {
        return cachePathDirectoryOverride;
    } else {
        return fileManager.directoryManager.transitCacheDirectory;
    }
};

// TODO Function is not used any where
const emptyCacheDirectory = async (cachePathDirectoryOverride?: string): Promise<void> => {
    fileManager.directoryManager.emptyDirectoryAbsolute(getCacheDirectory(cachePathDirectoryOverride));
};

// TODO Function is not used any where
const deleteCacheDirectory = async (cachePathDirectoryOverride?: string): Promise<void> => {
    fileManager.directoryManager.deleteDirectoryAbsolute(getCacheDirectory(cachePathDirectoryOverride));
};

// TODO: Remove unnecessary parameters when javascript writer is extracted
export interface CollectionCacheParams {
    cacheName: string;
    /** Full path to a cache directory. Override the default one */
    cachePathDirectoryOverride?: string;
    CollectionClass: any; //TODO Add type and move to read side maybe?
}

export interface CollectionToCacheParams extends CollectionCacheParams {
    collection: GenericCollection<any>;
    /** Rust function to write a collection to cache */
    cacheWriteFunction: (cacheFilePath: string, jsonStr: string) => Promise<void>;
}

export interface CollectionFromCacheParams extends CollectionCacheParams {
    // TODO Find type for the parser (or get rid of it)
    parser?: any;
    /** Rust function to read  a collection from cache */
    cacheReadFunction: (cacheFilePath: string) => Promise<string>;
}

// TODO: Type the promise
const collectionToCache = async (params: CollectionToCacheParams): Promise<any> => {
    let collection: GenericCollection<any> | undefined = params.collection;
    const collectionName = params.cacheName;
    const CollectionClass = params.CollectionClass;
    const bodyData: { [key: string]: any } = {};

    // TODO: Callers should send the right type, the first 'if' can totally change the collection type! But make sure all callers are fixed first
    if (!(collection instanceof CollectionClass)) {
        if (typeof collection.getFeatures === 'function') {
            collection = new CollectionClass(collection.getFeatures());
        } else if (collection.features) {
            collection = new CollectionClass(collection.features);
        } else if (Array.isArray(collection)) {
            collection = new CollectionClass(collection);
        } else {
            collection = undefined;
        }
    }

    if (!collection) {
        console.error(`error saving ${collectionName} collection cache`);
        throw new TrError(`Cannot save ${collectionName} collection`, 'CAQCTC0002', 'CannotSaveCacheBecauseError');
    }

    // TODO Consolidate around a single function defined in the collections which would make the right choice there
    if (typeof (collection as any).toGeojson === 'function') {
        bodyData[collectionName] = (collection as any).toGeojson();
    } else if (typeof (collection as any).forJson === 'function') {
        bodyData[collectionName] = (collection as any).forJson();
    } else {
        console.error(`error saving ${collectionName} collection cache (cannot convert to geojson or json)`);
        throw new TrError(
            `Cannot save ${collectionName} collection (cannot convert to geojson or json)`,
            'CAQCTC0003',
            'CannotSaveCacheBecauseError'
        );
    }

    // Make sure the cache directory exist
    // TODO Should this be done in the rust side of things?
    fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(
        getCacheDirectory(params.cachePathDirectoryOverride)
    );

    return await params.cacheWriteFunction(
        getCacheDirectory(params.cachePathDirectoryOverride) + '/' + collectionName + '.capnpbin',
        JSON.stringify(bodyData)
    );
};

const collectionFromCache = async (params: CollectionFromCacheParams): Promise<GenericCollection<any>> => {
    const CollectionClass = params.CollectionClass;
    const collection = CollectionClass ? new CollectionClass([]) : undefined;
    const collectionName = params.cacheName;

    if (!collection) {
        console.error(`This code path supposes the collection exists, it doesn't for ${collectionName}`);
        throw new TrError(
            `Cannot load collection ${collectionName} because there is no collection)`,
            'CAQCFC0002',
            'CollectionCannotLoadCacheBecauseError'
        );
    }

    const data = JSON.parse(
        await params.cacheReadFunction(
            getCacheDirectory(params.cachePathDirectoryOverride) + '/' + collectionName + '.capnpbin'
        )
    );

    if (data[collectionName].type === 'FeatureCollection') {
        // geojson collection
        collection.setFeatures(data[collectionName].features);
    } else {
        if (typeof params.parser === 'function') {
            const features = data[collectionName].map((attributes) => params.parser(attributes));
            collection.setFeatures(features);
        } else {
            collection.setFeatures(data[collectionName]);
        }
    }
    return collection;
};

// TODO: Remove unnecessary parameters when javascript writer is extracted
export interface ObjectCacheParams {
    cacheName: string;
    cachePathDirectoryOverride?: string | undefined;
}

export interface ObjectToCacheParams extends ObjectCacheParams {
    object: GenericObject<any>;
    /** Rust function to write an object to cache */
    cacheWriteFunction: (cacheDirectoryPath: string, jsonStr: string) => Promise<void>;
}

const objectToCache = async (params: ObjectToCacheParams) => {
    const bodyData: { [key: string]: any } = {};

    let attributes = params.object;
    // TODO This feels weird, we need a stronger typing on the input object maybe??
    if (attributes.attributes) {
        attributes = attributes.attributes;
    }

    // TODO Refactor functions chain so that we can just send the attributes object
    bodyData[params.cacheName] = attributes;

    // We write the object file in a sub directory of the main cache path.
    // The directory name is the base object type name with an added 's'
    const cacheFileSubDirectory = getCacheDirectory(params.cachePathDirectoryOverride) + '/' + params.cacheName + 's';
    // TODO Figure out a better way to handle creating the subdirectories instead of doing it for each files
    fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(cacheFileSubDirectory);
    return await params.cacheWriteFunction(cacheFileSubDirectory, JSON.stringify(bodyData));
};

const objectsToCache = async <T extends GenericObject<any>>(
    customObjectToCache: (object: T, cachePathDirectoryOverride?: string) => Promise<void>,
    params: { objects: T[]; cachePathDirectoryOverride?: string }
) => {
    const objects = params.objects;
    const countObjects = objects.length;

    const promiseQueue = new pQueue({ concurrency: 10 });
    const fileReaderPromises: Promise<void>[] = [];
    for (let objectIndex = 0; objectIndex < countObjects; objectIndex++) {
        const object = objects[objectIndex];
        fileReaderPromises.push(
            promiseQueue.add(async () => customObjectToCache(object, params.cachePathDirectoryOverride))
        );
    }

    try {
        await Promise.all(fileReaderPromises);
        return countObjects;
    } catch (error) {
        console.error('Error saving objects to cache: ', error);
        throw new TrError(
            `Cannot save objects to cache files (capnp error: ${error})`,
            'CAQCSOC0002',
            'ObjectsCannotSaveCacheBecauseError'
        );
    }
};

interface ObjectFromCacheParams extends ObjectCacheParams {
    /** UUID of the object to fetch */
    objectId: string;
    ObjectClass: any; // TODO GenericObject I guess ??
    /** Rust function to write an object to cache */
    cacheReadFunction: (objectId: string, cacheFileDirectory: string) => Promise<string>;
}

const objectFromCache = async (params: ObjectFromCacheParams) => {
    const rustResult = JSON.parse(
        await params.cacheReadFunction(
            params.objectId,
            getCacheDirectory(params.cachePathDirectoryOverride) + '/' + params.cacheName + 's'
        )
    );

    // TODO Refactor functions chain so that we get directly the data instead of having it in a params.cacheName key
    const object = new params.ObjectClass(rustResult[params.cacheName], false);
    return object;
};

const deleteObjectCache = async (params: {
    cacheName: string;
    cachePathDirectoryOverride?: string;
    objectId: string;
}): Promise<void> => {
    const objectId = params.objectId;

    const filename =
        getCacheDirectory(params.cachePathDirectoryOverride) +
        '/' +
        params.cacheName +
        's/' +
        params.cacheName +
        '_' +
        objectId +
        '.capnpbin';

    fileManager.deleteFileAbsolute(filename);
};

const deleteObjectsCache = async (params: {
    cacheName: string;
    cachePathDirectoryOverride?: string;
    objectIds: string[];
}): Promise<void> => {
    const objectIds = params.objectIds;

    // TODO Switch to a promise queue, as for objectsToCache, maybe use a map
    for (let i = 0, countI = objectIds.length; i < countI; i++) {
        const objectId = objectIds[i];
        await deleteObjectCache({
            cacheName: params.cacheName,
            cachePathDirectoryOverride: params.cachePathDirectoryOverride,
            objectId
        });
    }
};

export {
    collectionToCache,
    collectionFromCache,
    objectToCache,
    objectsToCache,
    objectFromCache,
    deleteObjectCache,
    deleteObjectsCache,
    emptyCacheDirectory,
    deleteCacheDirectory
};
