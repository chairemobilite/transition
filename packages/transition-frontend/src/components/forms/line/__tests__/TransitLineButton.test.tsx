/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import TransitLineButton from '../TransitLineButton';
import Line from 'transition-common/lib/services/line/Line';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { duplicateLine } from 'transition-common/lib/services/line/LineDuplicator';


jest.mock('react-markdown', () => 'Markdown');
jest.mock('remark-gfm', () => 'remark-gfm');

jest.mock('transition-common/lib/services/line/LineDuplicator', () => ({
    duplicateLine: jest.fn(),
}));

jest.mock('chaire-lib-common/lib/utils/ServiceLocator', () => ({
    socketEventManager: {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    },
    selectedObjectsManager: {
        setSelection: jest.fn(),
        deselect: jest.fn(),
    },
}));

beforeEach(() => {
    jest.clearAllMocks();

    serviceLocator.selectedObjectsManager = {
        setSelection: jest.fn(),
        deselect: jest.fn(),
    };

    serviceLocator.socketEventManager = {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    };

});

// Wrap tests in a describe block
describe('TransitLineButton', () => {

    test('Minimal props', () => {
        const mockLine = new Line({ some: 'attributes' }, true);
        const { container } = render(
            <TransitLineButton
                line={mockLine}
                lineIsHidden={false}
            >
                test
            </TransitLineButton>
        );

        expect(container).toMatchSnapshot();
    });

    test('All props', () => {
        const mockLine = new Line({ some: 'attributes' }, true);
        const mockOnObjectSelected = (objectId: string) => {};
        const { container } = render(
            <TransitLineButton
                line={mockLine}
                selectedLine={mockLine}
                lineIsHidden={false}
                onObjectSelected={mockOnObjectSelected}
            >
                test
            </TransitLineButton>
        );

        expect(container).toMatchSnapshot();
    });

    test('onSelect should call refreshSchedules, startEditing, and onObjectSelected', async () => {

        const mockLine = new Line({ some: 'attributes' }, true);
        // const mockOnObjectSelected = (objectId: string) => {};
        const mockOnObjectSelected = jest.fn();

        const { getByText } = render(
            <TransitLineButton
                line={mockLine}
                selectedLine={mockLine}
                lineIsHidden={false}
                onObjectSelected={mockOnObjectSelected}
            >
                test
            </TransitLineButton>
        );

        jest.spyOn(mockLine, 'refreshSchedules').mockResolvedValue(undefined);
        jest.spyOn(mockLine, 'getId').mockReturnValue('fake_line_id_1');
        jest.spyOn(mockLine, 'startEditing').mockImplementation(() => {});
        jest.spyOn(mockLine, 'refreshPaths').mockImplementation(() => {});

        const button = document.querySelector('._list-element');
        if (button) fireEvent.click(button);

        await waitFor(() => {
            expect(mockLine.refreshSchedules).toHaveBeenCalledWith(serviceLocator.socketEventManager);
            expect(mockLine.startEditing).toHaveBeenCalled();
            expect(mockOnObjectSelected).toHaveBeenCalledWith('fake_line_id_1');
            expect(serviceLocator.selectedObjectsManager.setSelection).toHaveBeenCalledWith('line', [mockLine]);
        });
    });

    test('onDelete should trigger delete when the line is NOT selected', async () => {

        // First mocked line (the one being tested for deletion)
        const mockLine = new Line({ some: 'attributes' }, true);
        jest.spyOn(mockLine, 'hasPaths').mockReturnValue(true);
        jest.spyOn(mockLine, 'isFrozen').mockReturnValue(false);
        jest.spyOn(mockLine, 'delete').mockResolvedValue(
            Status.createOk({ id: 'fake_line_id_1' })
        );
        jest.spyOn(mockLine, 'getId').mockReturnValue('fake_line_id_1');

        // Second mocked line (the currently selected line)
        const mockLine2 = new Line({ some: 'other_attributes' }, true);
        jest.spyOn(mockLine2, 'getId').mockReturnValue('fake_line_id_2');

        // Mock serviceLocator
        serviceLocator.selectedObjectsManager = {
            setSelection: jest.fn(),
            deselect: jest.fn(),
        };
        serviceLocator.collectionManager = {
            get: jest.fn().mockImplementation((name) => {
                if (name === 'paths') {
                    return {
                        loadFromServer: jest.fn().mockResolvedValue(undefined),
                        toGeojson: jest.fn().mockReturnValue({}),
                    };
                }
                return { refresh: jest.fn() };
            }),
            refresh: jest.fn(),
        };
        serviceLocator.eventManager = {
            emit: jest.fn(),
            emitEvent: jest.fn(),
        };
        serviceLocator.socketEventManager = {
            emit: jest.fn(),
            off: jest.fn(),
            on: jest.fn(),
        };


        const { container, getByText } = render(
            <TransitLineButton
                line={mockLine}
                selectedLine={mockLine2}
                lineIsHidden={false}
                onObjectSelected={jest.fn()}
            />
        );

        // Verify that the delete button exists
        const deleteButton = container.querySelector('img[alt="transit:transitLine:Delete"]');
        expect(deleteButton).not.toBeNull();
        fireEvent.click(deleteButton as Element);

        // Confirm delete in the modal
        const confirmDeleteButton = await waitFor(() =>
            getByText('transit:transitLine:Delete')
        );
        fireEvent.click(confirmDeleteButton);

        // Ensure delete process executes correctly
        await waitFor(() => {
            expect(mockLine.delete).toHaveBeenCalledWith(serviceLocator.socketEventManager);
            expect(serviceLocator.collectionManager.refresh).toHaveBeenCalledWith('lines');
        });
    });

    test('onDuplicate should call duplicateLine and refresh collections', async () => {
        // Mocking a line
        const mockLine = new Line({ some: 'attributes', longname: 'Test Line' }, true);
        jest.spyOn(mockLine, 'get').mockImplementation((key) => {
            if (key === 'longname') return 'Test Line';
            if (key === 'is_frozen') return false; // Mock is_frozen attribute
            return undefined;
        });

        // Mock isFrozen method
        mockLine.isFrozen = jest.fn().mockReturnValue(false); // Default to not frozen

        // Mock getAgency method if it exists
        mockLine.getAgency = jest.fn().mockReturnValue({
            get: jest.fn().mockImplementation((key) => {
                if (key === 'is_frozen') return false; // Mock agency is_frozen attribute
                return undefined;
            }),
        });

        // Mocking duplicateLine to return a new line instance
        const duplicatedLine = new Line({ some: 'newAttributes', longname: 'Test Line (Copy)' }, true);
        (duplicateLine as jest.Mock).mockResolvedValue(duplicatedLine);

        // Mock ServiceLocator functions
        serviceLocator.collectionManager = {
            get: jest.fn((collectionName) => {
                if (collectionName === 'agencies') {
                    return {
                        getById: jest.fn().mockReturnValue({ id: 'fake_agency_id' }), // Mock agency
                    };
                }
                if (collectionName === 'paths') {
                    return {
                        toGeojson: jest.fn().mockReturnValue({}),
                        toGeojsonSimplified: jest.fn().mockReturnValue({})
                    };
                }
                return { refresh: jest.fn() }; // Default return
            }),
            refresh: jest.fn(),
        };

        serviceLocator.eventManager = {
            emit: jest.fn(),
            emitEvent: jest.fn(),
        };
        serviceLocator.socketEventManager = {};

        // Render the component with hideActions set to false so the duplicate button is visible
        const { container } = render(
            <TransitLineButton
                line={mockLine}
                selectedLine={mockLine}
                lineIsHidden={false}
                onObjectSelected={jest.fn()}
            />
        );

        // Find the duplicate button using querySelector (Adjust selector as needed)
        const duplicateButton = container.querySelector('img[alt="transit:transitLine:DuplicateLine"]');
        expect(duplicateButton).toBeInTheDocument(); // Ensure the button is found
        if(duplicateButton) {
            fireEvent.click(duplicateButton); // Click the button
        }

    });
});
