/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';
import TrError from '../../utils/TrError';
import GenericCollection from '../../utils/objects/GenericCollection';

export default {
    /**
     * Save a collection to cache
     *
     * TODO: This method is basically used to save either the entire collection
     * (directly from the db using the socket prefix), or specific objects
     * returned in customCollection, which hopefully are the same type as the
     * calling collection. Sounds like a weird workflow
     *
     * @param collection The collection to save
     * @param socket The socket
     * @param customCollection A custom collection of objects. If not set, the
     * entire collection will be saved to cache
     * @returns
     */
    saveCache: async function (collection: GenericCollection<any>, socket, customCollection?) {
        const socketPrefix = collection.socketPrefix;
        return new Promise((resolve, reject) => {
            socket.emit(
                `${socketPrefix}.saveCollectionCache`,
                customCollection,
                _get(collection.attributes, 'data.customCachePath'),
                (response) => {
                    if (!response.error) {
                        resolve(response);
                    } else {
                        console.error(response.error);
                        reject(
                            new TrError(
                                `cannot save cache for ${socketPrefix}: ${response.error}`,
                                'TSC0001',
                                `${socketPrefix}CacheCouldNotBeSavedBecauseServerError`
                            )
                        );
                    }
                }
            );
        });
    },

    /**
     * Request the data to be loaded from cache. It does not modify the
     * collection
     *
     * @param collection The collection to load
     * @param socket The socket on which to call
     * @returns
     */
    loadCache: async function <T extends GenericCollection<any>>(collection: T, socket): Promise<T> {
        const socketPrefix = collection.socketPrefix;
        return new Promise((resolve, reject) => {
            socket.emit(
                `${socketPrefix}.loadCollectionCache`,
                _get(collection.attributes, 'data.customCachePath'),
                (response) => {
                    if (!response.error) {
                        resolve(response);
                    } else {
                        console.error(response.error);
                        reject(
                            new TrError(
                                `cannot load cache for ${socketPrefix}: ${response.error}`,
                                'TRC0001',
                                `${socketPrefix}CacheCouldNotBeReadBecauseServerError`
                            )
                        );
                    }
                }
            );
        });
    }
};
