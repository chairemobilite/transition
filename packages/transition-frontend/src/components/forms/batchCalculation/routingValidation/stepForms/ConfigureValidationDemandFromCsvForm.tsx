/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _cloneDeep from 'lodash/cloneDeep';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';

import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import { useFileUploader } from 'chaire-lib-frontend/lib/components/input/FileUploaderHook';
import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import TransitValidationDemandFromCsv, {
    TransitValidationDemandFromCsvAttributes
} from 'transition-common/lib/services/transitDemand/TransitValidationDemandFromCsv';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import BatchValidationAttributesSelection from '../../../transitRouting/widgets/BatchValidationAttributesSelection';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { TransitValidationDemandFromCsvFile } from '../../../../../services/transitDemand/frontendTypes';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';

interface ConfigureValidationDemandFromCsvFormProps {
    currentDemand?: TransitValidationDemandFromCsvFile;
    onComplete: (demand: TransitValidationDemandFromCsvFile) => void;
    onFileReset: () => void;
}
/**
 * Select a CSV file, map fields to required parameters, then upload file to
 * server
 *
 * @param {(ConfigureValidationDemandFromCsvFormProps)} props
 * @return {*}
 */
const ConfigureValidationDemandFromCsvForm: React.FunctionComponent<ConfigureValidationDemandFromCsvFormProps> = (
    props: ConfigureValidationDemandFromCsvFormProps
): any => {
    const [demand] = React.useState(
        props.currentDemand?.demand ||
            new TransitValidationDemandFromCsv(
                _cloneDeep(Preferences.get('transit.validation.batch', {})),
                false
            )
    );
    const [csvFileAttributes, setCsvFileAttributes] = React.useState<string[]>(props.currentDemand?.csvFields || []);
    const [loading, setLoading] = React.useState(false);
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [readyToUpload, setReadyToUpload] = React.useState(false);
    const { upload, uploadStatus } = useFileUploader(false);
    const { t } = useTranslation(['transit', 'main']);
    const fileImportRef = React.useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

    const onCsvFileChange = async (file: File) => {
        setLoading(true);
        try {
            setCsvFileAttributes(await demand.setCsvFile(file, { location: 'upload' }));
            setReadyToUpload(demand.validate());
            props.onFileReset();
        } finally {
            setLoading(false);
        }
    };

    const onValueChange = (
        path: keyof TransitValidationDemandFromCsvAttributes,
        newValue: { value: unknown; valid?: boolean }
    ): void => {
        demand.attributes[path] = newValue.value as never;
        if (demand.attributes.csvFile?.location === 'upload') {
            setReadyToUpload(demand.validate());
        }
        setUpdateCnt(updateCnt + 1);
    };

    const onUpload = () => {
        if (fileImportRef.current.files && fileImportRef.current.files.length > 0) {
            const file = fileImportRef.current.files[0];
            upload(file, {
                uploadType: 'imports',
                data: {
                    objects: 'csv',
                    filename: 'batchValidation.csv'
                }
            });
        }

        demand.updateRoutingPrefs();
    };

    React.useEffect(() => {
        if (demand.attributes.csvFile?.location === 'server' && demand.validate()) {
            props.onComplete({ type: 'csv', demand, csvFields: csvFileAttributes });
        }
    }, []);

    React.useEffect(() => {
        if (uploadStatus.status === 'completed') {
            props.onComplete({ type: 'csv', demand, csvFields: csvFileAttributes });
        }
    }, [uploadStatus.status]);

    return (
        <div className="tr__form-section">
            <InputWrapper twoColumns={true} label={t('main:CsvFile')}>
                <InputFile
                    id={'formFieldTransitDemandCsvFile'}
                    accept={'.csv'}
                    inputRef={fileImportRef}
                    onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) onCsvFileChange(files[0]);
                    }}
                />
            </InputWrapper>
            {loading && <LoadingPage />}
            {!loading && csvFileAttributes.length !== 0 && (
                <BatchValidationAttributesSelection
                    onValueChange={onValueChange}
                    attributes={demand.attributes}
                    csvAttributes={csvFileAttributes}
                />
            )}
            {csvFileAttributes.length !== 0 && (
                <React.Fragment>
                    <FormErrors errors={demand.getErrors()} />
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

export default ConfigureValidationDemandFromCsvForm;
