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

    const onFileUploadStart = (_fileInfo: any) => {
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

    const upload = (file: File, options: FileUploadOptions) => {
        // TODO chunkify the file
        serviceLocator.socketEventManager.emit('uploadFile', file, options, (response: FileUploadStatus) => {
            setUploadStatus(response);
            switch (response.status) {
            case 'notUploaded':
                onFileUploadStart(response);
                break;
            case 'uploading':
                serviceLocator.eventManager.emit('progress', { name: progressName, progress: response.progress });
                break;
            case 'error':
                onFileUploadError(response.error);
                break;
            case 'completed':
                onFileUploadComplete();
                break;
            default:
                break;
            }
        });
    };

    return { upload, uploadStatus };
};
