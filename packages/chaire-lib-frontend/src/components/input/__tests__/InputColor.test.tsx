/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import InputColor from '../InputColor';

const mockOnChange = jest.fn();
const testId = 'ColorWidgetId';

test('Default props', () => {
    const { container } = render(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        defaultColor = '#554433'
    />);
    expect(container.firstChild).toMatchSnapshot();
});

test('All props', () => {
    const { container } = render(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        value = '#123456'
        defaultColor = '#123456'
    />);
    expect(container.firstChild).toMatchSnapshot();
});

test('Blank value', () => {
    const { container } = render(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        value = ''
        defaultColor = '#223344'
    />);
    expect(container.firstChild).toMatchSnapshot();
});

test('With colorpicker', () => {
    const { container } = render(<InputColor
        id = {testId}
        onValueChange = {mockOnChange}
        value = '#123456'
        defaultColor = '#223344'
    />);
    const colorPickerOpenButton = container.querySelector('._open-color-picker') as HTMLInputElement;
    fireEvent.click(colorPickerOpenButton);
    expect(container.firstChild).toMatchSnapshot();

    const colorPickerCloseButton = container.querySelector('._close-color-picker') as HTMLInputElement;
    fireEvent.click(colorPickerCloseButton);
    expect(container.firstChild).toMatchSnapshot();
});
