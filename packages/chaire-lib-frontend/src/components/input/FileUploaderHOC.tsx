/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import SocketIOFileClient from 'socket.io-file-client';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ImportValidator from 'chaire-lib-common/lib/services/importers/ImporterValidator';

interface FileUploaderHOCProps {
    fileUploader: any;
    fileImportRef: any;
}

interface FileUploaderHOCState {
    validator?: ImportValidator;
}

/**
 * TODO Fix and type this class. Look at react hooks which are supposed to be
 * the new way to do hoc in typescript?
 */
const fileUploaderHOC = <P,>(
    WrappedComponent: React.ComponentType<P>,
    importerValidator?: typeof ImportValidator,
    autoImport = true
) => {
    class FileUploaderHOC extends React.Component<P & FileUploaderHOCProps, FileUploaderHOCState> {
        private fileImportRef;
        private fileUploader;

        constructor(props: P & FileUploaderHOCProps) {
            super(props);

            this.state = {
                validator: importerValidator ? new importerValidator({}) : undefined
            };

            this.fileImportRef = React.createRef();
            this.fileUploader = new SocketIOFileClient(serviceLocator.socketEventManager._eventManager, {
                chunkSize: Preferences.get('socketUploadChunkSize')
            });

            this.onFileUploadStart = this.onFileUploadStart.bind(this);
            this.onFileUploadStream = this.onFileUploadStream.bind(this);
            this.onFileUploadComplete = this.onFileUploadComplete.bind(this);
            this.onFileUploadError = this.onFileUploadError.bind(this);
            this.onFileUploadAbort = this.onFileUploadAbort.bind(this);
            this.addEventListeners = this.addEventListeners.bind(this);
            this.removeEventListeners = this.removeEventListeners.bind(this);
            this.onChange = this.onChange.bind(this);
        }

        addEventListeners() {
            this.fileUploader.on('start', this.onFileUploadStart);
            this.fileUploader.on('stream', this.onFileUploadStream);
            this.fileUploader.on('complete', this.onFileUploadComplete);
            this.fileUploader.on('error', this.onFileUploadError);
            this.fileUploader.on('abort', this.onFileUploadAbort);
        }

        removeEventListeners() {
            this.fileUploader.off('start', this.onFileUploadStart);
            this.fileUploader.off('stream', this.onFileUploadStream);
            this.fileUploader.off('complete', this.onFileUploadComplete);
            this.fileUploader.off('error', this.onFileUploadError);
            this.fileUploader.off('abort', this.onFileUploadAbort);
        }

        onChange() {
            this.setState((state) => {
                return {
                    validator: state.validator
                };
            });
        }

        onFileUploadStart(_fileInfo) {
            serviceLocator.eventManager.emit('progress', { name: 'UploadingFile', progress: 0.0 });
        }

        onFileUploadStream(_fileInfo) {
            /* Nothing to do */
        }

        onFileUploadComplete(_fileInfo) {
            serviceLocator.eventManager.emit('progress', { name: 'UploadingFile', progress: 1.0 });
            //console.log('File upload Complete', fileInfo);
            if (autoImport) {
                serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 0.0 });
            }
        }

        onFileUploadError(error) {
            console.log('File upload error!', error);
        }

        onFileUploadAbort(fileInfo) {
            console.log('File upload aborted: ', fileInfo);
        }

        render() {
            return (
                <WrappedComponent
                    {...this.props}
                    onFileUploadStart={this.onFileUploadStart}
                    onFileUploadStream={this.onFileUploadStream}
                    onFileUploadComplete={this.onFileUploadComplete}
                    onFileUploadError={this.onFileUploadError}
                    onFileUploadAbort={this.onFileUploadAbort}
                    addEventListeners={this.addEventListeners}
                    removeEventListeners={this.removeEventListeners}
                    fileImportRef={this.fileImportRef}
                    fileUploader={this.fileUploader}
                    onChange={this.onChange}
                    validator={this.state.validator}
                />
            );
        }
    }

    return FileUploaderHOC as typeof React.Component;
};

export default fileUploaderHOC;
