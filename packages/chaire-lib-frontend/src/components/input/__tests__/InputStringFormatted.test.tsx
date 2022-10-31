/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import InputStringFormatted from '../InputStringFormatted';
import { mount } from 'enzyme';

const mockOnChange = jest.fn();
const testId = "StringFormattedWidgetId";
const intToStr = (val: number): string => val.toString();
const strToInt = (str: string) => (str === (intToStr(Number.parseInt(str))) ? Number.parseInt(str) : null);
const originalIntValue = 10;
const newIntValue = 20;

beforeEach(function () {
    mockOnChange.mockClear();
});

test('Default props', () => {
    const input = create(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('All props', () => {
    const input = create(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        value = "test"
        maxLength = {100}
        disabled = {false}
        autocompleteChoices = {[]}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const input = create(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        disabled = {true}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Text input change with deprecated onValueChange', () => {
    const stringFormattedInput = mount(<InputStringFormatted
        id = {testId}
        onValueChange = {mockOnChange}
        value = {originalIntValue}
        maxLength = {100}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    // Validate initial values
    const inputElement = stringFormattedInput.find({id: `${testId}`, type: 'text'});
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe(originalIntValue.toString());

    // Change the value manually to a valid value
    inputElement.getDOMNode<HTMLInputElement>().value = (originalIntValue + 1).toString();
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(originalIntValue + 1);
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe((originalIntValue + 1).toString());

    // Manually change the value to something that doesn't pass the string validation
    inputElement.getDOMNode<HTMLInputElement>().value = (originalIntValue + 1).toString() + 'a';
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe((originalIntValue + 1).toString() + 'a');

    // Set the value to empty string
    inputElement.getDOMNode<HTMLInputElement>().value = '';
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenCalledWith(null);
});

test('Text input change', () => {
    const stringFormattedInput = mount(<InputStringFormatted
        id = {testId}
        onValueUpdated = {mockOnChange}
        value = {originalIntValue}
        maxLength = {100}
        stringToValue = {strToInt}
        valueToString = {intToStr}
        key = {testId}
    />);
    // Validate initial values
    const inputElement = stringFormattedInput.find({id: `${testId}`, type: 'text'});
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe(originalIntValue.toString());

    // Change the value manually to a valid value
    inputElement.getDOMNode<HTMLInputElement>().value = (originalIntValue + 1).toString();
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({value: originalIntValue + 1, valid: true});
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe((originalIntValue + 1).toString());

    // Manually change the value to something that doesn't pass the string validation
    inputElement.getDOMNode<HTMLInputElement>().value = (originalIntValue + 1).toString() + 'a';
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenLastCalledWith({value: null, valid: false});
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe((originalIntValue + 1).toString() + 'a');

    // Set the value to empty string
    inputElement.getDOMNode<HTMLInputElement>().value = '';
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(3);
    expect(mockOnChange).toHaveBeenLastCalledWith({value: null, valid: true});
});

test('Test with type and pattern', () => {
    /* TODO tahini: testing with those props does not seem to work properly */
})

