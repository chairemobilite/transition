/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _upperFirst from 'lodash/upperFirst';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';

import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { useFileUploader } from 'chaire-lib-frontend/lib/components/input/FileUploaderHook';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';

interface FileImportFormProps {
    pluralizedObjectsName: string;
    fileNameWithExtension: string;
    label: string;
    closeImporter: React.MouseEventHandler;
    acceptsExtension?: string;
}

const FileImportForm: React.FunctionComponent<FileImportFormProps> = (props: FileImportFormProps) => {
    const [currentChangeCount, setCurrentChangeCount] = React.useState(0);
    const [importErrors, setImportErrors] = React.useState<TranslatableMessage[]>([]);
    const { t } = useTranslation('main');
    const fileImportRef = React.useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
    const { upload } = useFileUploader();

    React.useEffect(() => {
        const importErrorEvent = `importer.${props.pluralizedObjectsName}ImportError`;
        const onImportError = (error: TranslatableMessage) => {
            setImportErrors([error]);
            // Stop the import progress started when the upload completed
            serviceLocator.eventManager.emit('progress', { name: 'Importing', progress: 1.0 });
        };
        serviceLocator.socketEventManager.on(importErrorEvent, onImportError);
        return () => {
            serviceLocator.socketEventManager.off(importErrorEvent, onImportError);
        };
    }, [props.pluralizedObjectsName]);

    return (
        <form
            id={`tr__form-transit-${props.pluralizedObjectsName}-import`}
            className={`tr__form-transit-${props.pluralizedObjectsName}-import apptr__form`}
        >
            <h3>{t('main:Import')}</h3>
            <div className="tr__form-section">
                <div className="apptr__form-input-container _two-columns">
                    <label>{props.label}</label>
                    <InputFile
                        id={`formField${_upperFirst(props.pluralizedObjectsName)}ImporterFile`}
                        accept={props.acceptsExtension}
                        inputRef={fileImportRef}
                        onChange={() => {
                            setCurrentChangeCount(currentChangeCount + 1);
                            setImportErrors([]);
                        }}
                    />
                </div>
            </div>
            <div className="tr__form-buttons-container">
                <Button
                    icon={faUndoAlt}
                    iconClass="_icon"
                    label={t('main:Cancel')}
                    color="grey"
                    onClick={props.closeImporter}
                />
                {fileImportRef.current && fileImportRef.current.files?.length === 1 && (
                    <Button
                        icon={faUpload}
                        iconClass="_icon-alone"
                        label=""
                        color="blue"
                        onClick={() => {
                            // upload
                            if (fileImportRef.current.files && fileImportRef.current.files.length > 0) {
                                const file = fileImportRef.current.files[0];
                                setImportErrors([]);
                                upload(file, {
                                    uploadType: 'imports',
                                    data: {
                                        objects: props.pluralizedObjectsName,
                                        filename: props.fileNameWithExtension
                                    }
                                });
                            }
                        }}
                    />
                )}
            </div>
            {/* TODO Also show the file upload errors, they are only logged in the console for now */}
            <FormErrors errors={importErrors} />
        </form>
    );
};

export default FileImportForm;
