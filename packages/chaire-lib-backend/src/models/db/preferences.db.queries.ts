/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _set from 'lodash.set';
import knex from '../../config/shared/db.config';

import TrError from 'chaire-lib-common/lib/utils/TrError';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

const read = async (userId: number) => {
    if (_isBlank(userId) || !Number.isInteger(userId)) {
        throw new TrError(
            'Cannot get preferences because the required parameter userId is missing or invalid',
            'PREFS0001',
            'PreferencesCannotReadBecauseUserIdIsMissingOrInvalid'
        );
    }

    try {
        const rows = await knex('users').select('preferences').where('id', userId);
        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find user with id ${userId} in database`,
                'PREFS0002',
                'PreferencesCannotReadBecauseUserDoesNotExist'
            );
        }
        return rows[0].preferences || {};
    } catch (error) {
        if (TrError.isTrError(error)) {
            throw error;
        }
        throw new TrError(
            `Cannot read preferences for user id ${userId} from database (knex error: ${error})`,
            'PREFS0003',
            'PreferencesCannotReadBecauseDatabaseError'
        );
    }
};

const update = async (userId: number, valuesByPath: { [pref: string]: unknown }) => {
    if (_isBlank(userId) || !Number.isInteger(userId)) {
        throw new TrError(
            'Cannot update preferences because the required parameter userId is missing or invalid',
            'PREFS0004',
            'PreferencesCannotUpdateBecauseUserIdIsMissingOrInvalid'
        );
    }

    try {
        const preferences = await read(userId);
        for (const path in valuesByPath) {
            _set(preferences, path, valuesByPath[path]);
        }
        const idArray = await knex('users').update({ preferences }).where('id', userId).returning('id');
        return idArray[0];
    } catch (error) {
        if (TrError.isTrError(error)) {
            throw error;
        }
        throw new TrError(
            `Cannot update preferences for user id ${userId} from database (knex error: ${error})`,
            'PREFS0005',
            'PreferencesCannotUpdateBecauseDatabaseError'
        );
    }
};

export default {
    read,
    update
};
