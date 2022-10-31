/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import _merge from 'lodash.merge';
import { EventEmitter } from 'events';

// TODO This class calls these socket routes. We should thus not import it here. The Preferences class should be divided as part of #1665
import allPreferences from 'chaire-lib-common/lib/config/Preferences';
import preferencesQueries from '../models/db/preferences.db.queries';

export default function(socket: EventEmitter, userId: number) {
    socket.on('preferences.read', async (callback) => {
        try {
            const preferences = await preferencesQueries.read(userId);

            // Merge the user preferences with all the other preferences
            const userPreferences = _merge({}, _cloneDeep(allPreferences.attributes), preferences);
            callback({
                preferences: userPreferences,
                error: null,
                flash: 'PreferencesReadSuccessfully'
            });
        } catch (error) {
            console.error(error);
            callback({ error: 'Error reading preferences for user' });
        }
    });

    socket.on('preferences.update', async (valuesByPath, callback) => {
        try {
            const updatedUserId = await preferencesQueries.update(userId, valuesByPath);

            callback({
                userId: updatedUserId,
                error: null,
                flash: 'PreferencesUpdatedSuccessfully'
            });
        } catch (error) {
            console.error(error);
            callback({ error: 'Error updating preferences for user' });
        }
    });
}
