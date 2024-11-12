/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import { Button } from '../Button';
import { render, fireEvent } from '@testing-library/react';
import { faCoffee } from '@fortawesome/free-solid-svg-icons';

const mockOnClick = jest.fn();
const testLabel = 'Test';

test('Default props', () => {
    const button = create(<Button
        onClick={mockOnClick}
        label={testLabel}
    />)
        .toJSON();
    expect(button).toMatchSnapshot();
});

test('Test overriding props with defaults', () => {
    const button = create(<Button
        onClick={mockOnClick}
        label={testLabel}
        align="left"
        type="submit"
        color="red"
        size="small"
    />);
    expect(button).toMatchSnapshot();
});

test('Test disabled', () => {
    const button = create(<Button
        onClick={mockOnClick}
        label={testLabel}
        align="left"
        type="submit"
        color="red"
        size="small"
        disabled={true}
    />);
    expect(button).toMatchSnapshot();
});

test('Test on click', () => {
    mockOnClick.mockClear();
    const { getByText } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
    />);
    const element = getByText(testLabel);
    fireEvent.click(element);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
});

test('Test invisible', () => {
    const { queryByText } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
        isVisible={false}
    />);
    const element = queryByText(testLabel);
    expect(element).toBeFalsy();
});

test('Test icon path', () => {
    const button = create(<Button
        onClick={mockOnClick}
        label={testLabel}
        iconPath="path/to/my/icon.png"
        iconClass="myIconClass"
    />);
    expect(button).toMatchSnapshot();
});

test('Test icon', () => {
    const button = create(<Button
        onClick={mockOnClick}
        label={testLabel}
        icon={faCoffee}
        iconClass="myIconClass"
    />);
    expect(button).toMatchSnapshot();
});

