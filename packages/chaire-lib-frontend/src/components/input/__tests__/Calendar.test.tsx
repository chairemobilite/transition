/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import Calendar from '../Calendar';
import moment from 'moment';
import MockDate from 'mockdate';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

MockDate.set(new Date(1600833600000));
const mockOnChange = jest.fn();
const testId = 'CalendarWidgetId';

test('All props', () => {
    const { container } = render(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "2020-09-23"
        endDate = "2020-11-30"
        dateFormat = "YYYY-MM-DD"
        language = "en"
        disabled = {false}
    />);
    expect(container).toMatchSnapshot();
});

test('Disabled', () => {
    const { container } = render(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "2020-09-23"
        endDate = "2020-11-30"
        dateFormat = "YYYY-MM-DD"
        language = "en"
        disabled = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('Localization', () => {
    const { container } = render(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "2020-09-23"
        endDate = "2020-11-30"
        dateFormat = "YYYY-MM-DD"
        language = "en"
    />);
    expect(container).toMatchSnapshot();
});

const getEndDate = (dateStr: string) => {
    return moment(dateStr).hours(23).minutes(59).valueOf();
};

test('Date format', () => {
    const { container } = render(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "23-09-2020"
        endDate = "30-11-2020"
        dateFormat = "DD-MM-YYYY"
        language = "en"
    />);
    // Validate initial values
    const startDateElement = container.querySelector(`input#${testId}_startDate`) as HTMLInputElement;
    expect(startDateElement.value).toBe('23-09-2020');
    const endDateElement = container.querySelector(`input#${testId}_endDate`) as HTMLInputElement;
    expect(endDateElement.value).toBe('30-11-2020');

    // Change start date
    const startDay = container.querySelector('.react-datepicker__day--008') as Element;
    fireEvent.click(startDay);
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(moment('2020-09-08').valueOf(), getEndDate('2020-11-30'));
    expect(startDateElement.value).toBe('08-09-2020');
    expect(endDateElement.value).toBe('30-11-2020');

    // Change end date
    const endDay = container.querySelector('.react-datepicker__day--029') as Element;
    fireEvent.click(endDay);
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenLastCalledWith(moment('2020-09-08').valueOf(), getEndDate('2020-09-29'));
    expect(startDateElement.value).toBe('08-09-2020');
    expect(endDateElement.value).toBe('29-09-2020');
});

test('Undefined values, componentDidUpdate', () => {
    const dateFormat = 'YYYY-MM-DD';
    const { container, rerender } = render(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = {undefined}
        endDate =  {undefined}
        dateFormat = {dateFormat}
    />);
    // Validate initial values
    const startDateElement = container.querySelector(`#${testId}_startDate`) as HTMLInputElement;
    expect(startDateElement.value).toBe(moment().format(dateFormat));
    const endDateElement = container.querySelector(`#${testId}_endDate`) as HTMLInputElement;
    expect(endDateElement.value).toBe(moment().format(dateFormat));

    // Props have not changed, but they are set again by parent
    const newProps = {
        id: testId,
        onChange: mockOnChange,
        startDate: undefined,
        endDate: undefined,
        dateFormat: dateFormat
    };
    rerender(<Calendar
        {...newProps}
    />);
    expect(startDateElement.value).toBe(moment().format(dateFormat));
    expect(endDateElement.value).toBe(moment().format(dateFormat));
});

