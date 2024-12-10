/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';

import SelectedObjectButtons from '../SelectedObjectButtons';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// TODO Cannot do a stub class, it gives compilation error. Wait for a mocking/stubbing library
let newObject: ObjectWithHistory<GenericAttributes>;
let existingObject: ObjectWithHistory<GenericAttributes>;

beforeEach(() => {
    existingObject = new ObjectWithHistory({
        id: 'abcdef'
    }, false);
    existingObject.startEditing();
    newObject = new ObjectWithHistory({}, true);
    newObject.startEditing();
});

test('Test with delete button', () => {
    const { container } = render(<SelectedObjectButtons
        object = {existingObject}
    />);
    expect(container).toMatchSnapshot();
});

test('Test without delete button', () => {
    const { container } = render(<SelectedObjectButtons
        object = {existingObject}
        hideDelete = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('Test with save button', () => {
    const { container } = render(<SelectedObjectButtons
        object = {existingObject}
    />);
    expect(container).toMatchSnapshot();
});

test('Test without save button', () => {
    const { container } = render(<SelectedObjectButtons
        object = {existingObject}
        hideSave = {true}
    />);
    expect(container).toMatchSnapshot();
});

test('Test back click on unmodified object', () => {
    const mockBackAction = jest.fn();
    const mockOpenModal = jest.fn();
    render(<SelectedObjectButtons
        object = {existingObject}
        backAction = {mockBackAction}
        openBackConfirmModal = {mockOpenModal}
    />);

    const backButton = screen.getByTitle('main:Back');
    fireEvent.click(backButton);

    expect(mockBackAction).toHaveBeenCalledTimes(1);
    expect(mockOpenModal).toHaveBeenCalledTimes(0);
});

test('Test back click on modified object', () => {
    const mockBackAction = jest.fn();
    const mockOpenModal = jest.fn();

    existingObject.setData('modification', 1234);
    /*
    With enzyme, we can change the object after render, but for a weird reason,
    with testing-library, we cannot. maybe the rendering just clones the atributes.
    So we need to do the change before the render.
    */
    render(<SelectedObjectButtons
        object={existingObject}
        backAction={mockBackAction}
        openBackConfirmModal={mockOpenModal}
    />);

    const backButton = screen.getByTitle('main:Back');
    fireEvent.click(backButton);
    console.log('hasCHanged');

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    expect(mockBackAction).toHaveBeenCalledTimes(0);
});

test('Test undo click', () => {
    const mockUndo = jest.fn();
    const { rerender } = render(<SelectedObjectButtons
        object = {existingObject}
        onUndo = {mockUndo}
    />);

    // Should be disabled now
    const undoButton = screen.getByTitle('main:Undo');
    expect(undoButton).toBeDisabled();

    // Do a change on the object and set the props again
    const dataToUndo = 'toUndo';
    const value = 1234;
    existingObject.startEditing();
    existingObject.setData(dataToUndo, value);
    rerender(<SelectedObjectButtons
        object={existingObject}
        onUndo={mockUndo}
    />);
    expect(undoButton).not.toBeDisabled();
    fireEvent.click(undoButton);
    expect(mockUndo).toHaveBeenCalledTimes(1);
    expect(existingObject.getData(dataToUndo)).toBeUndefined();
    existingObject.stopEditing();
});

test('Test redo click', () => {
    const mockRedo = jest.fn();
    const { rerender } = render(<SelectedObjectButtons
        object = {existingObject}
        onRedo = {mockRedo}
    />);

    // Should be disabled now
    const redoButton = screen.getByTitle('main:Redo');
    expect(redoButton).toBeDisabled();

    // Do a change on the object and set the props again
    const dataToUndo = 'toUndo';
    const value = 1234;
    existingObject.startEditing();
    existingObject.setData(dataToUndo, value);
    existingObject.undo();
    rerender(<SelectedObjectButtons
        object={existingObject}
        onRedo={mockRedo}
    />);
    expect(redoButton).not.toBeDisabled();
    fireEvent.click(redoButton);
    expect(mockRedo).toHaveBeenCalledTimes(1);
    expect(existingObject.getData(dataToUndo)).toEqual(value);
    existingObject.stopEditing();
});

test('Test default save click', () => {

    // TODO Wait for stubbing library for easier test
});

test('Test custom save action', () => {

    // TODO Wait for stubbing library for easier test
});

test('Test delete for new objects', () => {
    const mockDeleteAction = jest.fn();
    const mockOpenModal = jest.fn();
    render(<SelectedObjectButtons
        object={newObject}
        onDelete={mockDeleteAction}
        openDeleteConfirmModal={mockOpenModal}
    />);

    const deleteButton = screen.getByTitle('main:Delete');
    fireEvent.click(deleteButton);

    expect(mockDeleteAction).toHaveBeenCalledTimes(1);
    expect(mockOpenModal).toHaveBeenCalledTimes(0);
});

test('Test delete for existing objects', () => {
    const mockDeleteAction = jest.fn();
    const mockOpenModal = jest.fn();

    render(<SelectedObjectButtons
        object={existingObject}
        onDelete={mockDeleteAction}
        openDeleteConfirmModal={mockOpenModal}
    />);

    const deleteButton = screen.getByTitle('main:Delete');
    fireEvent.click(deleteButton);

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    expect(mockDeleteAction).toHaveBeenCalledTimes(0);
});
