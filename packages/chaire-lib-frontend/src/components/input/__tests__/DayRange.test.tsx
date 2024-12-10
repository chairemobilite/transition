/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import each from 'jest-each';

import DayRange from '../DayRange';

const mockOnChange = jest.fn();
const testId = 'DayRangeWidgetId';

test('All props', () => {
    const { container } = render(<DayRange
        id = {testId}
        onChange = {mockOnChange}
        days = {[0,1,2]}
        disabled = {false}
        showPeriodDropdown = {true}
    />);
    expect(container.firstChild).toMatchSnapshot();
});

test('Disabled', () => {
    const { container } = render(<DayRange
        id = {testId}
        onChange = {mockOnChange}
        days = {[0,1,2]}
        disabled = {true}
    />);
    expect(container.firstChild).toMatchSnapshot();
});

test('Do not show dropdown', () => {
    const { container } = render(<DayRange
        id = {testId}
        onChange = {mockOnChange}
        days = {[0,1,2]}
        showPeriodDropdown = {false}
    />);
    expect(container.firstChild).toMatchSnapshot();
});

describe('Period group selection change', () => {
    each([
        ['week', [0, 1, 2, 3, 4]],
        ['week-end', [5, 6]],
        ['all', [0, 1, 2, 3, 4, 5, 6]]
    ]).test('Period group selection for "%s"', (period, indices) => {
        const { container } = render(<DayRange
            id = {testId}
            onChange = {mockOnChange}
            days = {[0,1,2]}
            disabled = {false}
        />);

        mockOnChange.mockClear();

        // Validate initial values
        const periodGroupElement = container.querySelector(`#${testId}_periodGroup`) as HTMLInputElement;
        expect(periodGroupElement.value).toBe('custom');

        // Check the period and validate the choices
        fireEvent.change(periodGroupElement, { target: { value: period } });
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
    ]).test('Days selection for "%s"', async (day, index) => {

        const user = userEvent.setup();

        const { rerender } = render(<DayRange
            id = {testId}
            onChange = {mockOnChange}
            days = {[]}
            disabled = {false}
        />);

        mockOnChange.mockClear();
        expect(screen.getByTitle(day)).toBeInTheDocument();
        expect(screen.getByTitle(day)).not.toBeChecked();
        await user.click(screen.getByTitle(day) as HTMLInputElement);

        // FIXME: We used to check the checked state of the day in the dom, when the tests were using enzyme, but it was not working with testing-library

        // Validate that the onChanged has been called with the correct value
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith([index]);

    });

});
