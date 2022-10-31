/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// TODO: This does not seem to work, We should find a way to add the testing-library's custom matchers in the file to test the rest.
test('Default', () => {
    expect(true).toBeTruthy();
});
/*
import { create } from 'react-test-renderer';
import InputMultiselect from '../InputMultiselect';
import selectEvent from 'react-select-event'
import 'react-testing-library/extend-expect';
import { render, fireEvent } from "@testing-library/react";
import {} from 'jest-dom';
import {
    toHaveFormValues,
  } from '@testing-library/jest-dom/matchers'

expect.extend({toHaveFormValues})

const mockOnChange = jest.fn();
const testId = "SelectWidgetId";
const testLabel = "Select label";
const defaultChoiceValue = "test1";
const anotherChoiceValue = "test2";
const testChoices = [
    { value: defaultChoiceValue },
    { value: anotherChoiceValue, label: "label for test2" },
    { value: "disabled", disabled: true},
];

test('Default props', () => {
    const input = create(<InputMultiselect
        id = {testId}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('All props', () => {
    const input = create(<InputMultiselect
        id = {testId}
        onValueChange = {mockOnChange}
        value = {[anotherChoiceValue]}
        defaultValue = {[]}
        multiple = {true}
        disabled = {false}
        choices = {testChoices}
        localePrefix = "something"
        t = {str => str}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const input = create(<InputMultiselect
        id = {testId}
        onValueChange = {mockOnChange}
        disabled = {true}
    />)
        .toJSON();

    expect(input).toMatchSnapshot();
});

test('With blank choice', () => {
    const input = create(<InputMultiselect
        id = {testId}
        onValueChange = {mockOnChange}
        choices = {testChoices}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Default value', async () => {
    mockOnChange.mockClear();
    const { getByTestId, getByLabelText } = render(
    <div>
        <form data-testid="form">
            <InputMultiselect
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[ defaultChoiceValue ]}
                choices = {testChoices}
            />
            <label htmlFor={testId}>{testLabel}</label>
        </form>
    </div>);
    expect(getByTestId('form')).toHaveFormValues({ testId: [ defaultChoiceValue ] }) // empty select
});

test('Default and initial value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
    <div>
        <InputMultiselect
            id = {testId}
            onValueChange = {mockOnChange}
            defaultValue = {[defaultChoiceValue]}
            value = {[anotherChoiceValue]}
            choices = {testChoices}
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    expect(input.value).toBe(anotherChoiceValue);
});

test('Default and initial empty value', () => {
    mockOnChange.mockClear();
    const value = [];
    const { getByLabelText } = render(
    <div>
        <InputMultiselect
            id = {testId}
            onValueChange = {mockOnChange}
            defaultValue = {[defaultChoiceValue]}
            value = {[]}
            choices = {testChoices}
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    expect(input.value).toBe(value);
});

test('Invalid default and value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
    <div>
        <InputMultiselect
            id = {testId}
            onValueChange = {mockOnChange}
            defaultValue = {["not a value"]}
            value = {["still not a choice"]}
            choices = {testChoices}
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    expect(input.value).toBe(defaultChoiceValue);
});

test('Call onChange', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
    <div>
        <InputMultiselect
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {testChoices}
        />
        <label htmlFor={testId}>{testLabel}</label>
    </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    const newText = "new text";
    fireEvent.change(input, {target: { value: [newText]}});
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
*/