/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ConfirmModal from '../ConfirmModal';

// Mock react-markdown and remark-gfm as they use syntax not supported by jest
jest.mock('react-markdown', () => 'Markdown');
jest.mock('remark-gfm', () => 'remark-gfm');

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

describe('ConfirmModal', () => {
    test('Test confirm modal with default buttons', () => {
        const handleClose = jest.fn();
        const confirmAction = jest.fn();
        const cancelAction = jest.fn();
        const title = 'Confirm modal title';
        const text = 'Text in the confirm modal';
        
        const { getByText } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title={title}
                confirmAction={confirmAction}
                cancelAction={cancelAction}
            />
        );
        
        expect(getByText(text)).toBeTruthy();
        expect(getByText(title)).toBeTruthy();
        
        // Click on the confirm button
        fireEvent.click(getByText(/main:Confirm/i));
        expect(handleClose).toHaveBeenCalledTimes(1);
        expect(confirmAction).toHaveBeenCalledTimes(1);
        expect(cancelAction).toHaveBeenCalledTimes(0);
    });
    
    test('Test confirm modal with cancel button', () => {
        const handleClose = jest.fn();
        const confirmAction = jest.fn();
        const cancelAction = jest.fn();
        const title = 'Confirm modal title';
        const text = 'Text in the confirm modal';
        
        const { getByText } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title={title}
                confirmAction={confirmAction}
                cancelAction={cancelAction}
            />
        );
        
        // Test cancel button
        fireEvent.click(getByText(/main:Cancel/i));
        expect(handleClose).toHaveBeenCalledTimes(1);
        expect(cancelAction).toHaveBeenCalledTimes(1);
        expect(confirmAction).toHaveBeenCalledTimes(0);
    });
    
    test('Test confirm modal with HTML content', () => {
        const handleClose = jest.fn();
        const title = 'Confirm modal title';
        const baseText = 'Text in the confirm modal';
        const text = `${baseText} <b>bold</b>`;
        
        const { queryByText } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title={title}
                containsHtml={true}
            />
        );
        
        // HTML was added, so the complete text is not there, it is actually composed of many texts
        expect(queryByText(baseText)).toBeTruthy();
        expect(queryByText(title)).toBeTruthy();
        expect(queryByText(text)).toBeFalsy();
    });
    
    test('Test confirm modal with custom button labels and colors', () => {
        const handleClose = jest.fn();
        const confirmAction = jest.fn();
        const cancelAction = jest.fn();
        const text = 'Text in the confirm modal';
        const title = 'Confirm modal title';
        const confirmButtonLabel = 'CustomConfirm';
        const cancelButtonLabel = 'CustomCancel';
        
        const { getByText } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title={title}
                confirmAction={confirmAction}
                cancelAction={cancelAction}
                confirmButtonLabel={confirmButtonLabel}
                cancelButtonLabel={cancelButtonLabel}
                confirmButtonColor="green"
                cancelButtonColor="red"
            />
        );
        
        const confirmButton = getByText(confirmButtonLabel);
        const cancelButton = getByText(cancelButtonLabel);
        
        expect(confirmButton).toBeTruthy();
        expect(cancelButton).toBeTruthy();
        expect(confirmButton.closest('button')?.className).toContain('green');
        expect(cancelButton.closest('button')?.className).toContain('red');
        
        fireEvent.click(confirmButton);
        expect(confirmAction).toHaveBeenCalledTimes(1);
    });
    
    test('Test confirm modal with custom buttons', () => {
        const handleClose = jest.fn();
        const customAction1 = jest.fn();
        const customAction2 = jest.fn();
        const text = 'Text in the confirm modal';
        const title = 'Confirm modal title';
        
        const buttons = {
            button1: { label: 'Custom1', color: 'green', action: customAction1 },
            button2: { label: 'Custom2', color: 'red', action: customAction2 }
        };
        
        const { getByText, queryByText } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title={title}
                buttons={buttons}
            />
        );
        
        // Custom buttons should be rendered
        expect(getByText('Custom1')).toBeTruthy();
        expect(getByText('Custom2')).toBeTruthy();
        
        // Default buttons should not be rendered
        expect(queryByText(/main:Confirm/i)).toBeFalsy();
        expect(queryByText(/main:Cancel/i)).toBeFalsy();
        
        // Test actions
        fireEvent.click(getByText('Custom1'));
        expect(customAction1).toHaveBeenCalledTimes(1);
        
        fireEvent.click(getByText('Custom2'));
        expect(customAction2).toHaveBeenCalledTimes(1);
    });
    
    test('Test confirm modal with children instead of text', () => {
        const handleClose = jest.fn();
        const title = 'Confirm modal title';
        const childText = 'Child content';
        const text = 'This text should not appear';
        
        const { getByText, queryByText } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title={title}
            >
                <div className="custom-child">{childText}</div>
            </ConfirmModal>
        );
        
        // Child content should be rendered
        expect(getByText(childText)).toBeTruthy();
        
        // Text prop should not be rendered when children are provided
        expect(queryByText(text)).toBeFalsy();
    });
    
    test('Test hiding cancel buttons', () => {
        const handleClose = jest.fn();
        const text = 'Modal text';
        
        // Test hiding cancel button
        const { queryByText: queryWithoutCancel } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title="Test"
                showCancelButton={false}
            />
        );
        
        expect(queryWithoutCancel(/main:Confirm/i)).toBeTruthy();
        expect(queryWithoutCancel(/main:Cancel/i)).toBeFalsy();
    });

    test('Test hiding confirm buttons', () => {
        const handleClose = jest.fn();
        const text = 'Modal text';
        
        // Test hiding confirm button
        const { queryByText: queryWithoutConfirm } = render(
            <ConfirmModal
                isOpen={true}
                closeModal={handleClose}
                text={text}
                title="Test"
                showConfirmButton={false}
            />
        );
        
        expect(queryWithoutConfirm(/main:Confirm/i)).toBeFalsy();
        expect(queryWithoutConfirm(/main:Cancel/i)).toBeTruthy();
    });
});
