/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { create } from 'react-test-renderer';
import { mount } from 'enzyme';

import SelectedObjectButtons from '../SelectedObjectButtons';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';

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
})

test('Test with delete button', () => {
    const buttons = create(<SelectedObjectButtons
        object = {existingObject}
    />)
        .toJSON();
    expect(buttons).toMatchSnapshot();
});

test('Test without delete button', () => {
    const buttons = create(<SelectedObjectButtons
        object = {existingObject}
        hideDelete = {true}
    />)
        .toJSON();
    expect(buttons).toMatchSnapshot();
});

test('Test with save button', () => {
    const buttons = create(<SelectedObjectButtons
        object = {existingObject}
    />)
        .toJSON();
    expect(buttons).toMatchSnapshot();
});

test('Test without save button', () => {
    const buttons = create(<SelectedObjectButtons
        object = {existingObject}
        hideSave = {true}
    />)
        .toJSON();
    expect(buttons).toMatchSnapshot();
});

test('Test back click on unmodified object', () => {
    const mockBackAction = jest.fn();
    const mockOpenModal = jest.fn();
    const buttons = mount(<SelectedObjectButtons
        object = {existingObject}
        backAction = {mockBackAction}
        openBackConfirmModal = {mockOpenModal}
    />);

    const backButtonWrapper = buttons.find({ type: 'button' }).at(0);
    const backButton = buttons.find({ type: 'button' }).at(1);
    expect(backButtonWrapper.key()).toEqual('back');
    backButton.simulate('click');

    expect(mockBackAction).toHaveBeenCalledTimes(1);
    expect(mockOpenModal).toHaveBeenCalledTimes(0);
})

test('Test back click on modified object', () => {
    const mockBackAction = jest.fn();
    const mockOpenModal = jest.fn();
    const buttons = mount(<SelectedObjectButtons
        object = {existingObject}
        backAction = {mockBackAction}
        openBackConfirmModal = {mockOpenModal}
    />);

    const backButtonWrapper = buttons.find({ type: 'button' }).at(0);
    const backButton = buttons.find({ type: 'button' }).at(1);
    expect(backButtonWrapper.key()).toEqual('back');

    // Do a change on the object and set the props again
    const dataToModify = 'modification';
    const value = 1234;
    existingObject.setData(dataToModify, value);
    buttons.setProps({
        object: existingObject,
        onBack: mockBackAction,
        openBackConfirmModal: mockOpenModal,
    });

    backButton.simulate('click');

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    expect(mockBackAction).toHaveBeenCalledTimes(0);
})

test('Test undo click', () => {
    const mockUndo = jest.fn();
    const buttons = mount(<SelectedObjectButtons
        object = {existingObject}
        onUndo = {mockUndo}
    />);

    // Should be disabled now
    const undoButtonWrapper = buttons.find({ type: 'button' }).at(2);
    const undoButton = buttons.find({ type: 'button' }).at(3);
    expect(undoButtonWrapper.key()).toEqual('undo');
    expect(undoButton.getDOMNode<HTMLInputElement>().disabled).toBe(true);

    // Do a change on the object and set the props again
    const dataToUndo = 'toUndo';
    const value = 1234;
    existingObject.startEditing();
    existingObject.setData(dataToUndo, value);
    buttons.setProps({
        object: existingObject,
        onUndo: mockUndo
    });
    expect(undoButton.getDOMNode<HTMLInputElement>().disabled).toBe(false);
    undoButton.simulate('click');
    expect(mockUndo).toHaveBeenCalledTimes(1);
    expect(existingObject.getData(dataToUndo)).toBeUndefined();
    existingObject.stopEditing();
})

test('Test redo click', () => {
    const mockRedo = jest.fn();
    const buttons = mount(<SelectedObjectButtons
        object = {existingObject}
        onRedo = {mockRedo}
    />);

    // Should be disabled now
    const redoButtonWrapper = buttons.find({ type: 'button' }).at(4);
    const redoButton = buttons.find({ type: 'button' }).at(5);
    expect(redoButtonWrapper.key()).toEqual('redo');
    expect(redoButton.getDOMNode<HTMLInputElement>().disabled).toBe(true);

    // Do a change on the object and set the props again
    const dataToUndo = 'toUndo';
    const value = 1234;
    existingObject.startEditing();
    existingObject.setData(dataToUndo, value);
    existingObject.undo();
    buttons.setProps({
        object: existingObject,
        onRedo: mockRedo
    });
    expect(redoButton.getDOMNode<HTMLInputElement>().disabled).toBe(false);
    redoButton.simulate('click');
    expect(mockRedo).toHaveBeenCalledTimes(1);
    expect(existingObject.getData(dataToUndo)).toEqual(value);
    existingObject.stopEditing();
})

test('Test default save click', () => {

    // TODO Wait for stubbing library for easier test
})

test('Test custom save action', () => {

    // TODO Wait for stubbing library for easier test
})

test('Test delete for new objects', () => {
    const mockDeleteAction = jest.fn();
    const mockOpenModal = jest.fn();
    const buttons = mount(<SelectedObjectButtons
        object = {newObject}
        onDelete = {mockDeleteAction}
        openDeleteConfirmModal = {mockOpenModal}
    />);

    const deleteButtonWrapper = buttons.find({ type: 'button' }).at(8);
    const deleteButton = buttons.find({ type: 'button' }).at(9);
    expect(deleteButtonWrapper.key()).toEqual('delete');
    deleteButton.simulate('click');

    expect(mockDeleteAction).toHaveBeenCalledTimes(1);
    expect(mockOpenModal).toHaveBeenCalledTimes(0);
})

test('Test delete for existing objects', () => {
    const mockDeleteAction = jest.fn();
    const mockOpenModal = jest.fn();
    const buttons = mount(<SelectedObjectButtons
        object = {existingObject}
        onDelete = {mockDeleteAction}
        openDeleteConfirmModal = {mockOpenModal}
    />);

    const deleteButtonWrapper = buttons.find({ type: 'button' }).at(8);
    const deleteButton = buttons.find({ type: 'button' }).at(9);
    expect(deleteButtonWrapper.key()).toEqual('delete');
    deleteButton.simulate('click');

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    expect(mockDeleteAction).toHaveBeenCalledTimes(0);
})

