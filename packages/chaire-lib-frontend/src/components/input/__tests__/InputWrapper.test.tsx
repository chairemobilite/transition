/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import InputWrapper from '../InputWrapper';

const testLabel = "Test";

test('Basic wrapper', () => {
    const inputWrapper = create(<InputWrapper
        label = {testLabel}>
            <input id="test"/>
        </InputWrapper>)
        .toJSON();
    expect(inputWrapper).toMatchSnapshot();
});

test('Wrapper with help', () => {
    const inputWrapper = create(<InputWrapper
        label = {testLabel}
        help = "My help text">
           <input id="test"/>
        </InputWrapper>)
        .toJSON();
    expect(inputWrapper).toMatchSnapshot();
});

test('Wrapper with small box and multiple children', () => {
    const inputWrapper = create(<InputWrapper
        label = {testLabel}
        smallInput = {true}>
           <input id="test"/>
           <input id="test2"/>
        </InputWrapper>)
        .toJSON();
    expect(inputWrapper).toMatchSnapshot();
});

test('Wrapper in one column', () => {
    const inputWrapper = create(<InputWrapper
        label = {testLabel}
        twoColumns = {false}>
            <input id="test"/>
        </InputWrapper>)
        .toJSON();
    expect(inputWrapper).toMatchSnapshot();
});

test('Wrapper in one column and small', () => {
    const inputWrapper = create(<InputWrapper
        label = {testLabel}
        twoColumns = {false}
        smallInput = {true}>
            <input id="test"/>
        </InputWrapper>)
        .toJSON();
    expect(inputWrapper).toMatchSnapshot();
});