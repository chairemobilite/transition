/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputStringFormatted from '../InputStringFormatted';

const mockOnChange = jest.fn();
const testId = 'StringFormattedWidgetId';
const intToStr = (val: number): string => val.toString();
const strToInt = (str: string) => (str === (intToStr(Number.parseInt(str))) ? Number.parseInt(str) : null);
const originalIntValue = 10;

beforeEach(() => {
    mockOnChange.mockClear();
});

test('Default props', () => {
    const { container } = render(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('All props', () => {
    const { container } = render(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        value = "test"
        maxLength = {100}
        disabled = {false}
        autocompleteChoices = {[]}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('Disabled', () => {
    const { container } = render(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        disabled = {true}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('Text input change with deprecated onValueChange', () => {
    const { container } = render(<InputStringFormatted
        id = {testId}
        onValueChange = {mockOnChange}
        value = {originalIntValue}
        maxLength = {100}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    // Validate initial values
    const inputElement = container.querySelector(`#${testId}`) as HTMLInputElement;
    expect(inputElement.value).toBe(originalIntValue.toString());

    // Change the value manually to a valid value
    fireEvent.change(inputElement, { target: { value: (originalIntValue + 1).toString() } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(originalIntValue + 1);
    expect(inputElement.value).toBe((originalIntValue + 1).toString());

    // Manually change the value to something that doesn't pass the string validation
    fireEvent.change(inputElement, { target: { value: (originalIntValue + 1).toString() + 'a' } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(inputElement.value).toBe((originalIntValue + 1).toString() + 'a');

    // Set the value to empty string
    fireEvent.change(inputElement, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenCalledWith(null);
});

test('Text input change', () => {
    const { container } = render(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        value = {originalIntValue}
        maxLength = {100}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    // Validate initial values
    const inputElement = container.querySelector(`#${testId}`) as HTMLInputElement;
    expect(inputElement.value).toBe(originalIntValue.toString());

    // Change the value manually to a valid value
    fireEvent.change(inputElement, { target: { value: (originalIntValue + 1).toString() } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({ value: originalIntValue + 1, valid: true });
    expect(inputElement.value).toBe((originalIntValue + 1).toString());

    // Manually change the value to something that doesn't pass the string validation
    fireEvent.change(inputElement, { target: { value: (originalIntValue + 1).toString() + 'a' } });
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenLastCalledWith({ value: null, valid: false });
    expect(inputElement.value).toBe((originalIntValue + 1).toString() + 'a');

    // Set the value to empty string
    fireEvent.change(inputElement, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledTimes(3);
    expect(mockOnChange).toHaveBeenLastCalledWith({ value: null, valid: true });
});

test('Test with type and pattern', () => {
    /* TODO tahini: testing with those props does not seem to work properly */
});

