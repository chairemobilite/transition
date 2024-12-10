/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { Button } from '../Button';
import { render, fireEvent } from '@testing-library/react';
import { faCoffee } from '@fortawesome/free-solid-svg-icons';

const mockOnClick = jest.fn();
const testLabel = 'Test';

test('Default props', () => {
    const { container } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
    />);
    expect(container).toMatchSnapshot();
});

test('Test overriding props with defaults', () => {
    const { container } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
        align="left"
        type="submit"
        color="red"
        size="small"
    />);
    expect(container).toMatchSnapshot();
});

test('Test disabled', () => {
    const { container } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
        align="left"
        type="submit"
        color="red"
        size="small"
        disabled={true}
    />);
    expect(container).toMatchSnapshot();
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
    const { container } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
        iconPath="path/to/my/icon.png"
        iconClass="myIconClass"
    />);
    expect(container).toMatchSnapshot();
});

test('Test icon', () => {
    const { container } = render(<Button
        onClick={mockOnClick}
        label={testLabel}
        icon={faCoffee}
        iconClass="myIconClass"
    />);
    expect(container).toMatchSnapshot();
});

