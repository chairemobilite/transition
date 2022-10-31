/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import InputText from '../InputText';
import { render, fireEvent } from "@testing-library/react";

const mockOnChange = jest.fn();
const testId = "textAreaWidgetId";
const testLabel = "Text Area";

test('Default props', () => {
    const input = create(<InputText
        id = {testId}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('All props', () => {
    const input = create(<InputText
        id = {testId}
        onValueChange = {mockOnChange}
        rows = {10}
        value = "test"
        maxLength = {100}
        disabled = {false}
        placeholder = "placeholder"
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const input = create(<InputText
        id = {testId}
        onValueChange = {mockOnChange}
        disabled = {true}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Placeholder', () => {
    const input = create(<InputText
        id = {testId}
        onValueChange = {mockOnChange}
        rows = {10}
        maxLength = {100}
        disabled = {false}
        placeholder = "placeholder"
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
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
    const newText = "new text";
    fireEvent.change(input, {target: { value: newText}});
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
