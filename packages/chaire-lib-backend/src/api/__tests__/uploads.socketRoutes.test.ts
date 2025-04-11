/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import each from 'jest-each';

import { fileManager } from '../../utils/filesystem/fileManager';
import uploadRoutes from '../uploads.socketRoutes';
import { FileUploadStatus } from 'chaire-lib-common/lib/utils/files/fileUpload/types';

// Mock queries and file system
jest.mock('../../utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
        readFileAbsolute: jest.fn(),
        writeFileAbsolute: jest.fn().mockReturnValue('file'),
        appendFileAbsolute: jest.fn().mockReturnValue('file'),
    }
}));
const writeFileAbsoluteMock = fileManager.writeFileAbsolute as jest.MockedFunction<typeof fileManager.writeFileAbsolute>;
const appendFileAbsoluteMock = fileManager.appendFileAbsolute as jest.MockedFunction<typeof fileManager.appendFileAbsolute>;

const socketStub = new EventEmitter();
const importerMock = jest.fn();
const absoluteUserDir = '/absolute/user/dir';
const customImportDir = 'someImportDir';
uploadRoutes(socketStub as any, absoluteUserDir, {
    test: {
        type: 'function',
        fct: importerMock
    }
}, {
    chunkSizeMB: 2,
    overwriteExistingFile: true,
    uploadDirs: { 'someType': customImportDir}
});

beforeEach(() => {
    jest.clearAllMocks();
})

describe('Upload entire file', () => {

    test('Save correctly in import dir', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve, reject) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            expect(response.status).toBe('completed');
            resolveFct!(true);
        });

        // Test with basic parameters, should upload to default import dir and do not call any importer
        const filename = 'testfile.txt';
        socketStub.emit('uploadFile', 'somefilecontent', {
            uploadType: 'test',
            data: {
                filename
            }}, progressCallback
        );

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, 'somefilecontent');
        expect(importerMock).not.toHaveBeenCalled();
    });

    test('Custom dir, and auto-import data', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve, reject) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            expect(response.status).toBe('completed');
            resolveFct!(true);
        });

        // Test with options defined for upload type and it should trigger the test importer function
        const filename = 'testfile.txt';
        socketStub.emit('uploadFile', 'somefilecontent', {
            uploadType: 'someType',
            data: {
                objects: 'test',
                filename
            }}, progressCallback
        );

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${customImportDir}/${filename}`, 'somefilecontent');
        expect(importerMock).toHaveBeenCalled();
    });

    each([
        ['../../../passwd', 'passwd'],
        ['C://overwrite', 'overwrite'],
        ['blabla/../some\\hello.bla', 'hello.bla']
    ]).test('Unsanitized file name: %s => %s', async (unsanitizedFileName, expected) => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve, reject) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            expect(response.status).toBe('completed');
            resolveFct!(true);
        });

        // Test with an usanitized filename
        socketStub.emit('uploadFile', 'somefilecontent', {
            uploadType: 'test',
            data: {
                filename: unsanitizedFileName
            }}, progressCallback
        );

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${expected}`, 'somefilecontent');
        expect(importerMock).not.toHaveBeenCalled();
    });

    test('Error writing file', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve, reject) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            expect(response).toEqual({ status: 'error', error: 'CannotWriteFile' });
            resolveFct!(true);
        });

        // Return null when writing file
        writeFileAbsoluteMock.mockReturnValueOnce(null);
        const filename = 'testfile.txt';
        socketStub.emit('uploadFile', 'somefilecontent', {
            uploadType: 'test',
            data: {
                filename
            }}, progressCallback
        );

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, 'somefilecontent');
        expect(importerMock).not.toHaveBeenCalled();
    });

    test('Arbitrary error during upload', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve, reject) => {
            resolveFct = resolve;
        });

        // The progress callback should be called twice: once when writing the file is successful, twice when the importer function throws an error
        let currentCall = 0;
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            if (currentCall === 0) {
                expect(response).toEqual({ status: 'completed' });
                currentCall++;
            } else {
                expect(response).toEqual({ status: 'error', error: 'ErrorUploadingFile' });
                resolveFct!(true);
            }
        });

        // Let the importer function throw an error
        importerMock.mockImplementation(() => {
            throw new Error('Some error');
        });
        const filename = 'testfile.txt';
        socketStub.emit('uploadFile', 'somefilecontent', {
            uploadType: 'someType',
            data: {
                objects: 'test',
                filename
            }}, progressCallback
        );

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${customImportDir}/${filename}`, 'somefilecontent');
        expect(importerMock).toHaveBeenCalled();
    });
});

