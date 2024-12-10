/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import SocketIOFileClient from 'socket.io-file-client';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ImportValidator from 'chaire-lib-common/lib/services/importers/ImporterValidator';

export type FileUploadStatus =
    | {
          status: 'notUploaded';
      }
    | {
          status: 'uploading';
          progress: number;
      }
    | {
          status: 'error';
          error: string | Error;
      }
    | {
          status: 'completed';
      }
    | {
          status: 'aborted';
      };

export type FileUploaderHOCProps = {
    fileImportRef: React.RefObject<HTMLInputElement>;
    fileUploader: SocketIOFileClient;
    onChange: React.ChangeEventHandler;
    validator?: ImportValidator;
    uploadStatus: FileUploadStatus;
};

type FileUploaderHOCState = {
    validator?: ImportValidator;
    uploadStatus: FileUploadStatus;
};

const fileUploaderHOC = <P,>(
    WrappedComponent: React.ComponentType<P>,
    importerValidator?: typeof ImportValidator,
    autoImport = true
) => {
    class FileUploaderHOC extends React.Component<P & FileUploaderHOCProps, FileUploaderHOCState> {
        private fileImportRef: React.RefObject<HTMLElement>;
        private fileUploader: SocketIOFileClient;

        constructor(props: P & FileUploaderHOCProps) {
            super(props);

            this.state = {
                validator: importerValidator ? new importerValidator({}) : undefined,
                uploadStatus: { status: 'notUploaded' }
            };

            this.fileImportRef = React.createRef() as React.RefObject<HTMLInputElement>;
            this.fileUploader = new SocketIOFileClient(serviceLocator.socketEventManager._eventManager);

            this.onFileUploadStart = this.onFileUploadStart.bind(this);
            this.onFileUploadStream = this.onFileUploadStream.bind(this);
            this.onFileUploadComplete = this.onFileUploadComplete.bind(this);
            this.onFileUploadError = this.onFileUploadError.bind(this);
            this.onFileUploadAbort = this.onFileUploadAbort.bind(this);
            this.onChange = this.onChange.bind(this);
        }

        componentDidMount() {
            this.fileUploader.on('start', this.onFileUploadStart);
            this.fileUploader.on('stream', this.onFileUploadStream);
            this.fileUploader.on('complete', this.onFileUploadComplete);
            this.fileUploader.on('error', this.onFileUploadError);
            this.fileUploader.on('abort', this.onFileUploadAbort);
        }

        componentWillUnmount() {
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
            this.setState({ uploadStatus: { status: 'uploading', progress: 0 } });
            serviceLocator.eventManager.emit('progress', { name: 'UploadingFile', progress: 0.0 });
        }

        onFileUploadStream(fileInfo: { size: number; sent: number }) {
            const progress = fileInfo.sent / fileInfo.size;
            this.setState({ uploadStatus: { status: 'uploading', progress } });
            serviceLocator.eventManager.emit('progress', { name: 'UploadingFile', progress });
        }

        onFileUploadComplete(_fileInfo) {
            this.setState({ uploadStatus: { status: 'completed' } });
            serviceLocator.eventManager.emit('progress', { name: 'UploadingFile', progress: 1.0 });
            if (autoImport) {
                serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 0.0 });
            }
        }

        onFileUploadError(error) {
            this.setState({ uploadStatus: { status: 'error', error } });
            console.log('File upload error!', error);
        }

        onFileUploadAbort(fileInfo) {
            this.setState({ uploadStatus: { status: 'aborted' } });
            console.log('File upload aborted: ', fileInfo);
        }

        render() {
            return (
                <WrappedComponent
                    {...this.props}
                    fileImportRef={this.fileImportRef}
                    fileUploader={this.fileUploader}
                    onChange={this.onChange}
                    validator={this.state.validator}
                    uploadStatus={this.state.uploadStatus}
                />
            );
        }
    }

    return FileUploaderHOC as typeof React.Component;
};

export default fileUploaderHOC;
