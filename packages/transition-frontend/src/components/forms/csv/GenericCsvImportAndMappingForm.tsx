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
import { CsvFileMapper } from 'transition-common/lib/services/csv';
import FieldMappingsSelection from './widgets/FieldMappingsSelection';

interface GenericCsvImportAndMappingFormProps {
    csvFileMapper: CsvFileMapper;
    onUpdate: (csvFileMapper: CsvFileMapper, isReadyAndValid: boolean) => void;
    importFileName: string;
}
/**
 * Select a CSV file, map fields to required parameters, then upload file to
 * server
 *
 * @param {(GenericCsvImportAndMappingFormProps)} props
 * @return {*}
 */
const GenericCsvImportAndMappingForm: React.FunctionComponent<GenericCsvImportAndMappingFormProps> = (
    props: GenericCsvImportAndMappingFormProps
): any => {
    const [loading, setLoading] = React.useState(false);
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [readyToUpload, setReadyToUpload] = React.useState(false);
    const { upload, uploadStatus, resetFileUpload } = useFileUploader(false);
    const { t } = useTranslation(['transit', 'main']);
    const fileImportRef = React.useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

    const isMappingValidAndReady = (): boolean => {
        // current mapping needs to be valid
        if (!props.csvFileMapper.isValid()) {
            return false;
        }
        const fileLocation = props.csvFileMapper.getFileLocation();
        // If the file is not from server, the file needs to be uploaded
        if (fileLocation && fileLocation.location !== 'job' && uploadStatus.status !== 'completed') {
            return false;
        }
        return true;
    };

    const onCsvFileChange = async (file: File) => {
        setLoading(true);
        try {
            await props.csvFileMapper.setCsvFile(file, { location: 'upload' });
            resetFileUpload();
            setReadyToUpload(props.csvFileMapper.isValid());
            props.onUpdate(props.csvFileMapper!, isMappingValidAndReady());
        } finally {
            setLoading(false);
        }
    };

    const onValueChange = (path: string, newValue: { value: unknown; valid?: boolean }): void => {
        props.csvFileMapper.updateFieldMapping(path, newValue.value as string);
        const fileLocation = props.csvFileMapper.getFileLocation();
        setReadyToUpload(
            props.csvFileMapper.isValid() && fileLocation !== undefined && fileLocation.location !== 'job'
        );
        props.onUpdate(props.csvFileMapper!, isMappingValidAndReady());
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
        props.onUpdate(props.csvFileMapper, isMappingValidAndReady());
    }, []);

    React.useEffect(() => {
        props.onUpdate(props.csvFileMapper, isMappingValidAndReady());
        if (uploadStatus.status === 'completed') {
            // Just uploaded, no need to upload it again
            setReadyToUpload(false);
        }
    }, [uploadStatus.status]);

    const csvFileFields = props.csvFileMapper.getCsvFields();

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
                    mappingDescriptors={props.csvFileMapper.getMappingDescriptors()}
                    currentMappings={
                        props.csvFileMapper.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings || {}
                    }
                    csvFields={csvFileFields}
                />
            )}
            {csvFileFields.length !== 0 && (
                <React.Fragment>
                    <FormErrors errors={props.csvFileMapper.getErrors()} />
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
