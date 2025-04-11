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

    // TODO Handle file chunking
    socket.on(
        'uploadFile',
        (file, options: FileUploadOptions, progressCallback: (response: FileUploadStatus) => void) => {
            try {
                // Get the folder where to save the file
                const saveToFolder = allOptions.uploadDirs[options.uploadType] || allOptions.uploadDirs['imports'];
                if (!allOptions.uploadDirs[options.uploadType]) {
                    console.error(
                        `No folder set for upload type ${options.uploadType}. Saving to 'imports' directory.`
                    );
                }

                const importFileName =
                    typeof options.data.filename === 'string' ? sanitizeFileName(options.data.filename) : 'upload.txt';

                const saveToFile = `${saveToFolder}/${importFileName}`;

                // save the content to the disk
                const writeResult = fileManager.writeFileAbsolute(saveToFile, file);
                progressCallback(
                    writeResult === null ? { status: 'error', error: 'CannotWriteFile' } : { status: 'completed' }
                );

                // Import the file if necessary
                if (writeResult && options.data && options.data.objects) {
                    const importObjectsName = options.data.objects;
                    const objectImporter = importerByObjectName[importObjectsName];
                    if (!objectImporter) {
                        // No import to run on this file
                        return;
                    }
                    if (objectImporter.type === 'importerObject') {
                        objectImporter.object
                            .import(saveToFile)
                            .then(() => {
                                console.log('finished importing');
                                socket.emit(`importer.${importObjectsName}Imported`, objectImporter.object.attributes);
                            })
                            .catch((error) => {
                                console.error(error);
                            });
                    } else if (objectImporter.type === 'function') {
                        objectImporter.fct(socket, absoluteUserDir, saveToFile);
                    } else {
                        console.log('finished importing');
                        socket.emit(`importer.${importObjectsName}Imported`);
                    }
                }
            } catch (error) {
                console.error('Error uploading file', error);
                progressCallback({ status: 'error', error: 'ErrorUploadingFile' });
            }
        }
    );
}
