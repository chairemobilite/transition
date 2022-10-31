/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import InputColor from '../InputColor';
import { shallow } from 'enzyme';

const mockOnChange = jest.fn();
const testId = 'ColorWidgetId';

test('Default props', () => {
    const input = create(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        defaultColor = '#554433'
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('All props', () => {
    const input = create(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        value = '#123456'
        defaultColor = '#123456'
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Blank value', () => {
    const input = create(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        value = ''
        defaultColor = '#223344'
    />)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('With colorpicker', () => {
    const input = shallow(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        value = '#123456'
        defaultColor = '#223344'
    />);
    input.setState({displayColorPicker: true});
    expect(input.html()).toMatchSnapshot();

    input.setState({displayColorPicker: false});
    expect(input.html()).toMatchSnapshot();
});

