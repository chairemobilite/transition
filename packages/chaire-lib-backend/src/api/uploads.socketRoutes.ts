/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import createSocketFileUploader, { FileUploadOptions } from '../services/files/SocketFileUploader';

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

export default function(
    socket: SocketIO.Socket,
    absoluteUserDir: string,
    importerByObjectName: { [object: string]: ObjectImporter },
    options: Partial<FileUploadOptions> = {}
) {
    const fileUploader = createSocketFileUploader(socket, absoluteUserDir, options);

    fileUploader.on('start', (fileInfo) => {
        console.log(fileInfo);

        socket.emit('fileUploadStart');

        console.log('Start uploading file');
    });

    fileUploader.on('stream', (fileInfo) => {
        socket.emit('fileUploadProgress', fileInfo.wrote / fileInfo.size);
    });

    fileUploader.on('complete', (fileInfo) => {
        socket.emit('fileUploadComplete');

        const filePath = fileInfo.uploadDir;
        const importObjectsName = (fileInfo.data as any).objects;

        if (fileInfo.data && importObjectsName) {
            const objectImporter = importerByObjectName[importObjectsName];
            if (!objectImporter) {
                return;
            }
            if (objectImporter.type === 'importerObject') {
                objectImporter.object
                    .import(filePath)
                    .then(() => {
                        console.log('finished importing');
                        socket.emit(`importer.${importObjectsName}Imported`, objectImporter.object.attributes);
                    })
                    .catch((error) => {
                        console.error(error);
                    });
            } else if (objectImporter.type === 'function') {
                objectImporter.fct(socket, absoluteUserDir, filePath);
            } else {
                console.log('finished importing');
                socket.emit(`importer.${importObjectsName}Imported`);
            }
        }
    });
}
