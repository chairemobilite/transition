/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import SocketIO from 'socket.io';
import SocketIOFile from 'socket.io-file';
import { directoryManager } from '../../utils/filesystem/directoryManager';

const BYTES_IN_MB = Math.pow(1024, 2);

export type FileUploadOptions = {
    acceptTypes: string[];
    maxFileSizeMB: number;
    chunkSizeMB: number;
    transmissionDelayInMS: number;
    overwriteExistingFile: boolean;
    uploadDirs: { [type: string]: string };
};

const createSocketIoFile = (
    socket: SocketIO.Socket,
    absoluteUserDir: string,
    options: Partial<FileUploadOptions> = {}
): SocketIOFile => {
    const allOptions: FileUploadOptions = Object.assign(
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

    return new SocketIOFile(socket, {
        uploadDir: allOptions.uploadDirs,
        rename: function (filename, fileInfo) {
            console.log('file info', fileInfo);
            // TODO Type of data is wrong, it is any[], not an object as assumed here
            if (fileInfo.data && (fileInfo.data as any).filename) {
                return (fileInfo.data as any).filename;
            } else {
                return 'upload.txt';
            }
        },
        accepts: allOptions.acceptTypes,
        maxFileSize: allOptions.maxFileSizeMB * BYTES_IN_MB, // undefined: no limit
        chunkSize: allOptions.chunkSizeMB * BYTES_IN_MB, // Higher value gives you faster upload, uses more server resources. Lower value saves your server resources, slower upload.
        transmissionDelay: allOptions.transmissionDelayInMS, // delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
        overwrite: allOptions.overwriteExistingFile // overwrite file if exists, default is true.
    });
    // see https://www.npmjs.com/package/socket.io-file for more config options
};

export default createSocketIoFile;
