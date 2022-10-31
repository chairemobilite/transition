/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import preferencesRoutes from '../preferences.socketRoutes';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import preferencesDbQueries from '../../models/db/preferences.db.queries';
import preferences from 'chaire-lib-common/lib/config/Preferences';

const socketStub = new EventEmitter();
const userId = 2;
preferencesRoutes(socketStub, userId);

jest.mock('../../models/db/preferences.db.queries', () => {
    return {
        read: jest.fn(),
        update: jest.fn()
    }
});

const mockedRead = preferencesDbQueries.read as jest.MockedFunction<typeof preferencesDbQueries.read>;
const mockedUpdate = preferencesDbQueries.update as jest.MockedFunction<typeof preferencesDbQueries.update>;

const preferences1 = {
    defaultSection: 'abc',
    lang: 'fr'
};

describe('Preferences: read user preferences', () => {

    test('Get preferences correctly', (done) => {
        const allPreferences = Object.assign({}, preferences.attributes, preferences1);
        mockedRead.mockResolvedValueOnce(preferences1);
        socketStub.emit('preferences.read', function (response) {
            expect(mockedRead).toHaveBeenCalledWith(userId)
            expect(response.preferences).toEqual(allPreferences);
            done();
        });
    });

    test('Get preferences with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedRead.mockRejectedValueOnce(error);
        socketStub.emit('preferences.read', function (response) {
            expect(mockedRead).toHaveBeenLastCalledWith(userId)
            expect(response.preferences).toBeUndefined();
            expect(response.error).toEqual('Error reading preferences for user');
            done();
        });
    });
});

describe('Preferences: update user preferences', () => {

    const newPreferences = { lang: 'en', foo: 'bar' };

    test('Update preferences correctly', (done) => {
        mockedUpdate.mockResolvedValueOnce(userId);
        socketStub.emit('preferences.update', newPreferences, function (response) {
            expect(mockedUpdate).toHaveBeenCalledWith(userId, newPreferences)
            expect(response.userId).toEqual(userId);
            done();
        });
    });

    test('Update preferences with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedUpdate.mockRejectedValueOnce(error);
        socketStub.emit('preferences.update', newPreferences, function (response) {
            expect(mockedUpdate).toHaveBeenLastCalledWith(userId, newPreferences)
            expect(response.userId).toBeUndefined();
            expect(response.error).toEqual('Error updating preferences for user');
            done();
        });
    });
});