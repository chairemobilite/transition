/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import ButtonList from '../ButtonList';

test('Default props', () => {
    const input = create(<ButtonList
        key = 'key'
    >test</ButtonList>)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('With classname', () => {
    const input = create(<ButtonList
        key = 'key'
        className = 'myClass'
    >test</ButtonList>)
        .toJSON();
    expect(input).toMatchSnapshot();
});
