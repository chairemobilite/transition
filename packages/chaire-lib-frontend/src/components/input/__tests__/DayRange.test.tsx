/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import each from 'jest-each';
import { mount, ReactWrapper } from 'enzyme';

import DayRange from '../DayRange';

const mockOnChange = jest.fn();
const testId = "DayRangeWidgetId";

test('All props', () => {
    const input = create(<DayRange
        id = {testId}
        onChange = {mockOnChange}
        days = {[0,1,2]}
        disabled = {false}
        showPeriodDropdown = {true}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const input = create(<DayRange
        id = {testId}
        onChange = {mockOnChange}
        days = {[0,1,2]}
        disabled = {true}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Do not show dropdown', () => {
    const input = create(<DayRange
        id = {testId}
        onChange = {mockOnChange}
        days = {[0,1,2]}
        showPeriodDropdown = {false}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

const getDayButton = (dayRangeInput: ReactWrapper, day: string) => {
    return dayRangeInput.find(`#${testId}_${day}`).at(0);
}

const verifyCheckedDays = (dayRangeInput: ReactWrapper, days: number[]) => {
    const mondayElement = getDayButton(dayRangeInput, 'Monday');
    const tuesdayElement = getDayButton(dayRangeInput, 'Tuesday');
    const wednesdayElement = getDayButton(dayRangeInput, 'Wednesday');
    const thursdayElement = getDayButton(dayRangeInput, 'Thursday');
    const fridayElement = getDayButton(dayRangeInput, 'Friday');
    const saturdayElement = getDayButton(dayRangeInput, 'Saturday');
    const sundayElement = getDayButton(dayRangeInput, 'Sunday');
    expect(mondayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(0));
    expect(tuesdayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(1));
    expect(wednesdayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(2));
    expect(thursdayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(3));
    expect(fridayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(4));
    expect(saturdayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(5));
    expect(sundayElement.getDOMNode<HTMLInputElement>().checked).toEqual(days.includes(6));
}

describe('Period group selection change', () => {
    each([
        ['week', [0, 1, 2, 3, 4]],
        ['week-end', [5, 6]],
        ['all', [0, 1, 2, 3, 4, 5, 6]]
    ]).test('Period group selection for "%s"', (period, indices) => {
        const dayRangeInput = mount(<DayRange
            id = {testId}
            onChange = {mockOnChange}
            days = {[0,1,2]}
            disabled = {false}
        />);
    
        mockOnChange.mockClear();

        // Validate initial values
        const periodGroupElement = dayRangeInput.find(`#${testId}_periodGroup`).at(0);
        expect(periodGroupElement.getDOMNode<HTMLInputElement>().value).toBe('custom');

        // Check the period and validate the choices
        periodGroupElement.getDOMNode<HTMLInputElement>().value = period;
        periodGroupElement.simulate('change');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith(indices);
    
    });

});

describe('Days selection change', () => {
    each([
        ['Monday', 0],
        ['Tuesday', 1],
        ['Wednesday', 2],
        ['Thursday', 3],
        ['Friday', 4],
        ['Saturday', 5],
        ['Sunday', 6],
    ]).test('Days selection for "%s"', (day, index) => {
        const dayRangeInput = mount(<DayRange
            id = {testId}
            onChange = {mockOnChange}
            days = {[]}
            disabled = {false}
        />);
    
        mockOnChange.mockClear();
    
        // Check and uncheck the button
        let dayButton = getDayButton(dayRangeInput, day);
    
        dayButton.getDOMNode<HTMLInputElement>().checked = true;
        dayButton.simulate('change');
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith([index]);

        dayButton.getDOMNode<HTMLInputElement>().checked = false;
        dayButton.simulate('change');
        expect(mockOnChange).toHaveBeenCalledTimes(2);
        expect(mockOnChange).toHaveBeenLastCalledWith([]);
    });

});

describe('Integration periods and days with props', () => {
    each([
        ['week', [0, 1, 2, 3, 4]],
        ['week-end', [5, 6]],
        ['all', [0, 1, 2, 3, 4, 5, 6]],
        ['custom', [1, 3, 5]]
    ]).test('Integration periods and days with props "%s"', (period, dayRange) => {
        let dayRangeInput = mount(<DayRange
            id = {testId}
            onChange = {mockOnChange}
            days = {[0, 1, 2]}
            disabled = {false}
        />);

        // Change the props to the week days
        dayRangeInput = dayRangeInput.setProps({
            id: testId,
            onChange: mockOnChange,
            disabled: false,
            days: dayRange
        });
        const periodGroupElement = dayRangeInput.find(`#${testId}_periodGroup`).at(0);
        expect(periodGroupElement.getDOMNode<HTMLInputElement>().value).toBe(period);
        verifyCheckedDays(dayRangeInput, dayRange);
    });
});
