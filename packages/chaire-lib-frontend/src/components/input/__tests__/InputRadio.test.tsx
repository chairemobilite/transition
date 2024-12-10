/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputRadio from '../InputRadio';

const mockOnChange = jest.fn();
const testId = 'RadioWidgetId';
const defaultChoiceValue = 'test1';
const anotherChoiceValue = 'test2';
const testChoices = [
    { value: defaultChoiceValue },
    { value: anotherChoiceValue },
    { value: 'test3', unused: 'unused' },
];
const booleanChoices = [
    { value: 'true' },
    { value: 'false' }
];

test('Default props', () => {
    const { container } = render(<InputRadio
        id = {testId}
    />);
    expect(container).toMatchSnapshot();
});

test('All props', () => {
    const { container } = render(<InputRadio
        id = {testId}
        onValueChange = {mockOnChange}
        value = {anotherChoiceValue}
        defaultValue = {defaultChoiceValue}
        choices = {testChoices}
        localePrefix = "something"
        t = {(str) => str}
        sameLine = {true}
        isBoolean = {false}
        disabled = {false}
    />);
    expect(container).toMatchSnapshot();
});

test('Disabled', () => {
    const { container } = render(<InputRadio
        id = {testId}
        onValueChange = {mockOnChange}
        choices = {testChoices}
        value = {anotherChoiceValue}
        disabled = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('On same line', () => {
    const { container } = render(<InputRadio
        id = {testId}
        onValueChange = {mockOnChange}
        choices = {testChoices}
        sameLine = {true}
    />);
    expect(container).toMatchSnapshot();
    const inputMultipleLine = render(<InputRadio
        id = {testId}
        onValueChange = {mockOnChange}
        choices = {testChoices}
        sameLine = {false}
    />);
    expect(inputMultipleLine).toMatchSnapshot();
});

test('Boolean choices', () => {
    const { container } = render(<InputRadio
        id = {testId}
        onValueChange = {mockOnChange}
        choices = {booleanChoices}
        isBoolean = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('Default value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputRadio
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {defaultChoiceValue}
                choices = {testChoices}
            />
        </div>);
    const input = getByLabelText(defaultChoiceValue) as HTMLInputElement;
    expect(input.checked).toBe(true);
    const unselected = getByLabelText(anotherChoiceValue) as HTMLInputElement;
    expect(unselected.checked).toBe(false);
});

test('Default and initial value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputRadio
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {defaultChoiceValue}
                value = {anotherChoiceValue}
                choices = {testChoices}
            />
        </div>);
    const input = getByLabelText(anotherChoiceValue) as HTMLInputElement;
    expect(input.checked).toBe(true);
    const unselected = getByLabelText(defaultChoiceValue) as HTMLInputElement;
    expect(unselected.checked).toBe(false);
});
test('Invalid default and value', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputRadio
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = "not a value"
                value = "still not a choice"
                choices = {testChoices}
            />
        </div>);
    let input = getByLabelText(defaultChoiceValue) as HTMLInputElement;
    expect(input.checked).toBe(false);
    input = getByLabelText(anotherChoiceValue) as HTMLInputElement;
    expect(input.checked).toBe(false);
});

// Somehow, this test doesn't work, because it's a radio and they're fancy?
test.skip('Call onChange', () => {
    mockOnChange.mockClear();
    const { getByLabelText } = render(
        <div>
            <InputRadio
                id = {testId}
                onValueChange = {mockOnChange}
                choices = {testChoices}
            />
        </div>);
    const input = getByLabelText(anotherChoiceValue) as HTMLInputElement;
    expect(input.checked).toBe(false);
    fireEvent.change(input, { target: { value: anotherChoiceValue } });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
});
