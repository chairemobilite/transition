/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import InputString from '../InputString';
import { render, fireEvent } from "@testing-library/react";
import { mount } from 'enzyme';

const mockOnChange = jest.fn();
const testId = "StringWidgetId";
const testLabel = "String label";

beforeEach(function () {
    mockOnChange.mockClear();
});

test('Default props', () => {
    const input = create(<InputString
        id = {testId}
        onValueUpdated = {mockOnChange}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('All props', () => {
    const input = create(<InputString
        id = {testId}
        onValueUpdated = {mockOnChange}
        value = "test"
        maxLength = {100}
        disabled = {false}
        autocompleteChoices = {[]}
        type = 'number'
        pattern = '[0-9]{1,2}'
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const input = create(<InputString
        id = {testId}
        onValueUpdated = {mockOnChange}
        disabled = {true}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Autocomplete choices', () => {
    const input = create(<InputString
        id = {testId}
        onValueUpdated = {mockOnChange}
        autocompleteChoices = {[{label: "test", value: "test"},
            {label: "test1", value: "test1"}]}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Default and initial empty value', () => {
    const value = "";
    const { getByLabelText } = render(
    <div>
        <InputString
            id = {testId}
            onValueUpdated = {mockOnChange}
            value = {value}
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    expect(input.value).toBe(value);
});

test('Call deprecated onChange', () => {
    const { getByLabelText } = render(
    <div>
        <InputString
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

test('Call onValueUpdated', () => {
    const { getByLabelText } = render(
    <div>
        <InputString
            id = {testId}
            onValueUpdated = {mockOnChange}
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    const newText = "new text";
    fireEvent.change(input, {target: { value: newText}});
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({value: newText, valid: true})
});

test('type check validity', () => {
    const originalIntValue = '5';
    const stringInput = mount(<InputString
        id = {testId}
        onValueUpdated = {mockOnChange}
        type = 'number'
        value = {originalIntValue}
    />);

    // Validate initial values
    const inputElements = stringInput.find({id: `${testId}`, type: 'number'});
    expect(inputElements).toBeTruthy();
    const inputElement = inputElements.last();
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe(originalIntValue);

    /* FIXME tahini: some tests fail here and behave differently than browser. Why?
    // Change the value manually to an invalid value
    const invalidValue = 'a';
    inputElement.getDOMNode<HTMLInputElement>().value = invalidValue;
    inputElement.simulate('change');
    expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe(invalidValue);
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith({value: invalidValue, valid: false});
    */

    // Go back to valid value
    const newIntValue = '10';
    inputElement.getDOMNode<HTMLInputElement>().value = newIntValue;
    inputElement.simulate('change');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenLastCalledWith({value: newIntValue, valid: true});
    //expect(inputElement.getDOMNode<HTMLInputElement>().value).toBe(newIntValue);
    
})

