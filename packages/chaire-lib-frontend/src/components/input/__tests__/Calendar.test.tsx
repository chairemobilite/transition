/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import Calendar from '../Calendar';
import { mount } from 'enzyme';
import moment from 'moment';
import MockDate from 'mockdate';

MockDate.set(new Date(1600833600000));
const mockOnChange = jest.fn();
const testId = "CalendarWidgetId";

test('All props', () => {
    const input = create(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "2020-09-23"
        endDate = "2020-11-30"
        dateFormat = "YYYY-MM-DD"
        language = "en"
        disabled = {false}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Disabled', () => {
    const input = create(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "2020-09-23"
        endDate = "2020-11-30"
        dateFormat = "YYYY-MM-DD"
        language = "en"
        disabled = {true}
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Localization', () => {
    const input = create(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "2020-09-23"
        endDate = "2020-11-30"
        dateFormat = "YYYY-MM-DD"
        language = "en"
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

const getEndDate = (dateStr: string) => {
    return moment(dateStr).hours(23).minutes(59).valueOf()
}

test('Date format', () => {
    const calendarInput = mount(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = "23-09-2020"
        endDate = "30-11-2020"
        dateFormat = "DD-MM-YYYY"
        language = "en"
    />);
    // Validate initial values
    const startDateElement = calendarInput.find({id: `${testId}_startDate`, type: 'button'});
    expect(startDateElement.getDOMNode<HTMLInputElement>().value).toBe("23-09-2020");
    const endDateElement = calendarInput.find({id: `${testId}_endDate`, type: 'button'});
    expect(endDateElement.getDOMNode<HTMLInputElement>().value).toBe("30-11-2020");

    // Change start date
    const startDay = calendarInput.find({className: 'react-datepicker__day react-datepicker__day--008', role: 'button'});
    startDay.simulate('click');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(moment("2020-09-08").valueOf(), getEndDate("2020-11-30"));
    expect(startDateElement.getDOMNode<HTMLInputElement>().value).toBe("08-09-2020");
    expect(endDateElement.getDOMNode<HTMLInputElement>().value).toBe("30-11-2020");

    // Change end date
    const endDay = calendarInput.find({className: 'react-datepicker__day react-datepicker__day--029 react-datepicker__day--in-range', role: 'button'});
    endDay.simulate('click');
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenLastCalledWith(moment("2020-09-08").valueOf(), getEndDate("2020-09-29"));
    expect(startDateElement.getDOMNode<HTMLInputElement>().value).toBe("08-09-2020");
    expect(endDateElement.getDOMNode<HTMLInputElement>().value).toBe("29-09-2020");
});

test('Undefined values, componentDidUpdate', () => {
    const dateFormat = "YYYY-MM-DD";
    const calendarInput = mount(<Calendar
        id = {testId}
        onChange = {mockOnChange}
        startDate = {undefined}
        endDate =  {undefined}
        dateFormat = {dateFormat}
    />);
    // Validate initial values
    const startDateElement = calendarInput.find({id: `${testId}_startDate`, type: 'button'});
    expect(startDateElement.getDOMNode<HTMLInputElement>().value).toBe(moment().format(dateFormat));
    const endDateElement = calendarInput.find({id: `${testId}_endDate`, type: 'button'});
    expect(endDateElement.getDOMNode<HTMLInputElement>().value).toBe(moment().format(dateFormat));

    // Props have not changed, but they are set again by parent
    const newProps = {
        id: testId,
        onChange: mockOnChange,
        startDate: undefined,
        endDate: undefined,
        dateFormat: dateFormat
    };
    calendarInput.setProps(newProps);
    expect(startDateElement.getDOMNode<HTMLInputElement>().value).toBe(moment().format(dateFormat));
    expect(endDateElement.getDOMNode<HTMLInputElement>().value).toBe(moment().format(dateFormat));
});
