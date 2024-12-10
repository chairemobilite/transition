/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import Button from '../Button';
import { create } from 'node:domain';

// Mock react-markdown and remark-gfm as they use syntax not supported by jest
jest.mock('react-markdown', () => 'Markdown');
jest.mock('remark-gfm', () => 'remark-gfm');

const mockSelect = jest.fn();
const mockDuplicate = jest.fn();
const mockDelete = jest.fn();
const duplicateString = 'duplicate';
const selectString = 'select';
const deleteString = 'delete';

beforeEach(() => {
    mockSelect.mockClear();
    mockDuplicate.mockClear();
    mockDelete.mockClear();
});

test('Minimal props', () => {
    const { container } = render(<Button
        key='key'
        isSelected={true}
    >test</Button>);
    expect(container).toMatchSnapshot();
});

test('All props', () => {
    const { container } = render(<Button
        key='key'
        isSelected={true}
        flushActionButtons={false}
        onSelect={{ handler: mockSelect }}
        onDuplicate={{ handler: mockDuplicate, altText: duplicateString }}
        onDelete={{ handler: mockDelete, message: 'deleting' }}
    >test</Button>);
    expect(container).toMatchSnapshot();
});

test('Flush action buttons', () => {
    const { container } = render(<Button
        key='key'
        isSelected={true}
        flushActionButtons={true}
        onSelect={{ handler: mockSelect }}
        onDuplicate={{ handler: mockDuplicate, altText: duplicateString }}
        onDelete={{ handler: mockDelete, message: 'deleting' }}
    >test</Button>);
    expect(container).toMatchSnapshot();
});

test('Flush action buttons, just delete', () => {
    const { container } = render(<Button
        key='key'
        isSelected={true}
        flushActionButtons={true}
        onDelete={{ handler: mockDelete, message: 'deleting' }}
    >test</Button>);
    expect(container).toMatchSnapshot();
});

test('Not selected, with altText', () => {
    const { container } = render(<Button
        key='key'
        isSelected={false}
        onSelect={{ handler: mockSelect, altText: selectString }}
        onDuplicate={{ handler: mockDuplicate, altText: duplicateString }}
        onDelete={{ handler: mockDelete, altText: deleteString, message: 'deleting' }}
    >test</Button>);
    expect(container).toMatchSnapshot();
});

test('Test select call', () => {
    const { getByText } = render(
        <Button
            key='key'
            isSelected={true}
            onSelect={{ handler: mockSelect }}
        >test</Button>);
    const input = getByText('test') as HTMLInputElement;
    fireEvent.click(input);
    expect(mockSelect).toHaveBeenCalledTimes(1);
});

test('Test duplicate call', () => {
    mockDuplicate.mockImplementationOnce((e) => {
        e.stopPropagation();
    });
    const { getByAltText } = render(
        <Button
            key='key'
            isSelected={true}
            onSelect={{ handler: mockSelect }}
            onDuplicate={{ handler: mockDuplicate, altText: duplicateString }}
        >test</Button>);
    const input = getByAltText(duplicateString) as HTMLInputElement;
    fireEvent.click(input);
    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    expect(mockSelect).not.toHaveBeenCalled();
});

test('Test delete click, cancel', () => {
    mockDuplicate.mockImplementationOnce((e) => {
        e.stopPropagation();
    });
    const { getByAltText, getByText, queryByText } = render(
        <Button
            key='key'
            isSelected={true}
            onDelete={{ handler: mockDelete, altText: deleteString, message: 'deleting' }}
        >test</Button>);
    const input = getByAltText(deleteString) as HTMLInputElement;
    const cancelButton = queryByText('main:Cancel');
    expect(cancelButton).toBeFalsy();
    fireEvent.click(input);

    const cancelButtonAfterClick = getByText('main:Cancel') as HTMLInputElement;
    expect(cancelButtonAfterClick).toBeTruthy();
    fireEvent.click(cancelButtonAfterClick);

    const cancelButtonAfterCancel = queryByText('main:Cancel');
    expect(cancelButtonAfterCancel).toBeFalsy();
    expect(mockDelete).not.toHaveBeenCalled();
});

test('Test delete click, confirm', () => {
    mockDuplicate.mockImplementationOnce((e) => {
        e.stopPropagation();
    });
    const { getByAltText, getByText, queryByText } = render(
        <Button
            key='key'
            isSelected={true}
            onDelete={{ handler: mockDelete, altText: deleteString, message: 'deleting' }}
        >test</Button>);
    const input = getByAltText(deleteString) as HTMLInputElement;
    const confirmButton = queryByText(deleteString);
    expect(confirmButton).toBeFalsy();
    fireEvent.click(input);

    const confirmButtonAfterClick = getByText(deleteString) as HTMLInputElement;
    expect(confirmButtonAfterClick).toBeTruthy();
    fireEvent.click(confirmButtonAfterClick);

    const confirmButtonAfterConfirm = queryByText(deleteString);
    expect(confirmButtonAfterConfirm).toBeFalsy();
    expect(mockDelete).toHaveBeenCalledTimes(1);
});
