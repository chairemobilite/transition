/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import InputFile from '../InputFile';
import { render, fireEvent } from "@testing-library/react";

const mockOnChange = jest.fn();
const testId = "fileWidgetId";
const testLabel = "Upload file";

test('Default props', () => {
    const input = create(<InputFile
        id = {testId}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('All props', () => {
    const ref: React.RefObject<HTMLInputElement> = React.createRef();
    const input = create(<InputFile
        id = {testId}
        onChange = {mockOnChange}
        accept = "*.zip"
        inputRef = {ref}
        disabled = {false}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const ref: React.RefObject<HTMLInputElement> = React.createRef();
    const input = create(<InputFile
        id = {testId}
        onChange = {mockOnChange}
        accept = "*.zip"
        inputRef = {ref}
        disabled = {true}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Call onChange', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
    <div>
        <InputFile
            id = {testId}
            onChange = {mockOnChange}
            accept = "*.zip"
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel);
    fireEvent.change(input, {target: { value: ""}});
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
