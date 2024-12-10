/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputSelect from '../InputSelect';

const mockOnChange = jest.fn();
const testId = 'SelectWidgetId';
const testLabel = 'Select label';
const defaultChoiceValue = 'test1';
const anotherChoiceValue = 'test2';
const testChoices = [
    { value: defaultChoiceValue },
    { value: anotherChoiceValue, label: 'label for test2' },
    { value: 'disabled', disabled: true },
    { value: 'has sub-choices',
        choices: [
            { value: 'subChoice1' },
            { value: 'subChoice2', label: 'label for subchoice2' }
        ]
    }
];

test('Default props', () => {
    const { container } = render(<InputSelect
        id = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('All props', () => {
    const { container } = render(<InputSelect
        id = {testId}
        onValueChange = {mockOnChange}
        value = {anotherChoiceValue}
        defaultValue = {defaultChoiceValue}
        disabled = {false}
        noBlank = {true}
        choices = {testChoices}
        localePrefix = "something"
        t = {(str) => str}
    />);
    expect(container).toMatchSnapshot();
});

test('Disabled', () => {
    const { container } = render(<InputSelect
        id = {testId}
        onValueChange = {mockOnChange}
        disabled = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('With blank choice', () => {
    const { container } = render(<InputSelect
        id = {testId}
        onValueChange = {mockOnChange}
        noBlank = {false}
        choices = {testChoices}
    />);
    expect(container).toMatchSnapshot();
});

test('Default value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputSelect
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {defaultChoiceValue}
                choices = {testChoices}
            />
            <label htmlFor={testId}>{testLabel}</label>
        </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    expect(input.value).toBe(defaultChoiceValue);
});

test('Default and initial value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputSelect
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {defaultChoiceValue}
                value = {anotherChoiceValue}
                choices = {testChoices}
            />
            <label htmlFor={testId}>{testLabel}</label>
        </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    expect(input.value).toBe(anotherChoiceValue);
});

test('Default and initial empty value', () => {
    mockOnChange.mockClear();
    const value = '';
    const { getByLabelText } = render(
        <div>
            <InputSelect
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {defaultChoiceValue}
                value = {value}
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
            <InputSelect
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = "not a value"
                value = "still not a choice"
                choices = {testChoices}
                noBlank = {true}
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
            <InputSelect
                id = {testId}
                onValueChange = {mockOnChange}
                choices = {testChoices}
            />
            <label htmlFor={testId}>{testLabel}</label>
        </div>);
    const input = getByLabelText(testLabel) as HTMLInputElement;
    const newText = 'new text';
    fireEvent.change(input, { target: { value: newText } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
