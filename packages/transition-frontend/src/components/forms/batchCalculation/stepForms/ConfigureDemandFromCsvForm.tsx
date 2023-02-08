/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _cloneDeep from 'lodash.clonedeep';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';

import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import FileUploaderHOC, { FileUploaderHOCProps } from 'chaire-lib-frontend/lib/components/input/FileUploaderHOC';
import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import TransitOdDemandFromCsv, {
    TransitOdDemandFromCsvAttributes
} from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import BatchAttributesSelection from '../../transitRouting/widgets/BatchAttributesSelection';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { TransitDemandFromCsvFile } from '../../../../services/transitDemand/types';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';

interface ConfigureDemandFromCsvFormProps {
    currentDemand?: TransitDemandFromCsvFile;
    onComplete: (demand: TransitDemandFromCsvFile) => void;
    onFileReset: () => void;
}
/**
 * Select a CSV file, map fields to required parameters, then upload file to
 * server
 *
 * @param {(ConfigureDemandFromCsvFormProps & FileUploaderHOCProps &
 * WithTranslation)} props
 * @return {*}
 */
const ConfigureDemandFromCsvForm: React.FunctionComponent<
    ConfigureDemandFromCsvFormProps & FileUploaderHOCProps & WithTranslation
> = (props: ConfigureDemandFromCsvFormProps & FileUploaderHOCProps & WithTranslation) => {
    const [demand] = React.useState(
        props.currentDemand?.demand ||
            new TransitOdDemandFromCsv(
                Object.assign(_cloneDeep(Preferences.get('transit.routing.batch')), { saveToDb: false }),
                false
            )
    );
    const [csvFileAttributes, setCsvFileAttributes] = React.useState<string[]>(props.currentDemand?.csvFields || []);
    const [loading, setLoading] = React.useState(false);
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [ready, setReady] = React.useState(false);

    const onCsvFileChange = async (file) => {
        setLoading(true);
        try {
            setCsvFileAttributes(await demand.setCsvFile(file));
            setReady(demand.validate());
            props.onFileReset();
        } finally {
            setLoading(false);
        }
    };

    const onValueChange = (
        path: keyof TransitOdDemandFromCsvAttributes,
        newValue: { value: unknown; valid?: boolean }
    ): void => {
        demand.attributes[path] = newValue.value as never;
        setReady(demand.validate());
        setUpdateCnt(updateCnt + 1);
    };

    const onUpload = () => {
        // upload csv file to server:
        props.fileUploader.upload(props.fileImportRef.current, {
            uploadTo: 'imports',
            data: {
                objects: 'csv',
                filename: 'batchRouting.csv'
            }
        });

        demand.updateRoutingPrefs();
    };

    React.useEffect(() => {
        if (props.uploadStatus.status === 'completed') {
            props.onComplete({ type: 'csv', demand, csvFields: csvFileAttributes });
        }
    }, [props.uploadStatus.status]);

    return (
        <div className="tr__form-section">
            <InputWrapper twoColumns={true} label={props.t('main:CsvFile')}>
                <InputFile
                    id={'formFieldTransitDemandCsvFile'}
                    accept={'.csv'}
                    inputRef={props.fileImportRef}
                    onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) onCsvFileChange(files[0]);
                    }}
                />
            </InputWrapper>
            {loading && <LoadingPage />}
            {!loading && csvFileAttributes.length !== 0 && (
                <BatchAttributesSelection
                    onValueChange={onValueChange}
                    attributes={demand.attributes}
                    csvAttributes={csvFileAttributes}
                />
            )}
            {csvFileAttributes.length !== 0 && (
                <React.Fragment>
                    <FormErrors errors={demand.getErrors()} />
                    {ready && (
                        <div className="tr__form-buttons-container">
                            <span title={props.t('transit:batchCalculation:UploadFile')}>
                                <Button
                                    disabled={!ready}
                                    key="next"
                                    color="blue"
                                    label={props.t('transit:batchCalculation:UploadFile')}
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

export default FileUploaderHOC(withTranslation(['transit', 'main'])(ConfigureDemandFromCsvForm), undefined, false);
