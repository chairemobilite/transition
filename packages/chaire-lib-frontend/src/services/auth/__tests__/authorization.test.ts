/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import isAuthorized,  { deserializeRules } from '../authorization';

const baseUser = {
    id: 1,
    username: 'test',
    preferences: {  },
    serializedPermissions: []
}

const testSubject = 'test';

test('No permissions', () => {
    const ability = deserializeRules(baseUser);
    expect(isAuthorized(ability, { [testSubject]: 'read' })).toBeFalsy();
    expect(isAuthorized(ability, { all: 'read' })).toBeFalsy();
    expect(isAuthorized(ability, { [testSubject]: ['read','update'] })).toBeFalsy();
});

test('Admin permissions', () => {
    const user = Object.assign({}, baseUser, { serializedPermissions: [ ['manage', 'all'] ] });
    const ability = deserializeRules(user);
    expect(isAuthorized(ability, { [testSubject]: 'read' })).toBeTruthy();
    expect(isAuthorized(ability, { all: 'read' })).toBeTruthy();
    expect(isAuthorized(ability, { [testSubject]: ['read','update'] })).toBeTruthy();
});

test('Some permissions', () => {
    let serializedPermissions = [ [ 'read', testSubject ], [ 'read', 'other test object' ] ]
    let user = Object.assign({}, baseUser, { serializedPermissions });
    let ability = deserializeRules(user);
    expect(isAuthorized(ability, { [testSubject]: 'read' })).toBeTruthy();
    expect(isAuthorized(ability, { all: 'read' })).toBeFalsy();
    expect(isAuthorized(ability, { [testSubject]: ['read','update'] })).toBeFalsy();

    serializedPermissions = [ [ 'read,update', testSubject ], [ 'read', 'other test object' ] ]
    user = Object.assign({}, baseUser, { serializedPermissions });
    ability = deserializeRules(user);
    expect(isAuthorized(ability, { [testSubject]: 'read' })).toBeTruthy();
    expect(isAuthorized(ability, { all: 'read' })).toBeFalsy();
    expect(isAuthorized(ability, { [testSubject]: ['read','update'] })).toBeTruthy();
});