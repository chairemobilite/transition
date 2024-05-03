/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export default {
    exists: jest.fn().mockImplementation((_id) => true),
    read: jest.fn().mockImplementation((_id) => {
        throw 'This is a mock. An implementation should be provided to get something';
    }),
    create: jest.fn().mockImplementation((_obj) => _obj.id),
    createMultiple: jest.fn().mockImplementation((_objs) => _objs.map((obj) => obj.id)),
    update: jest.fn().mockImplementation((_obj) => _obj.id),
    updateMultiple: jest.fn().mockImplementation((_objs) => _objs.map((obj) => obj.id)),
    delete: jest.fn().mockImplementation((_id) => _id),
    deleteMultiple: jest.fn().mockImplementation((_ids) => _ids),
    truncate: jest.fn(),
    destroy: jest.fn(),
    collection: jest.fn().mockImplementation(() => []),
    geojsonCollection: jest.fn().mockImplementation(() => [])
};
