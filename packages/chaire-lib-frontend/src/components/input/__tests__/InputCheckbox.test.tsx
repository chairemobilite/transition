/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { InputCheckbox, InputCheckboxBoolean } from '../InputCheckbox';
import { TestUtils } from 'chaire-lib-common/lib/test';

const mockOnChange = jest.fn();
const testId = 'SelectWidgetId';
const testLabel = 'Select label';

jest.mock('react-i18next', () => ({
    // this mock makes sure any components using the translate HoC receive the t function as a prop
    withTranslation: () => (Component) => {
        Component.defaultProps = { ...Component.defaultProps, t: (key) => key };
        return Component;
    },
}));

describe('Checkboxes', () => {

    const defaultChoiceValue = 'test1';
    const anotherChoiceValue = 'test2';
    const choiceValue3 = 'test3';
    const labelForChoice2 = 'label for test2';
    const labelForChoice3 = 'label for test3';
    const testChoices = [
        { value: defaultChoiceValue },
        { value: anotherChoiceValue, label: labelForChoice2 },
        { value: choiceValue3, label: labelForChoice3 },
    ];


    beforeEach(() => {
        mockOnChange.mockClear();
    });

    test('Default props', () => {
        const { container } = render(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {[]}
        /> as any);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('All props', () => {
        const { container } = render(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            value = {[anotherChoiceValue]}
            defaultValue = {[defaultChoiceValue]}
            choices = {testChoices}
            columns = {1}
            disabled = {false}
            localePrefix = "something"
            allowSelectAll = {false}
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('Disabled', () => {
        const { container } = render(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            value = {[anotherChoiceValue]}
            disabled = {true}
            choices = {testChoices}
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('With columns', () => {
        const { container } = render(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {testChoices}
            columns = {2}
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('allow select all', () => {
        const { container } = render(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {testChoices}
            columns = {2}
            allowSelectAll = {true}
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('Default value', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[defaultChoiceValue]}
                choices = {testChoices}
            />
        );
        const input = container.querySelector(`input#${testId}_${defaultChoiceValue}`) as HTMLInputElement;
        expect(input.checked).toBeTruthy();

        const input2 = container.querySelector(`input#${testId}_${anotherChoiceValue}`) as HTMLInputElement;
        expect(input2.checked).toBeFalsy();

        const input3 = container.querySelector(`input#${testId}_${choiceValue3}`) as HTMLInputElement;
        expect(input3.checked).toBeFalsy();
    });

    test('Default and initial value', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[defaultChoiceValue]}
                value = {[anotherChoiceValue]}
                choices = {testChoices}
            />
        );
        const input = container.querySelector(`input#${testId}_${defaultChoiceValue}`) as HTMLInputElement;
        expect(input.checked).toBeFalsy();

        const input2 = container.querySelector(`input#${testId}_${anotherChoiceValue}`) as HTMLInputElement;
        expect(input2.checked).toBeTruthy();

        const input3 = container.querySelector(`input#${testId}_${choiceValue3}`) as HTMLInputElement;
        expect(input3.checked).toBeFalsy();
    });

    test('Default and initial empty value', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[defaultChoiceValue]}
                value = {[]}
                choices = {testChoices}
            />
        );
        const input = container.querySelector(`input#${testId}_${defaultChoiceValue}`) as HTMLInputElement;
        expect(input.checked).toBeFalsy();

        const input2 = container.querySelector(`input#${testId}_${anotherChoiceValue}`) as HTMLInputElement;
        expect(input2.checked).toBeFalsy();

        const input3 = container.querySelector(`input#${testId}_${choiceValue3}`) as HTMLInputElement;
        expect(input3.checked).toBeFalsy();
    });

    test('Invalid default and value', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {['not a value']}
                value = {['still not a choice']}
                choices = {testChoices}
            />
        );
        const input1 = container.querySelector(`input#${testId}_${defaultChoiceValue}`) as HTMLInputElement;
        expect(input1.checked).toBeFalsy();

        const input2 = container.querySelector(`input#${testId}_${anotherChoiceValue}`) as HTMLInputElement;
        expect(input2.checked).toBeFalsy();

        const input3 = container.querySelector(`input#${testId}_${choiceValue3}`) as HTMLInputElement;
        expect(input3.checked).toBeFalsy();
    });

    test('Call onChange', async () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                choices = {testChoices}
            />
        );
        // Make sure the select all button is not there
        expect(container.querySelector(`input#${testId}_selectAll`)).toBeNull();

        const defaultValueInput = container.querySelector(`input#${testId}_${defaultChoiceValue}`) as HTMLInputElement;
        expect(defaultValueInput.checked).toBeFalsy();
        // Manually set the DOM state to checked because the change simulation does not do it
        fireEvent.click(defaultValueInput);
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith({ target: { value: [defaultChoiceValue] } });
    });

    test('Select/Unselect all', async () => {
        mockOnChange.mockClear();
        const { container, rerender } = render(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                choices = {testChoices}
                allowSelectAll = {true}
            />
        );
        const selectAllButton = container.querySelector(`input#${testId}_selectAll`) as HTMLInputElement;
        fireEvent.click(selectAllButton);
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith({ target: { value: [defaultChoiceValue, anotherChoiceValue, choiceValue3] } });

        // Simulate parent changing the props to all selected, should unselect
        const newProps = {
            id: testId,
            onValueChange: mockOnChange,
            choices: testChoices,
            value: [defaultChoiceValue, anotherChoiceValue, choiceValue3],
            allowSelectAll: true
        };
        rerender(<InputCheckbox {...newProps} />);
        fireEvent.click(selectAllButton);
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(2);
        expect(mockOnChange).toHaveBeenCalledWith({ target: { value: [] } });
    });

});

describe('Boolean Checkboxes', () => {
    beforeEach(() => {
        mockOnChange.mockClear();
    });

    test('Default props', () => {
        const { container } = render(<InputCheckboxBoolean
            id = {testId}
            onValueChange = {mockOnChange}
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('All props', () => {
        const { container } = render(<InputCheckboxBoolean
            id = {testId}
            onValueChange = {mockOnChange}
            isChecked = {true}
            defaultChecked = {false}
            label = "testLabel"
            disabled = {false}
            localePrefix = "something"
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('Disabled', () => {
        const { container } = render(<InputCheckboxBoolean
            id = {testId}
            onValueChange = {mockOnChange}
            disabled = {true}
        />);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('Default checked value', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                defaultChecked = {true}
                label = {testLabel}
            />
        );
        const input = container.querySelector(`input#${testId}_true`) as HTMLInputElement;
        expect(input.checked).toBeTruthy();
    });

    test('Default and initial checked values', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                defaultChecked = {true}
                isChecked = {false}
                label = {testLabel}
            />
        );
        const input = container.querySelector(`input#${testId}_true`) as HTMLInputElement;
        expect(input.checked).toBeFalsy();
    });

    test('Is checked value', () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                isChecked = {true}
                label = {testLabel}
            />
        );
        const input = container.querySelector(`input#${testId}_true`) as HTMLInputElement;
        expect(input.checked).toBeTruthy();
    });

    test('Call onChange', async () => {
        mockOnChange.mockClear();
        const { container } = render(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                label = {testLabel}
            />
        );
        const input = container.querySelector(`input#${testId}_true`) as HTMLInputElement;
        fireEvent.click(input);
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
});

