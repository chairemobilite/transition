/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _merge from 'lodash/merge';
import { EventEmitter } from 'events';

// TODO This class calls these socket routes. We should thus not import it here. The Preferences class should be divided as part of #1665
import allPreferences from 'chaire-lib-common/lib/config/Preferences';
import preferencesQueries from '../models/db/preferences.db.queries';
import * as Status from 'chaire-lib-common/lib/utils/Status';

export default function (socket: EventEmitter, userId: number) {
    socket.on('preferences.read', async (callback) => {
        try {
            const preferences = await preferencesQueries.read(userId);

            // Merge the user preferences with all the other preferences
            const userPreferences = _merge({}, _cloneDeep(allPreferences.attributes), preferences);
            callback(Status.createOk(userPreferences));
        } catch (error) {
            console.error(error);
            callback(Status.createError('Error reading preferences for user'));
        }
    });

    socket.on('preferences.update', async (valuesByPath, callback) => {
        try {
            const updatedUserId = await preferencesQueries.update(userId, valuesByPath);
            callback(Status.createOk(updatedUserId));
        } catch (error) {
            console.error(error);
            callback(Status.createError('Error updating preferences for user'));
        }
    });
}
