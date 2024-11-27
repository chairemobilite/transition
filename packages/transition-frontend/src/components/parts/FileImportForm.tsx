/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _upperFirst from 'lodash/upperFirst';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';

import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import ImporterValidator from 'chaire-lib-common/lib/services/importers/ImporterValidator';
import FileUploaderHOC, { FileUploaderHOCProps } from 'chaire-lib-frontend/lib/components/input/FileUploaderHOC';

interface FileImportFormProps extends FileUploaderHOCProps {
    pluralizedObjectsName: string;
    fileNameWithExtension: string;
    label: string;
    closeImporter: React.MouseEventHandler;
    acceptsExtension?: string;
}

const FileImportForm: React.FunctionComponent<FileImportFormProps & WithTranslation> = (
    props: FileImportFormProps & WithTranslation
) => {
    const validator = props.validator as ImporterValidator;
    return (
        <form
            id={`tr__form-transit-${props.pluralizedObjectsName}-import`}
            className={`tr__form-transit-${props.pluralizedObjectsName}-import apptr__form`}
        >
            <h3>{props.t('main:Import')}</h3>

            <div className="tr__form-section">
                <div className="apptr__form-input-container _two-columns">
                    <label>{props.label}</label>
                    <InputFile
                        id={`formField${_upperFirst(props.pluralizedObjectsName)}ImporterFile${validator.get('id')}`}
                        accept={props.acceptsExtension}
                        inputRef={props.fileImportRef}
                        onChange={props.onChange}
                    />
                </div>
            </div>

            <div className="tr__form-buttons-container">
                <Button
                    icon={faUndoAlt}
                    iconClass="_icon"
                    label={props.t('main:Cancel')}
                    color="grey"
                    onClick={props.closeImporter}
                />
                {props.fileImportRef.current && props.fileImportRef.current.files?.length === 1 && (
                    <Button
                        icon={faUpload}
                        iconClass="_icon-alone"
                        label=""
                        color="blue"
                        onClick={() => {
                            // upload
                            const uploadIds = props.fileUploader.upload(props.fileImportRef.current, {
                                uploadTo: 'imports',
                                data: {
                                    objects: props.pluralizedObjectsName,
                                    filename: props.fileNameWithExtension
                                }
                            });
                        }}
                    />
                )}
            </div>

            <FormErrors errors={validator.getErrors()} />
        </form>
    );
};

export default FileUploaderHOC(withTranslation('main')(FileImportForm), ImporterValidator);
