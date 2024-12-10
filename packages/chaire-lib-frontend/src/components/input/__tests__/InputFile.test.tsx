/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputFile from '../InputFile';

const mockOnChange = jest.fn();
const testId = 'fileWidgetId';
const testLabel = 'Upload file';

test('Default props', () => {
    const { container } = render(<InputFile
        id = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('All props', () => {
    const ref: React.RefObject<HTMLInputElement> = React.createRef() as React.RefObject<HTMLInputElement>;
    const { container } = render(<InputFile
        id = {testId}
        onChange = {mockOnChange}
        accept = "*.zip"
        inputRef = {ref}
        disabled = {false}
    />);
    expect(container).toMatchSnapshot();
});

test('Disabled', () => {
    const ref: React.RefObject<HTMLInputElement> = React.createRef() as React.RefObject<HTMLInputElement>;
    const { container } = render(<InputFile
        id = {testId}
        onChange = {mockOnChange}
        accept = "*.zip"
        inputRef = {ref}
        disabled = {true}
    />);
    expect(container).toMatchSnapshot();
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
    fireEvent.change(input, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
