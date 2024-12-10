/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputText from '../InputText';

const mockOnChange = jest.fn();
const testId = 'textAreaWidgetId';
const testLabel = 'Text Area';

test('Default props', () => {
    const { container } = render(<InputText
        id = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('All props', () => {
    const { container } = render(<InputText
        id = {testId}
        onValueChange = {mockOnChange}
        rows = {10}
        value = "test"
        maxLength = {100}
        disabled = {false}
        placeholder = "placeholder"
    />);
    expect(container).toMatchSnapshot();
});

test('Disabled', () => {
    const { container } = render(<InputText
        id = {testId}
        onValueChange = {mockOnChange}
        disabled = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('Placeholder', () => {
    const { container } = render(<InputText
        id = {testId}
        onValueChange = {mockOnChange}
        rows = {10}
        maxLength = {100}
        disabled = {false}
        placeholder = "placeholder"
    />);
    expect(container).toMatchSnapshot();
});

test('Call onChange', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputText
                id = {testId}
                onValueChange = {mockOnChange}
            />
            <label htmlFor={testId}>{testLabel}</label>
        </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    const newText = 'new text';
    fireEvent.change(input, { target: { value: newText } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
