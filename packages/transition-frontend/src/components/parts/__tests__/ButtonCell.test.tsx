/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import ButtonCell from '../ButtonCell';

// Mock react-markdown and remark-gfm as they use syntax not supported by jest
jest.mock('react-markdown', () => 'Markdown');
jest.mock('remark-gfm', () => 'remark-gfm');

const mockOnClick = jest.fn();

test('Left align, one child', () => {
    const { container } = render(<ButtonCell
        key = 'key'
        alignment = 'left'
    >test</ButtonCell>);
    expect(container).toMatchSnapshot();
});

test('Rigth align, one child', () => {
    const { container } = render(<ButtonCell
        key = 'key'
        alignment = 'right'
    >test</ButtonCell>);
    expect(container).toMatchSnapshot();
});

test('Flush align, one child', () => {
    const { container } = render(<ButtonCell
        key = 'key'
        alignment = 'flush'
    >test</ButtonCell>);
    expect(container).toMatchSnapshot();
});

test('More complex children, onClick', () => {
    const { container } = render(<ButtonCell
        key = 'key'
        alignment = 'left'
        onClick = {mockOnClick}
        title = 'title'
    ><h2>test</h2>other text</ButtonCell>);
    expect(container).toMatchSnapshot();
});

test('Test click call', () => {
    mockOnClick.mockClear();
    const { getByText } = render(
        <ButtonCell
            key = 'key'
            alignment = 'left'
            onClick = {mockOnClick}
        >test</ButtonCell>);
    const input = getByText('test') as HTMLInputElement;
    fireEvent.click(input);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
});
