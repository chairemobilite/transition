/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import { InputCheckbox, InputCheckboxBoolean } from '../InputCheckbox';
import { mount } from 'enzyme';
import { TestUtils } from 'chaire-lib-common/lib/test';

const mockOnChange = jest.fn();
const testId = "SelectWidgetId";
const testLabel = "Select label";

jest.mock('react-i18next', () => ({
    // this mock makes sure any components using the translate HoC receive the t function as a prop
    withTranslation: () => Component => {
        Component.defaultProps = { ...Component.defaultProps, t: (key) => key };
        return Component;
    },
}));

describe('Checkboxes', () => {

    const defaultChoiceValue = "test1";
    const anotherChoiceValue = "test2";
    const choiceValue3 = "test3";
    const labelForChoice2 = "label for test2";
    const labelForChoice3 = "label for test3";
    const testChoices = [
        { value: defaultChoiceValue },
        { value: anotherChoiceValue, label: labelForChoice2 },
        { value: choiceValue3, label: labelForChoice3 },
    ];


    beforeEach(() => {
        mockOnChange.mockClear();
    });

    test('Default props', () => {
        const input = create(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {[]}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('All props', () => {
        const input = create(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            value = {[anotherChoiceValue]}
            defaultValue = {[defaultChoiceValue]}
            choices = {testChoices}
            columns = {1}
            disabled = {false}
            localePrefix = "something"
            allowSelectAll = {false}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('Disabled', () => {
        const input = create(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            value = {[anotherChoiceValue]}
            disabled = {true}
            choices = {testChoices}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('With columns', () => {
        const input = create(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {testChoices}
            columns = {2}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('allow select all', () => {
        const input = create(<InputCheckbox
            id = {testId}
            onValueChange = {mockOnChange}
            choices = {testChoices}
            columns = {2}
            allowSelectAll = {true}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('Default value', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[defaultChoiceValue]}
                choices = {testChoices}
            />
        );
        const input = checkboxInput.find({id: `${testId}_${defaultChoiceValue}`, type: 'checkbox'});
        expect(input.getDOMNode<HTMLInputElement>().checked).toBeTruthy();

        const input2 = checkboxInput.find({id: `${testId}_${anotherChoiceValue}`, type: 'checkbox'});
        expect(input2.getDOMNode<HTMLInputElement>().checked).toBeFalsy();

        const input3 = checkboxInput.find({id: `${testId}_${choiceValue3}`, type: 'checkbox'});
        expect(input3.getDOMNode<HTMLInputElement>().checked).toBeFalsy();
    });

    test('Default and initial value', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[defaultChoiceValue]}
                value = {[anotherChoiceValue]}
                choices = {testChoices}
            />
        );
        const input = checkboxInput.find({id: `${testId}_${defaultChoiceValue}`, type: 'checkbox'});
        expect(input.getDOMNode<HTMLInputElement>().checked).toBeFalsy();

        const input2 = checkboxInput.find({id: `${testId}_${anotherChoiceValue}`, type: 'checkbox'});
        expect(input2.getDOMNode<HTMLInputElement>().checked).toBeTruthy();

        const input3 = checkboxInput.find({id: `${testId}_${choiceValue3}`, type: 'checkbox'});
        expect(input3.getDOMNode<HTMLInputElement>().checked).toBeFalsy();
    });

    test('Default and initial empty value', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {[defaultChoiceValue]}
                value = {[]}
                choices = {testChoices}
            />
        );
        const input = checkboxInput.find({id: `${testId}_${defaultChoiceValue}`, type: 'checkbox'});
        expect(input.getDOMNode<HTMLInputElement>().checked).toBeFalsy();

        const input2 = checkboxInput.find({id: `${testId}_${anotherChoiceValue}`, type: 'checkbox'});
        expect(input2.getDOMNode<HTMLInputElement>().checked).toBeFalsy();

        const input3 = checkboxInput.find({id: `${testId}_${choiceValue3}`, type: 'checkbox'});
        expect(input3.getDOMNode<HTMLInputElement>().checked).toBeFalsy();
    });

    test('Invalid default and value', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                defaultValue = {["not a value"]}
                value = {["still not a choice"]}
                choices = {testChoices}
            />
        );
        const input1 = checkboxInput.find({id: `${testId}_${defaultChoiceValue}`, type: 'checkbox'});
        expect(input1.getDOMNode<HTMLInputElement>().checked).toBeFalsy();

        const input2 = checkboxInput.find({id: `${testId}_${anotherChoiceValue}`, type: 'checkbox'});
        expect(input2.getDOMNode<HTMLInputElement>().checked).toBeFalsy();

        const input3 = checkboxInput.find({id: `${testId}_${choiceValue3}`, type: 'checkbox'});
        expect(input3.getDOMNode<HTMLInputElement>().checked).toBeFalsy();
    });

    test('Call onChange', async () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                choices = {testChoices}
            />
        );
        // Make sure the select all button is not there
        expect(checkboxInput.find({id: `${testId}_selectAll`, type: 'button'})).toHaveLength(0);

        const defaultValueInput = checkboxInput.find({id: `${testId}_${defaultChoiceValue}`, type: 'checkbox'});
        expect(defaultValueInput.getDOMNode<HTMLInputElement>().checked).toBeFalsy();
        // Manually set the DOM state to checked because the change simulation does not do it
        defaultValueInput.getDOMNode<HTMLInputElement>().checked = true;
        defaultValueInput.simulate('change');
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith({target: {value: [defaultChoiceValue]}});
    });

    test('Select/Unselect all', async () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckbox
                id = {testId}
                onValueChange = {mockOnChange}
                choices = {testChoices}
                allowSelectAll = {true}
            />
        );
        const selectAllButton = checkboxInput.find({id: `${testId}_selectAll`, type: 'button'});
        selectAllButton.simulate('click');
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith({target: {value: [defaultChoiceValue, anotherChoiceValue, choiceValue3]}});

        // Simulate parent changing the props to all selected, should unselect
        const newProps = {
            id: testId,
            onChange: mockOnChange,
            choices: testChoices,
            value: [defaultChoiceValue, anotherChoiceValue, choiceValue3],
            allowSelectAll: true
        };
        checkboxInput.setProps(newProps);
        selectAllButton.simulate('click');
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(2);
        expect(mockOnChange).toHaveBeenCalledWith({target: {value: []}});
    });

})

describe('Boolean Checkboxes', () => {
    beforeEach(() => {
        mockOnChange.mockClear();
    });

    test('Default props', () => {
        const input = create(<InputCheckboxBoolean
            id = {testId}
            onValueChange = {mockOnChange}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('All props', () => {
        const input = create(<InputCheckboxBoolean
            id = {testId}
            onValueChange = {mockOnChange}
            isChecked = {true}
            defaultChecked = {false}
            label = "testLabel"
            disabled = {false}
            localePrefix = "something"
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('Disabled', () => {
        const input = create(<InputCheckboxBoolean
            id = {testId}
            onValueChange = {mockOnChange}
            disabled = {true}
        />)
            .toJSON();
        expect(input).toMatchSnapshot();
    });

    test('Default checked value', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                defaultChecked = {true}
                label = {testLabel}
            />
        );
        const input = checkboxInput.find({id: `${testId}_true`, type: 'checkbox'});
        expect(input.getDOMNode<HTMLInputElement>().checked).toBeTruthy();
    });

    test('Default and initial checked values', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                defaultChecked = {true}
                isChecked = {false}
                label = {testLabel}
            />
        );
        const input = checkboxInput.find({id: `${testId}_true`, type: 'checkbox'});
        expect(input.getDOMNode<HTMLInputElement>().checked).toBeFalsy();
    });

    test('Is checked value', () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                isChecked = {true}
                label = {testLabel}
            />
        );
        const input = checkboxInput.find({id: `${testId}_true`, type: 'checkbox'});
        expect(input.getDOMNode<HTMLInputElement>().checked).toBeTruthy();
    });

    test('Call onChange', async () => {
        mockOnChange.mockClear();
        const checkboxInput = mount(
            <InputCheckboxBoolean
                id = {testId}
                onValueChange = {mockOnChange}
                label = {testLabel}
            />
        );
        const input = checkboxInput.find({id: `${testId}_true`, type: 'checkbox'});
        input.simulate('change');
        await TestUtils.flushPromises();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
})

