/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import geobuf from 'geobuf';
import Pbf from 'pbf';

import GenericObjectCollection from '../../utils/objects/GenericObjectCollection';
import GenericMapObjectCollection from '../../utils/objects/GenericMapObjectCollection';
import { GenericAttributes, GenericObject } from '../../utils/objects/GenericObject';
import { isProgressable } from '../../utils/objects/Progressable';
import TrError from '../../utils/TrError';
import * as Status from '../../utils/Status';

/**
 *
 * @param baseCollection The collection whose features will be updated
 * @param attributesCollection The attributes objects to create the new objects to load as features
 * @param collectionManager TODO Remove?
 * @returns Return the status of the load, either 'success' or 'error'
 */
const loadFromCollection = function <S extends GenericAttributes, T extends GenericObject<S>>(
    baseCollection: GenericObjectCollection<T>,
    attributesCollection: Partial<S>[],
    collectionManager?
): { status: 'error' | 'success'; error?: any } {
    if (isProgressable(baseCollection)) {
        baseCollection.progress('LoadingFromCollection', 0.0);
    }
    const collectionName = baseCollection.displayName;
    if (attributesCollection) {
        try {
            const features = attributesCollection.map((attributes) =>
                baseCollection.newObject(attributes, false, collectionManager)
            );

            baseCollection.setFeatures(features);
            if (isProgressable(baseCollection)) {
                baseCollection.progress('LoadingFromCollection', 1.0);
            }
            return {
                status: 'success'
            };
        } catch (error) {
            console.error(error);
            return {
                status: 'error',
                error: new TrError(
                    `cannot load ${collectionName}`,
                    'CL0001',
                    `${collectionName}CouldNotBeFetchedBecauseDataIsInvalid`
                )
            };
        }
    } else {
        return {
            status: 'error',
            error: new TrError(
                `cannot load ${collectionName}`,
                'CL0002',
                `${collectionName}CouldNotBeFetchedBecauseServerError`
            )
        };
    }
};

/**
 * Load a collection from the server and assign the features to the collection in parameter
 *
 * TODO: Do we need the collectionManager
 * TODO: Make the dataSourceId and socketEventName as optional typed parameter object and see if undefined is enough or we need null
 * @param collection The collection whose features to set
 * @param socket The socket
 * @param collectionManager
 * @param dataSourceId
 * @param socketEventName
 * @returns
 */
const loadFromServer = function <S extends GenericAttributes, T extends GenericObject<S>>(
    collection: GenericObjectCollection<T>,
    socket,
    collectionManager,
    dataSourceId: string | null | undefined = null,
    socketEventName: string | null | undefined = null
) {
    return new Promise((resolve, reject) => {
        if (isProgressable(collection)) collection.progress('LoadingFromServer', 0.0);
        const socketPrefix = collection.socketPrefix;
        socket.emit(socketEventName ? socketEventName : `${socketPrefix}.collection`, dataSourceId, (response) => {
            if (
                response &&
                response.collection &&
                loadFromCollection(collection, response.collection, collectionManager).status === 'success'
            ) {
                resolve(response);
            } else {
                console.error(`cannot load ${socketPrefix} collection from server`);
                reject(
                    new TrError(
                        `cannot load ${socketPrefix} collection from server`,
                        'CL0003',
                        `${socketPrefix}CollectionCouldNotBeFetchedFromServerBecauseServerError`
                    ).export()
                );
            }
            if (isProgressable(collection)) {
                collection.progress('LoadingFromServer', 1.0);
            }
        });
    });
};

const loadGeojsonFromCollection = function (collection: GenericMapObjectCollection<any, any, any>, features) {
    if (isProgressable(collection)) collection.progress('LoadingFromCollection', 0.0);
    const collectionName = collection.displayName;
    if (features) {
        try {
            collection.setFeatures(features);
            if (isProgressable(collection)) {
                collection.progress('LoadingFromCollection', 1.0);
            }
            return {
                status: 'success'
            };
        } catch {
            return {
                status: 'error',
                error: new TrError(
                    `cannot load ${collectionName} geojson`,
                    'CLG0001',
                    `${collectionName}GeosjonCouldNotBeFetchedBecauseDataIsInvalid`
                )
            };
        }
    } else {
        return {
            status: 'error',
            error: new TrError(
                `cannot load ${collectionName} geojson`,
                'CLG0002',
                `${collectionName}GeosjonCouldNotBeFetchedBecauseServerError`
            )
        };
    }
};

const loadGeojsonFromServer = function (
    collection: GenericMapObjectCollection<any, any, any>,
    socket,
    dataSourceIds = [],
    socketEventName?,
    sampleSize?
) {
    return new Promise((resolve, reject) => {
        if (isProgressable(collection)) collection.progress('LoadingFromServer', 0.0);
        const socketPrefix = collection.socketPrefix;

        socket.emit(
            socketEventName ? socketEventName : `${socketPrefix}.geojsonCollection`,
            { dataSourceIds, sampleSize, format: 'geobuf' },
            (
                responseStatus: Status.Status<
                    { type: 'geojson'; geojson: GeoJSON.FeatureCollection } | { type: 'geobuf'; geobuf: Buffer }
                >
            ) => {
                if (Status.isStatusOk(responseStatus)) {
                    const geojsonResponse = Status.unwrap(responseStatus);
                    const geojson =
                        geojsonResponse.type === 'geobuf'
                            ? geobuf.decode(new Pbf(geojsonResponse.geobuf))
                            : geojsonResponse.geojson;
                    if (
                        geojson &&
                        geojson.features &&
                        loadGeojsonFromCollection(collection, geojson.features).status === 'success'
                    ) {
                        if (isProgressable(collection)) {
                            collection.progress('LoadingFromServer', 1.0);
                        }
                        return resolve(geojson);
                    }
                }
                return reject(
                    new TrError(
                        `cannot load ${socketPrefix} geojson collection from server`,
                        'CLG0003',
                        `${socketPrefix}GeojsonCollectionCouldNotBeFetchedFromServerBecauseServerError`
                    ).export()
                );
            }
        );
    });
};

const loadFromServerByFilter = function (
    collection: GenericObjectCollection<any>,
    socket,
    collectionManager,
    dataSourceId = null,
    socketEventName = null,
    filter
) {
    return new Promise((resolve, reject) => {
        if (isProgressable(collection)) collection.progress('LoadingFromServer', 0.0);
        const socketPrefix = collection.socketPrefix;
        socket.emit(
            socketEventName ? socketEventName : `${socketPrefix}.collection`,
            dataSourceId,
            filter,
            (response) => {
                if (
                    response &&
                    response.collection &&
                    loadFromCollection(collection, response.collection, collectionManager).status === 'success'
                ) {
                    resolve(response);
                } else {
                    console.error(`cannot load ${socketPrefix} collection from server`);
                    reject(
                        new TrError(
                            `cannot load ${socketPrefix} collection from server`,
                            'CL0003',
                            `${socketPrefix}CollectionCouldNotBeFetchedFromServerBecauseServerError`
                        ).export()
                    );
                }
                if (isProgressable(collection)) {
                    collection.progress('LoadingFromServer', 1.0);
                }
                return;
            }
        );
    });
};

export default {
    loadFromCollection,
    loadFromServer,
    loadGeojsonFromCollection,
    loadGeojsonFromServer,
    loadFromServerByFilter
};
