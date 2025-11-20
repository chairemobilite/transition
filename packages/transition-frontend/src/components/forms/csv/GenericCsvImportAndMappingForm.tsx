/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';

import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import { useFileUploader } from 'chaire-lib-frontend/lib/components/input/FileUploaderHook';
import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { CsvFileAndFieldMapper } from 'transition-common/lib/services/csv';
import FieldMappingsSelection from './widgets/FieldMappingsSelection';

type GenericCsvImportAndMappingFormProps = {
    /**
     * The CsvFieldMapper instance to use for mapping and file management. It
     * contains the descriptors for the mappings.
     */
    csvFieldMapper: CsvFileAndFieldMapper;
    /**
     * Callback when the mapping is updated or the file is uploaded
     * @param csvFieldMapper The csv field mapper with current mapping and file
     * info
     * @param isReadyAndValid Will be true if the mapping is valid and the file
     * is ready to be used (uploaded or already on server)
     */
    onUpdate: (csvFieldMapper: CsvFileAndFieldMapper, isReadyAndValid: boolean) => void;
    /**
     * The name to use when uploading the file to the server.
     *
     * FIXME There is currently no way for users to delete and manage uploaded
     * files, so to avoid filling the upload directory, all uploads from a same
     * context will have the same name, overwriting previous uploads. Maybe
     * eventually drop this importFileName and just use the actual name of the
     * file, when we know how to clean them up.
     */
    importFileName: string;
};

/**
 * Select a CSV file, map fields to required parameters, then upload file to
 * server
 *
 * @param {(GenericCsvImportAndMappingFormProps)} props
 */
const GenericCsvImportAndMappingForm: React.FunctionComponent<GenericCsvImportAndMappingFormProps> = (
    props: GenericCsvImportAndMappingFormProps
) => {
    const [loading, setLoading] = React.useState(false);
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [readyToUpload, setReadyToUpload] = React.useState(false);
    const { upload, uploadStatus, resetFileUpload } = useFileUploader(false);
    const { t } = useTranslation(['transit', 'main']);
    const fileImportRef = React.useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

    const isMappingValidAndReady = (): boolean => {
        // current mapping needs to be valid
        if (!props.csvFieldMapper.isValid()) {
            return false;
        }
        const fileLocation = props.csvFieldMapper.getFileLocation();
        // If the file is not from server, the file needs to be uploaded
        if (fileLocation && fileLocation.location !== 'job' && uploadStatus.status !== 'completed') {
            return false;
        }
        return true;
    };

    const onCsvFileChange = async (file: File) => {
        setLoading(true);
        try {
            await props.csvFieldMapper.setCsvFileFromUpload(file, props.importFileName);
            resetFileUpload();
            setReadyToUpload(props.csvFieldMapper.isValid());
            props.onUpdate(props.csvFieldMapper, isMappingValidAndReady());
        } finally {
            setLoading(false);
        }
    };

    const onValueChange = (path: string, newValue: { value: unknown; valid?: boolean }): void => {
        props.csvFieldMapper.updateFieldMapping(path, newValue.value as string);
        const fileLocation = props.csvFieldMapper.getFileLocation();
        setReadyToUpload(
            props.csvFieldMapper.isValid() && fileLocation !== undefined && fileLocation.location !== 'job'
        );
        props.onUpdate(props.csvFieldMapper!, isMappingValidAndReady());
        setUpdateCnt(updateCnt + 1);
    };

    const onUpload = () => {
        if (fileImportRef.current.files && fileImportRef.current.files.length > 0) {
            const file = fileImportRef.current.files[0];
            upload(file, {
                uploadType: 'imports',
                data: {
                    objects: 'csv',
                    filename: props.importFileName
                }
            });
        }
    };

    React.useEffect(() => {
        // Validate on mount
        props.onUpdate(props.csvFieldMapper, isMappingValidAndReady());
    }, []);

    React.useEffect(() => {
        props.onUpdate(props.csvFieldMapper, isMappingValidAndReady());
        if (uploadStatus.status === 'completed') {
            // Just uploaded, no need to upload it again
            setReadyToUpload(false);
        }
    }, [uploadStatus.status, props.csvFieldMapper]);

    const csvFileFields = props.csvFieldMapper.getCsvFields();

    return (
        <div className="tr__form-section">
            <InputWrapper twoColumns={true} label={t('main:CsvFile')}>
                <InputFile
                    id={'formFieldCsvFile'}
                    accept={'.csv'}
                    inputRef={fileImportRef}
                    onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) onCsvFileChange(files[0]);
                    }}
                />
            </InputWrapper>
            {loading && <LoadingPage />}
            {!loading && csvFileFields.length !== 0 && (
                <FieldMappingsSelection
                    onValueChange={onValueChange}
                    mappingDescriptors={props.csvFieldMapper.getMappingDescriptors()}
                    currentMappings={
                        props.csvFieldMapper.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings || {}
                    }
                    csvFields={csvFileFields}
                />
            )}
            {csvFileFields.length !== 0 && (
                <React.Fragment>
                    <FormErrors errors={props.csvFieldMapper.getErrors()} />
                    {readyToUpload && (
                        <div className="tr__form-buttons-container">
                            <span title={t('transit:batchCalculation:UploadFile')}>
                                <Button
                                    disabled={!readyToUpload}
                                    key="next"
                                    color="blue"
                                    label={t('transit:batchCalculation:UploadFile')}
                                    icon={faUpload}
                                    iconClass="_icon-alone"
                                    onClick={onUpload}
                                />
                            </span>
                        </div>
                    )}
                </React.Fragment>
            )}
        </div>
    );
};

export default GenericCsvImportAndMappingForm;
