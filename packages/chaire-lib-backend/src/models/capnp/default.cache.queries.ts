/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import pQueue from 'p-queue';
import * as capnp from 'capnp-ts';

import config from '../../config/server.config';
import { fileManager } from '../../utils/filesystem/fileManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { writePackedMessageToStream, readToEndOfStream } from '../../services/json2capnp/capnpMessagesManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import json2CapnpRust from '../../services/json2capnp/Json2CapnpRust';
import GenericCollection from 'chaire-lib-common/lib/utils/objects/GenericCollection';
import { GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';

const prefix = process.env.NODE_ENV === 'test' ? 'test_' : '';

fileManager.directoryManager.createDirectoryIfNotExists(`${prefix}cache`);
fileManager.directoryManager.createDirectoryIfNotExists(`${prefix}cache/${config.projectShortname}`);

const emptyCacheDirectory = async (pathDirectory: string) => {
    const cacheDirectoryPath = `${prefix}cache/${config.projectShortname}/${pathDirectory}`;
    fileManager.directoryManager.emptyDirectory(cacheDirectoryPath);
    return pathDirectory;
};

const deleteCacheDirectory = async (pathDirectory: string) => {
    const cacheDirectoryPath = `${prefix}cache/${config.projectShortname}/${pathDirectory}`;
    fileManager.directoryManager.deleteDirectory(cacheDirectoryPath);
    return pathDirectory;
};

// TODO Are saveToFile and getFromFile really useful or can they be replaced by object[To/From]Cache?
const saveToFile = (
    params: { fileName?: string; data?: { [key: string]: any }; cachePathDirectory?: string } = {}
): string | undefined => {
    const cachePathDirectory =
        `${prefix}cache/${config.projectShortname}` +
        (params.cachePathDirectory ? '/' + params.cachePathDirectory : '');
    const fileName = params.fileName;
    const data = params.data;
    if (fileName && data) {
        fileManager.directoryManager.createDirectoryIfNotExists(cachePathDirectory);
        fileManager.writeFile(cachePathDirectory + '/' + fileName, data);
        return cachePathDirectory + '/' + fileName;
    } else {
        console.log('missing path directory, filename or data');
        return undefined;
    }
};

// TODO: Consider returning the json object instead of the string here
const getFromFile = (params: { path: string }): string | undefined => {
    const filePath = `${prefix}cache/${config.projectShortname}/${params.path}`;
    if (fileManager.fileExists(filePath)) {
        const data = fileManager.readFile(filePath);
        return data ? data : undefined;
    } else {
        console.log('could not find cache file');
        return undefined;
    }
};

// TODO: Remove unnecessary parameters when javascript writer is extracted
export interface CollectionCacheParams {
    cacheName: string;
    collection: GenericCollection<any>;
    cachePathDirectory?: string;
    parser?: any;
    dataSourceId?: string;
    pluralizedCollectionName: string;
    cachePath?: string;
    CacheCollection: any;
    CollectionClass: any;
    capnpParser: any;
    maxNumberOfObjectsPerFile?: number;
    emptyDirectory?: boolean;
}

// TODO: Type the promise
const collectionToCache = async (params: CollectionCacheParams): Promise<any> => {
    let collection: GenericCollection<any> | undefined = params.collection;
    const collectionName = params.cacheName;
    const cachePathDirectory = params.cachePathDirectory;
    const pluralizedCollectionName = params.pluralizedCollectionName;
    const CacheCollection = params.CacheCollection;
    const CollectionClass = params.CollectionClass;
    const parser = params.parser; // TODO or CHANGE BEHAVIOUR: not used with json2capnp
    const capnpParser = params.capnpParser;
    const maxNumberOfObjectsPerFile = params.maxNumberOfObjectsPerFile || 50000; // TODO or CHANGE BEHAVIOUR: not yet implement with json2capnp
    const cachePath = `${prefix}cache/${config.projectShortname}/${
        cachePathDirectory ? cachePathDirectory + '/' : ''
    }${collectionName}.capnpbin`;
    const absoluteCacheFilePath = fileManager.getAbsolutePath(cachePath);
    const bodyData: { [key: string]: any } = {};

    if (cachePathDirectory) {
        fileManager.directoryManager.createDirectoryIfNotExists(
            `${prefix}cache/${config.projectShortname}/${cachePathDirectory}`
        );
        bodyData.cache_directory_path = cachePathDirectory;
    }
    if (params.emptyDirectory) {
        fileManager.directoryManager.emptyDirectory(`${prefix}cache/${config.projectShortname}/${cachePathDirectory}`);
    }

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

    if (Preferences.get('json2Capnp.enabled', false)) {
        return await json2CapnpRust.collectionToCache({
            collection,
            cacheName: collectionName,
            bodyData,
            parser,
            dataSourceId: params.dataSourceId,
            cachePathDirectory,
            cachePath
        });
    } else {
        const features =
            typeof collection.getFeatures === 'function'
                ? collection.getFeatures()
                : collection.features
                    ? collection.features
                    : collection;
        const featuresCount = features.length;

        const countFiles = Math.ceil(featuresCount / maxNumberOfObjectsPerFile);

        if (countFiles > 1) {
            fileManager.writeFile(`${cachePath}.count`, `${countFiles}`);
        }

        const promiseProducer = async (fileIndex: number): Promise<number> =>
            new Promise((resolveWriteStream) => {
                const startFeatureIndex = fileIndex * maxNumberOfObjectsPerFile;
                const endFeatureIndex =
                    (fileIndex + 1) * maxNumberOfObjectsPerFile >= featuresCount
                        ? featuresCount - 1
                        : (fileIndex + 1) * maxNumberOfObjectsPerFile - 1;
                const fileFeaturesCount = endFeatureIndex + 1 - startFeatureIndex;
                const writeStream =
                    countFiles === 1
                        ? fs.createWriteStream(`${absoluteCacheFilePath}`)
                        : fs.createWriteStream(`${absoluteCacheFilePath}.${fileIndex}`);
                const message = new capnp.Message();
                const cacheCollectionMessage = message.initRoot(CacheCollection);
                const cacheCollection = cacheCollectionMessage[`init${pluralizedCollectionName}`](fileFeaturesCount);

                const objects: any[] = [];
                const indexes: number[] = [];
                for (let i = startFeatureIndex; i <= endFeatureIndex; i++) {
                    objects.push(features[i]);
                    indexes.push(i - startFeatureIndex);
                }
                writeStream.on('finish', () => {
                    resolveWriteStream(fileIndex);
                });

                const objectSetPromises = objects.map(async (object, objectI) => {
                    const cacheObject = cacheCollection.get(indexes[objectI]);
                    capnpParser(object, cacheObject);
                });
                try {
                    Promise.all(objectSetPromises).then(() => {
                        writePackedMessageToStream(writeStream, message);
                        writeStream.end();
                    });
                } catch (error) {
                    console.error('Error saving to cache', error);
                }
            });

        const promiseQueue = new pQueue({ concurrency: 10 });
        const fileWriterPromises: Promise<number>[] = [];
        for (let fileI = 0; fileI < countFiles; fileI++) {
            fileWriterPromises.push(promiseQueue.add(async () => promiseProducer(fileI)));
        }

        try {
            await Promise.all(fileWriterPromises);
            return cachePath;
        } catch (error) {
            console.error('error saving collection cache', error);
            throw new TrError(
                `Cannot save collection ${collectionName} to cache file ${cachePath} (capnp error: ${error})`,
                'CAQCTC0004',
                'CollectionCannotSaveCacheBecauseError'
            );
        }
    }
};

const collectionFromCache = async (params: CollectionCacheParams): Promise<any> => {
    const CollectionClass = params.CollectionClass;
    const collection = CollectionClass ? new CollectionClass([]) : undefined;
    const collectionName = params.cacheName;
    const cachePathDirectory = params.cachePathDirectory;
    const pluralizedCollectionName = params.pluralizedCollectionName;
    const CacheCollection = params.CacheCollection;
    const capnpParser = params.capnpParser;
    const parser = params.parser;
    const cachePath = `${prefix}cache/${config.projectShortname}/${
        cachePathDirectory ? cachePathDirectory + '/' : ''
    }${collectionName}.capnpbin`;
    const absoluteCacheFilePath = fileManager.getAbsolutePath(cachePath);
    const bodyData: { [key: string]: any } = {};

    if (cachePathDirectory) {
        bodyData.cache_directory_path = cachePathDirectory;
    }
    if (params.dataSourceId) {
        bodyData.data_source_uuid = params.dataSourceId;
    }

    if (Preferences.get('json2Capnp.enabled', false)) {
        if (!collection) {
            console.error(`This code path supposes the collection exists, it doesn't for ${collectionName}`);
            throw new TrError(
                `Cannot load collection ${collectionName} from json2capnp rust server because there is no collection)`,
                'CAQCFC0002',
                'CollectionCannotLoadCacheBecauseError'
            );
        }

        return await json2CapnpRust.collectionFromCache({
            collection,
            cacheName: collectionName,
            bodyData,
            parser,
            cachePathDirectory,
            cachePath
        });
    } else {
        const countFiles = fileManager.fileExists(`${cachePath}.count`)
            ? parseInt(fileManager.readFile(`${cachePath}.count`) || '1')
            : 1;

        if (countFiles === 1 && !fileManager.fileExists(cachePath)) {
            const collection = CollectionClass ? new CollectionClass([]) : [];
            return collection;
        }

        const featuresByFileIndex: any[][] = [];
        const promiseProducer = async (fileIndex: number): Promise<number> =>
            new Promise((resolveReadStream) => {
                featuresByFileIndex[fileIndex] = [];
                const readStream =
                    countFiles === 1
                        ? fs.createReadStream(`${absoluteCacheFilePath}`)
                        : fs.createReadStream(`${absoluteCacheFilePath}.${fileIndex}`);

                readToEndOfStream(readStream).then((data: any) => {
                    const features: any[] = [];
                    const message = new capnp.Message(data);
                    const cacheCollectionMessage = message.getRoot(CacheCollection);
                    const cacheCollection = cacheCollectionMessage[`get${pluralizedCollectionName}`]();
                    cacheCollection.forEach((cacheObject) => {
                        features.push(capnpParser(cacheObject));
                    });
                    featuresByFileIndex[fileIndex] = features;
                    resolveReadStream(fileIndex);
                });
            });

        const promiseQueue = new pQueue({ concurrency: 10 });
        const fileReaderPromises: Promise<number>[] = [];
        for (let fileI = 0; fileI < countFiles; fileI++) {
            fileReaderPromises.push(promiseQueue.add(async () => promiseProducer(fileI)));
        }

        try {
            await Promise.all(fileReaderPromises);
            const allFeatures: any = [];

            featuresByFileIndex.forEach((features) => {
                for (let i = 0, count = features.length; i < count; i++) {
                    allFeatures.push(features[i]);
                }
            });

            if (collection) {
                collection.setFeatures(allFeatures);
            }
            return collection ? collection : allFeatures;
        } catch (error) {
            console.error('error loading collection cache', error);
            throw new TrError(
                `Cannot load collection ${collectionName} from cache file ${cachePath} (capnp error: ${error})`,
                'CAQCFC0002',
                'CollectionCannotLoadCacheBecauseError'
            );
        }
    }
};

// TODO: Remove unnecessary parameters when javascript writer is extracted
export interface ObjectCacheParams {
    cacheName: string;
    cachePathDirectory: string;
    parser?: any;
    dataSourceId?: string;
    cachePath?: string;
    CacheObjectClass: any;
    ObjectClass: any;
    capnpParser: any;
}

export interface ObjectToCacheParams extends ObjectCacheParams {
    object: GenericObject<any>;
}

const objectToCache = async (params: ObjectToCacheParams) => {
    const objectName = params.cacheName;
    const cachePathDirectory = params.cachePathDirectory;
    const CacheObjectClass = params.CacheObjectClass;
    const object = params.object;
    const capnpParser = params.capnpParser;
    const parser = params.parser;
    const objectId = object.attributes ? object.attributes.id : object.id;
    const cachePath = `${prefix}cache/${config.projectShortname}/${
        cachePathDirectory ? cachePathDirectory + '/' : ''
    }${objectName}_${objectId}.capnpbin`;
    const absoluteCacheFilePath = fileManager.getAbsolutePath(cachePath);
    const bodyData: { [key: string]: any } = {};

    if (cachePathDirectory) {
        fileManager.directoryManager.createDirectoryIfNotExists(
            `${prefix}cache/${config.projectShortname}/${cachePathDirectory}`
        );
        bodyData.cache_directory_path = cachePathDirectory;
    }
    if (params.dataSourceId) {
        bodyData.data_source_uuid = params.dataSourceId;
    }

    if (Preferences.get('json2Capnp.enabled', false)) {
        return await json2CapnpRust.objectToCache({
            object,
            cacheName: objectName,
            bodyData,
            parser
        });
    } else {
        return new Promise((resolve) => {
            const writeStream = fs.createWriteStream(absoluteCacheFilePath);
            const message = new capnp.Message();
            const cacheObject = message.initRoot(CacheObjectClass);

            capnpParser(object, cacheObject);

            writePackedMessageToStream(writeStream, message);
            writeStream.end();
            writeStream.on('finish', () => {
                resolve(cachePath);
            });
        });
    }
};

const objectsToCache = async (customObjectToCache, params: { objects: any[]; cachePathDirectory?: string }) => {
    const objects = params.objects;
    const countObjects = objects.length;

    const promiseQueue = new pQueue({ concurrency: 10 });
    const fileReaderPromises: Promise<number>[] = [];
    for (let objectIndex = 0; objectIndex < countObjects; objectIndex++) {
        const object = objects[objectIndex];
        fileReaderPromises.push(promiseQueue.add(async () => customObjectToCache(object, params.cachePathDirectory)));
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
    objectId: string;
}

const objectFromCache = async (params: ObjectFromCacheParams) => {
    const objectName = params.cacheName;
    const cachePathDirectory = params.cachePathDirectory;
    const CacheObjectClass = params.CacheObjectClass;
    const ObjectClass = params.ObjectClass;
    const parser = params.parser;
    const objectId = params.objectId;
    const capnpParser = params.capnpParser;
    const cachePath = `${prefix}cache/${config.projectShortname}/${
        cachePathDirectory ? cachePathDirectory + '/' : ''
    }${objectName}_${objectId}.capnpbin`;
    const absoluteCacheFilePath = fileManager.getAbsolutePath(cachePath);
    const bodyData: { [key: string]: any } = {};

    if (cachePathDirectory) {
        bodyData.cache_directory_path = cachePathDirectory;
    }
    if (params.dataSourceId) {
        bodyData.data_source_uuid = params.dataSourceId;
    }

    if (Preferences.get('json2Capnp.enabled', false)) {
        return await json2CapnpRust.objectFromCache({
            cacheName: objectName,
            bodyData,
            parser,
            objectUuid: objectId,
            newObject: (attribs) => new ObjectClass(attribs, false)
        });
    } else {
        if (!fileManager.fileExists(cachePath)) {
            console.error(`cache file for ${objectName} id ${objectId} does not exist at path ${cachePath}`);
            return undefined;
        }

        const readStream = fs.createReadStream(absoluteCacheFilePath);

        return new Promise((resolve, reject) => {
            readToEndOfStream(readStream)
                .then((data: any) => {
                    const message = new capnp.Message(data);
                    const cacheObject = message.getRoot(CacheObjectClass);
                    const object = capnpParser(cacheObject);
                    resolve(object);
                })
                .catch((error) => {
                    console.error('error loading collection cache', error);
                    reject(
                        new TrError(
                            `Cannot load ${objectName} from cache file ${cachePath} (capnp error: ${error})`,
                            'CAQCFC0004',
                            'CannotLoadCacheBecauseError'
                        )
                    );
                });
        });
    }
};

const deleteObjectCache = async (params: { cacheName: string; cachePathDirectory: string; objectId: string }) => {
    const objectName = params.cacheName;
    const cachePathDirectory = params.cachePathDirectory;
    const objectId = params.objectId;
    const cachePath = `${prefix}cache/${config.projectShortname}/${
        cachePathDirectory ? cachePathDirectory + '/' : ''
    }${objectName}_${objectId}.capnpbin`;
    const absoluteCacheFilePath = fileManager.getAbsolutePath(cachePath);

    if (fileManager.fileExistsAbsolute(absoluteCacheFilePath)) {
        fileManager.deleteFileAbsolute(absoluteCacheFilePath);
    }
    return cachePath;
};

const deleteObjectsCache = async (params: { cacheName: string; cachePathDirectory: string; objectIds: string[] }) => {
    const objectName = params.cacheName;
    const cachePathDirectory = params.cachePathDirectory;
    const objectIds = params.objectIds;
    const cachePaths = objectIds.map((objectId) => {
        return `${prefix}cache/${config.projectShortname}/${
            cachePathDirectory ? cachePathDirectory + '/' : ''
        }${objectName}_${objectId}.capnpbin`;
    });

    for (let i = 0, countI = objectIds.length; i < countI; i++) {
        const cachePath = cachePaths[i];
        const absoluteCacheFilePath = fileManager.getAbsolutePath(cachePath);

        if (fileManager.fileExistsAbsolute(absoluteCacheFilePath)) {
            fileManager.deleteFileAbsolute(absoluteCacheFilePath);
        }
    }
    return cachePaths;
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
    deleteCacheDirectory,
    saveToFile,
    getFromFile
};
