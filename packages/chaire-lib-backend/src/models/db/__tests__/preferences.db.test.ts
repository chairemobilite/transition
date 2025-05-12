/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from '../../../config/shared/db.config';

import dbQueries from '../preferences.db.queries';
import { truncate } from '../default.db.queries';

const user = {
    id: 1,
    uuid: uuidV4(),
    username: 'test',
    preferences: { lang: 'fr' }
};

const userDefaultPreferences = {
    id: 2,
    uuid: uuidV4(),
    username: 'default'
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await truncate(knex, 'users');
    await knex('users').insert(user);
    await knex('users').insert(userDefaultPreferences);
});

afterAll(async() => {
    await truncate(knex, 'users');
    await knex.destroy();
});

test('Read initial preferences', async () => {

    const prefs = await dbQueries.read(user.id);
    expect(prefs).toEqual(user.preferences);

});

test('Read default preferences', async () => {

    const prefs = await dbQueries.read(userDefaultPreferences.id);
    expect(prefs).toEqual({});

});

test('Read non-existing user preferences', async () => {

    await expect(dbQueries.read(3))
        .rejects
        .toThrowError('Cannot find user with id 3 in database');

});

test('Update existing preferences', async () => {

    const preferencesDiff = { lang: 'en' }
    await dbQueries.update(user.id, preferencesDiff)
    const prefs = await dbQueries.read(user.id);
    expect(prefs).toEqual(preferencesDiff);

});

test('Update existing preferences, new fields', async () => {

    const preferencesDiff = { foo: { test: 'bar', field1: 'any' } };
    await dbQueries.update(user.id, preferencesDiff)
    const prefs = await dbQueries.read(user.id);
    expect(prefs).toEqual({ lang: 'en', ...preferencesDiff });

});

test('Set preferences for empty user', async () => {

    const preferencesDiff = { foo: { test: 'bar', field1: 'any' } }
    await dbQueries.update(userDefaultPreferences.id, preferencesDiff)
    const prefs = await dbQueries.read(userDefaultPreferences.id);
    expect(prefs).toEqual(preferencesDiff);

});

test('Update non-existing user preferences', async () => {

    await expect(dbQueries.update(3, { test: 'foo' }))
        .rejects
        .toThrowError('Cannot find user with id 3 in database');

});
