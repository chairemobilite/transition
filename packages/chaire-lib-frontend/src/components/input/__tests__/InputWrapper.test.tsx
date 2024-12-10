/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputWrapper from '../InputWrapper';

const testLabel = 'Test';

test('Basic wrapper', () => {
    const { container } = render(<InputWrapper
        label = {testLabel}>
        <input id="test"/>
    </InputWrapper>);
    expect(container).toMatchSnapshot();
});

test('Wrapper with help', () => {
    const { container } = render(<InputWrapper
        label = {testLabel}
        help = "My help text">
        <input id="test"/>
    </InputWrapper>);
    expect(container).toMatchSnapshot();
});

test('Wrapper with small box and multiple children', () => {
    const { container } = render(<InputWrapper
        label = {testLabel}
        smallInput = {true}>
        <input id="test"/>
        <input id="test2"/>
    </InputWrapper>);
    expect(container).toMatchSnapshot();
});

test('Wrapper in one column', () => {
    const { container } = render(<InputWrapper
        label = {testLabel}
        twoColumns = {false}>
        <input id="test"/>
    </InputWrapper>);
    expect(container).toMatchSnapshot();
});

test('Wrapper in one column and small', () => {
    const { container } = render(<InputWrapper
        label = {testLabel}
        twoColumns = {false}
        smallInput = {true}>
        <input id="test"/>
    </InputWrapper>);
    expect(container).toMatchSnapshot();
});
