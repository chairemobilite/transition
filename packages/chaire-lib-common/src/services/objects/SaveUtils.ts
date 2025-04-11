/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import _get from 'lodash/get';

import * as Status from '../../utils/Status';
import { GenericObject } from '../../utils/objects/GenericObject';

export default {
    // TODO Type the response
    delete: function (
        object: GenericObject<any>,
        socket,
        socketPrefix,
        collection,
        callback: (() => void) | undefined = undefined
    ): Promise<Status.Status<{ id: string | undefined }>> {
        return new Promise((resolve) => {
            const id = object.getAttributes().id;
            socket.emit(
                `${socketPrefix}.delete`,
                object.getAttributes().id,
                _get(object.getAttributes(), 'data.customCachePath'),
                (status: Status.Status<{ id: string | undefined }>) => {
                    if (Status.isStatusOk(status)) {
                        const { id: deletedId } = Status.unwrap(status);
                        if (deletedId !== undefined) {
                            object.set('id', deletedId);
                            object.setDeleted();
                            if (collection) {
                                collection.removeById(id);
                            }
                        }
                        if (typeof callback === 'function') {
                            callback = callback.bind(object);
                            callback();
                        }
                    }
                    resolve(status);
                }
            );
        });
    },

    deleteInMemory: function (object: GenericObject<any>, collection) {
        object.setDeleted();
        if (collection) {
            collection.removeById(object.getAttributes().id);
        }
    },

    saveInMemory: function (object: GenericObject<any>, collection) {
        if (object.isNew()) {
            object.setNew(false);
            if (collection) {
                collection.add(this);
            }
        } else {
            if (collection.getIndex(object.getAttributes().id) >= 0) {
                collection.updateById(object.getAttributes().id, object);
            } else {
                collection.add(object);
            }
        }
    },

    // TODO Type the response
    save: function (
        object: GenericObject<any>,
        socket: EventEmitter,
        socketPrefix: string,
        collection,
        callback: (() => void) | undefined = undefined
    ): Promise<any> {
        return new Promise((resolve) => {
            if (object.isNew()) {
                object.setNew(false);
                socket.emit(
                    `${socketPrefix}.create`,
                    object.getAttributes(),
                    ((response) => {
                        if (!response.error) {
                            object._wasFrozen = object.getAttributes().is_frozen === true;
                            if (response.integer_id) {
                                object.set('integer_id', response.integer_id);
                            }
                            if (collection) {
                                collection.add(object);
                            }
                            if (typeof callback === 'function') {
                                callback = callback.bind(object);
                                callback();
                            }
                        }
                        resolve(response);
                    }).bind(object)
                );
            } else {
                socket.emit(
                    `${socketPrefix}.update`,
                    object.getAttributes().id,
                    object.getAttributes(),
                    ((response) => {
                        if (!response.error) {
                            object._wasFrozen = object.getAttributes().is_frozen === true;
                            if (collection) {
                                if (collection.getIndex(object.getAttributes().id) >= 0) {
                                    collection.updateById(object.getAttributes().id, object);
                                } else {
                                    collection.add(object);
                                }
                            }
                        }
                        resolve(response);
                    }).bind(object)
                );
            }
        });
    },

    saveAll: function (
        objects: GenericObject<any>[],
        socket: EventEmitter,
        socketPrefix: string,
        collection
    ): Promise<any> {
        return new Promise((resolve) => {
            const attributesList = objects.map((obj) => obj.getAttributes());
            socket.emit(`${socketPrefix}.updateBatch`, attributesList, (response) => {
                if (!response.error) {
                    objects.forEach((object) => {
                        object._wasFrozen = object.getAttributes().is_frozen === true;
                        if (collection) {
                            if (collection.getIndex(object.getAttributes().id) >= 0) {
                                collection.updateById(object.getAttributes().id, object);
                            } else {
                                collection.add(object);
                            }
                        }
                    });
                }
                resolve(response);
            });
        });
    }
};
