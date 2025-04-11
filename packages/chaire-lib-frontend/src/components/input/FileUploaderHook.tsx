/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { useState } from 'react';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { FileUploadOptions, FileUploadStatus } from 'chaire-lib-common/lib/utils/files/fileUpload/types';

export const useFileUploader = (autoImport = true, progressName = 'UploadingFile') => {
    const [uploadStatus, setUploadStatus] = useState<FileUploadStatus>({ status: 'notUploaded' });

    const onFileUploadStart = () => {
        setUploadStatus({ status: 'uploading', progress: 0 });
        serviceLocator.eventManager.emit('progress', { name: progressName, progress: 0.0 });
    };

    const onFileUploadComplete = () => {
        setUploadStatus({ status: 'completed' });
        serviceLocator.eventManager.emit('progress', { name: progressName, progress: 1.0 });
        // FIXME This hook should not handle the autoImport, it should be handled by the calling component, with socket events
        if (autoImport) {
            serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 0.0 });
        }
    };

    const onFileUploadError = (error: string | Error) => {
        console.log('File upload error!', error);
    };

    const upload = async (file: File, options: FileUploadOptions) => {
        try {
            // Request the chunk size from the server
            const chunkSize = await new Promise<number>((resolve) => {
                serviceLocator.socketEventManager.emit('getChunkSize', (size: number) => resolve(size));
            });

            const totalChunks = Math.ceil(file.size / chunkSize);
            onFileUploadStart();

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);

                // Convert the chunk to an ArrayBuffer
                const chunkBuffer = await chunk.arrayBuffer();

                // Upload the chunk
                await new Promise<void>((resolve, reject) => {
                    serviceLocator.socketEventManager.emit(
                        'uploadFileChunk',
                        new Uint8Array(chunkBuffer),
                        { ...options, chunkIndex, totalChunks },
                        (response: FileUploadStatus) => {
                            setUploadStatus(response);
                            switch (response.status) {
                            case 'uploading':
                                serviceLocator.eventManager.emit('progress', {
                                    name: progressName,
                                    progress: response.progress
                                });
                                resolve();
                                break;
                            case 'error':
                                onFileUploadError(response.error);
                                reject(response.error);
                                break;
                            case 'completed':
                                if (chunkIndex + 1 === totalChunks) {
                                    onFileUploadComplete();
                                }
                                resolve();
                                break;
                            default:
                                reject('Unknown status');
                                break;
                            }
                        }
                    );
                });
            }
        } catch (error) {
            console.error('Error during file upload', error);
            onFileUploadError('ErrorUploadingFile');
        }
    };

    return { upload, uploadStatus };
};
