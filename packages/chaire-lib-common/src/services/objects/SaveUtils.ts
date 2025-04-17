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
            const id = object.attributes.id;
            socket.emit(
                `${socketPrefix}.delete`,
                object.attributes.id,
                _get(object.attributes, 'data.customCachePath'),
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
            collection.removeById(object.attributes.id);
        }
    },

    saveInMemory: function (object: GenericObject<any>, collection) {
        if (object.isNew()) {
            object.setNew(false);
            if (collection) {
                collection.add(this);
            }
        } else {
            if (collection.getIndex(object.attributes.id) >= 0) {
                collection.updateById(object.attributes.id, object);
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
                    object.attributes,
                    ((response) => {
                        if (!response.error) {
                            object._wasFrozen = object.attributes.is_frozen === true;
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
                    object.attributes.id,
                    object.attributes,
                    ((response) => {
                        if (!response.error) {
                            object._wasFrozen = object.attributes.is_frozen === true;
                            if (collection) {
                                if (collection.getIndex(object.attributes.id) >= 0) {
                                    collection.updateById(object.attributes.id, object);
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
    }
};
