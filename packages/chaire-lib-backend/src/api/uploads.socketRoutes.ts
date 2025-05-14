/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import SocketIO from 'socket.io';
import _merge from 'lodash/merge';

import { fileManager } from '../utils/filesystem/fileManager';
import { FileUploadOptions, FileUploadStatus } from 'chaire-lib-common/lib/utils/files/fileUpload/types';

export type FileUploadServerOptions = {
    acceptTypes: string[];
    maxFileSizeMB: number;
    chunkSizeMB: number;
    transmissionDelayInMS: number;
    overwriteExistingFile: boolean;
    /**
     * An object containing the type of file upload as key and the absolute path
     * to the directory where to save the file as value.
     */
    uploadDirs: { [type: string]: string };
};

type ObjectImporter =
    | {
          type: 'importerObject';
          object: {
              import: (filePath: string) => Promise<unknown>;
              attributes?: unknown;
          };
      }
    | {
          type: 'function';
          fct: (socket: SocketIO.Socket, absoluteUserDir: string, filePath: string) => void;
      }
    | {
          type: 'importOnly';
      };

// Remove anything before a slash or backslash in the filename to prevent path traversal attacks
const sanitizeFileName = (filename: string) => filename.replace(/^.*[\\/]/, '');

export default function (
    socket: SocketIO.Socket,
    absoluteUserDir: string,
    importerByObjectName: { [object: string]: ObjectImporter },
    options: Partial<FileUploadServerOptions> = {}
) {
    const allOptions: FileUploadServerOptions = _merge(
        {
            acceptTypes: [], // it seems Chrome can not detect .geojson files, so we must accept any mime types...     // empty array: accepts any file
            maxFileSizeMB: 256,
            chunkSizeMB: 50,
            transmissionDelayInMS: 0,
            overwriteExistingFile: true,
            uploadDirs: {
                imports: `${absoluteUserDir}/imports`,
                uploads: `${absoluteUserDir}/uploads`
            }
        },
        options
    );

    const handleFileImport = (options: FileUploadOptions, saveToFile: string) => {
        if (options.data && options.data.objects) {
            const importObjectsName = options.data.objects;
            const objectImporter = importerByObjectName[importObjectsName];
            if (!objectImporter) {
                return; // No import to run on this file
            }
            if (objectImporter.type === 'importerObject') {
                objectImporter.object
                    .import(saveToFile)
                    .then(() => {
                        console.log('finished importing file', saveToFile);
                        socket.emit(`importer.${importObjectsName}Imported`, objectImporter.object.attributes);
                    })
                    .catch((error) => {
                        console.error(error);
                    });
            } else if (objectImporter.type === 'function') {
                objectImporter.fct(socket, absoluteUserDir, saveToFile);
            } else {
                console.log('Nothing to import for file', saveToFile);
                socket.emit(`importer.${importObjectsName}Imported`);
            }
        }
    };

    // Get the absolute file path to save the file to, and makes sure the directory exists
    const prepareUploadFileAndDir = (options: FileUploadOptions): string => {
        // Get the folder where to save the file
        const saveToFolder = allOptions.uploadDirs[options.uploadType] || allOptions.uploadDirs['imports'];
        if (!allOptions.uploadDirs[options.uploadType]) {
            console.error(`No folder set for upload type ${options.uploadType}. Saving to 'imports' directory.`);
        }

        const importFileName =
            typeof options.data.filename === 'string' ? sanitizeFileName(options.data.filename) : 'upload.txt';

        const saveToFile = `${saveToFolder}/${importFileName}`;

        // Create the directory if it does not exist
        fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(saveToFolder);
        return saveToFile;
    };

    // Handle file uploads of complete files
    socket.on(
        'uploadFile',
        (file, options: FileUploadOptions, progressCallback: (response: FileUploadStatus) => void) => {
            try {
                const saveToFile = prepareUploadFileAndDir(options);

                // save the content to the disk
                const writeResult = fileManager.writeFileAbsolute(saveToFile, file);
                progressCallback(
                    writeResult === null ? { status: 'error', error: 'CannotWriteFile' } : { status: 'completed' }
                );

                // Import the file if necessary
                if (writeResult) {
                    // Import the file if necessary
                    handleFileImport(options, saveToFile);
                }
            } catch (error) {
                console.error('Error uploading file', error);
                progressCallback({ status: 'error', error: 'ErrorUploadingFile' });
            }
        }
    );

    // Get the chunk size for upload from the server
    socket.on('getChunkSize', (callback: (chunkSize: number) => void) => {
        callback(allOptions.chunkSizeMB * 1024 * 1024); // Send chunk size in bytes
    });

    // Handle chunked file uploads
    socket.on(
        'uploadFileChunk',
        (
            chunk: Buffer,
            options: FileUploadOptions & { chunkIndex: number; totalChunks: number },
            progressCallback: (response: FileUploadStatus) => void
        ) => {
            try {
                const saveToFile = prepareUploadFileAndDir(options);

                // Append the chunk to the file, or write the file if it is the first chunk
                const writeResult =
                    options.chunkIndex === 0
                        ? fileManager.writeFileAbsolute(saveToFile, chunk)
                        : fileManager.appendFileAbsolute(saveToFile, chunk);
                if (writeResult === null) {
                    progressCallback({ status: 'error', error: 'CannotWriteChunk' });
                    return;
                }

                // If it's the last chunk, finalize the upload
                if (options.chunkIndex + 1 === options.totalChunks) {
                    progressCallback({ status: 'completed' });

                    // Import the file if necessary
                    handleFileImport(options, saveToFile);
                } else {
                    progressCallback({
                        status: 'uploading',
                        progress: (options.chunkIndex + 1) / options.totalChunks
                    });
                }
            } catch (error) {
                console.error('Error uploading file chunk', error);
                progressCallback({ status: 'error', error: 'ErrorUploadingChunk' });
            }
        }
    );
}
