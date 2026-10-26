/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventEmitter } from 'events';

import FileImportForm from '../FileImportForm';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { [key: string]: string }) => (params?.error ? `${key}: ${params.error}` : key)
    })
}));

jest.mock('chaire-lib-frontend/lib/components/input/FileUploaderHook', () => ({
    useFileUploader: () => ({ upload: jest.fn() })
}));

jest.mock('chaire-lib-common/lib/utils/ServiceLocator', () => {
    const { EventEmitter } = jest.requireActual('events');
    return {
        socketEventManager: new EventEmitter(),
        eventManager: { emit: jest.fn() }
    };
});

const socketEventManager = serviceLocator.socketEventManager as unknown as EventEmitter;
const importErrorMessage = { text: 'main:errors:ErrorImportingFileWithDetails', params: { error: 'Invalid ID format' } };
const expectedErrorText = 'main:errors:ErrorImportingFileWithDetails: Invalid ID format';

const renderForm = () =>
    render(
        <FileImportForm
            pluralizedObjectsName="agencies"
            fileNameWithExtension="agencies.json"
            label="File"
            closeImporter={jest.fn()}
        />
    );

beforeEach(() => {
    jest.clearAllMocks();
});

describe('FileImportForm import errors', () => {
    test('Show the import error sent by the server', () => {
        renderForm();
        expect(screen.queryByText(expectedErrorText)).not.toBeInTheDocument();

        act(() => {
            socketEventManager.emit('importer.agenciesImportError', importErrorMessage);
        });

        expect(screen.getByText(expectedErrorText)).toBeInTheDocument();
        expect(serviceLocator.eventManager.emit).toHaveBeenCalledWith('progress', { name: 'Importing', progress: 1.0 });
    });

    test('Ignore import errors for other objects', () => {
        renderForm();

        act(() => {
            socketEventManager.emit('importer.linesImportError', importErrorMessage);
        });

        expect(screen.queryByText(expectedErrorText)).not.toBeInTheDocument();
        expect(serviceLocator.eventManager.emit).not.toHaveBeenCalled();
    });

    test('Clear the error when selecting another file', () => {
        const { container } = renderForm();
        act(() => {
            socketEventManager.emit('importer.agenciesImportError', importErrorMessage);
        });
        expect(screen.getByText(expectedErrorText)).toBeInTheDocument();

        fireEvent.change(container.querySelector('#formFieldAgenciesImporterFile') as HTMLInputElement);

        expect(screen.queryByText(expectedErrorText)).not.toBeInTheDocument();
    });

    test('Stop listening to import errors when unmounted', () => {
        const { unmount } = renderForm();
        expect(socketEventManager.listenerCount('importer.agenciesImportError')).toEqual(1);

        unmount();

        expect(socketEventManager.listenerCount('importer.agenciesImportError')).toEqual(0);
    });
});
