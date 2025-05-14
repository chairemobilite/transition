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
        directoryManager: {
            createDirectoryIfNotExistsAbsolute: jest.fn().mockReturnValue(true),
        }
    }
}));
const writeFileAbsoluteMock = fileManager.writeFileAbsolute as jest.MockedFunction<typeof fileManager.writeFileAbsolute>;
const appendFileAbsoluteMock = fileManager.appendFileAbsolute as jest.MockedFunction<typeof fileManager.appendFileAbsolute>;
const createDirectoryMock = fileManager.directoryManager.createDirectoryIfNotExistsAbsolute as jest.MockedFunction<typeof fileManager.directoryManager.createDirectoryIfNotExistsAbsolute>; 

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

        expect(createDirectoryMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports`);
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

        expect(createDirectoryMock).toHaveBeenCalledWith(`${customImportDir}`);
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

describe('Upload file chunks', () => {
    // Mock some chunks
    const chunk1 = Buffer.from('chunk1content');
    const chunk2 = Buffer.from('chunk2content');

    test('Save chunks correctly and finalize upload', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            if (response.status === 'completed') {
                resolveFct!(true);
            }
        });

        const filename = 'chunkedfile.txt';

        // Emit first chunk
        socketStub.emit('uploadFileChunk', chunk1, {
            uploadType: 'test',
            data: { filename },
            chunkIndex: 0,
            totalChunks: 2
        }, progressCallback);

        // Emit second chunk
        socketStub.emit('uploadFileChunk', chunk2, {
            uploadType: 'test',
            data: { filename },
            chunkIndex: 1,
            totalChunks: 2
        }, progressCallback);

        await promise;

        expect(createDirectoryMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports`);
        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, chunk1);
        expect(appendFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, chunk2);
        expect(progressCallback).toHaveBeenCalledWith({ status: 'uploading', progress: 0.5 });
        expect(progressCallback).toHaveBeenCalledWith({ status: 'completed' });
    });

    test('Custom dir and trigger importer', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            if (response.status === 'completed') {
                resolveFct!(true);
            }
        });

        const filename = 'chunkedfile.txt';

        // Emit first chunk
        socketStub.emit('uploadFileChunk', chunk1, {
            uploadType: 'someType',
            data: { filename, objects: 'test' },
            chunkIndex: 0,
            totalChunks: 2
        }, progressCallback);

        // Emit second chunk
        socketStub.emit('uploadFileChunk', chunk2, {
            uploadType: 'someType',
            data: { filename, objects: 'test' },
            chunkIndex: 1,
            totalChunks: 2
        }, progressCallback);

        await promise;

        expect(createDirectoryMock).toHaveBeenCalledWith(`${customImportDir}`);
        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${customImportDir}/${filename}`, chunk1);
        expect(fileManager.appendFileAbsolute).toHaveBeenCalledWith(`${customImportDir}/${filename}`, chunk2);
        expect(importerMock).toHaveBeenCalled();
        expect(progressCallback).toHaveBeenCalledWith({ status: 'completed' });
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
            if (response.status === 'completed') {
                resolveFct!(true);
            }
        });

       // Emit first chunk
       socketStub.emit('uploadFileChunk', chunk1, {
            uploadType: 'test',
            data: { filename: unsanitizedFileName },
            chunkIndex: 0,
            totalChunks: 2
        }, progressCallback);

        // Emit second chunk
        socketStub.emit('uploadFileChunk', chunk2, {
            uploadType: 'test',
            data: { filename: unsanitizedFileName },
            chunkIndex: 1,
            totalChunks: 2
        }, progressCallback);

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${expected}`, chunk1);
        expect(appendFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${expected}`, chunk2);
        expect(progressCallback).toHaveBeenCalledWith({ status: 'uploading', progress: 0.5 });
        expect(progressCallback).toHaveBeenCalledWith({ status: 'completed' });
    });

    test('Error writing first chunk', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            expect(response).toEqual({ status: 'error', error: 'CannotWriteChunk' });
            resolveFct!(true);
        });

        // Return null when writing file for first chunk
        writeFileAbsoluteMock.mockReturnValueOnce(null);
        const filename = 'chunkedfile.txt';

        socketStub.emit('uploadFileChunk', chunk1, {
            uploadType: 'test',
            data: { filename },
            chunkIndex: 0,
            totalChunks: 2
        }, progressCallback);

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, chunk1);
        expect(progressCallback).toHaveBeenCalledWith({ status: 'error', error: 'CannotWriteChunk' });
    });

    test('Error appending subsequent chunk', async () => {
        // Add a resolve function to be called when the socket route has finished
        let resolveFct: undefined | ((val: unknown) => void) = undefined;
        const promise = new Promise((resolve) => {
            resolveFct = resolve;
        });
        const progressCallback = jest.fn().mockImplementation((response: FileUploadStatus) => {
            if (response.status === 'error') {
                resolveFct!(true);
            }
        });

        const filename = 'chunkedfile.txt';

        appendFileAbsoluteMock.mockReturnValueOnce(null);

        // Emit first chunk
        socketStub.emit('uploadFileChunk', chunk1, {
            uploadType: 'test',
            data: { filename },
            chunkIndex: 0,
            totalChunks: 2
        }, progressCallback);

        // Emit second chunk
        socketStub.emit('uploadFileChunk', chunk2, {
            uploadType: 'test',
            data: { filename },
            chunkIndex: 1,
            totalChunks: 2
        }, progressCallback);

        await promise;

        expect(writeFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, chunk1);
        expect(appendFileAbsoluteMock).toHaveBeenCalledWith(`${absoluteUserDir}/imports/${filename}`, chunk2);
        expect(progressCallback).toHaveBeenCalledWith({ status: 'uploading', progress: 0.5 });
        expect(progressCallback).toHaveBeenCalledWith({ status: 'error', error: 'CannotWriteChunk' });
    });

});
