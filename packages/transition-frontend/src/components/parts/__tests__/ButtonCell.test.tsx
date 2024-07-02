/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import ButtonCell from '../ButtonCell';
import { render, fireEvent } from "@testing-library/react";

// Mock react-markdown and remark-gfm as they use syntax not supported by jest
jest.mock('react-markdown', () => 'Markdown');
jest.mock('remark-gfm', () => 'remark-gfm');

const mockOnClick = jest.fn();

test('Left align, one child', () => {
    const input = create(<ButtonCell
        key = 'key'
        alignment = 'left'
    >test</ButtonCell>)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Rigth align, one child', () => {
    const input = create(<ButtonCell
        key = 'key'
        alignment = 'right'
    >test</ButtonCell>)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('Flush align, one child', () => {
    const input = create(<ButtonCell
        key = 'key'
        alignment = 'flush'
    >test</ButtonCell>)
        .toJSON();
    expect(input).toMatchSnapshot();
});

test('More complex children, onClick', () => {
    const input = create(<ButtonCell
        key = 'key'
        alignment = 'left'
        onClick = {mockOnClick}
        title = 'title'
    ><h2>test</h2>other text</ButtonCell>)
        .toJSON();
    expect(input).toMatchSnapshot();
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
