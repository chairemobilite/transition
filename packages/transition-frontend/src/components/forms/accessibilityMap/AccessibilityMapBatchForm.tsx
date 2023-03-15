/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import Loader from 'react-spinners/BeatLoader';

import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import _get from 'lodash.get';
import _cloneDeep from 'lodash.clonedeep';
import _toString from 'lodash.tostring';
import { parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';
import slugify from 'slugify';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import TransitBatchAccessibilityMap, {
    accessibilityMapPreferencesPath
} from 'transition-common/lib/services/accessibilityMap/TransitBatchAccessibilityMap';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
// ** File upload
import FileUploaderHOC, { FileUploaderHOCProps } from 'chaire-lib-frontend/lib/components/input/FileUploaderHOC';
import { _toInteger, _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import BatchAttributesSelection from './widgets/BatchAttributesSelection';
import { BatchAccessibilityMapCalculator } from '../../../services/accessibilityMap/BatchAccessibilityMapCalculator';
import ExecutableJobComponent from '../../parts/executableJob/ExecutableJobComponent';

export interface BatchAccessibilityMapFormProps extends FileUploaderHOCProps {
    routingEngine: TransitAccessibilityMapRouting;
}

interface BatchAccessibilityMapFormState extends ChangeEventsState<TransitBatchAccessibilityMap> {
    scenarioCollection: any;
    cacheCsvAttributes: any;
    csvUploadedToServer: boolean;
    csvAttributes?: string[];
    csvContent: null;
    geojsonDownloadUrl: any;
    jsonDownloadUrl: any;
    csvDownloadUrl: any;
    batchRoutingInProgress: boolean;
    errors: ErrorMessage[];
    warnings: ErrorMessage[];
    csvFile?: File;
}

// TODO This class has A LOT in common with TransitRoutingBatchForm. We should
// try to extract what's common, but transitRouting and AccessibilityMap object
// do not have common parents, it's not trivial to extract the csv file widget
// part. That would require extending 2 different classes, which is possibly
// permitted in javascript, but not the cleanest.
class AccessibilityMapBatchForm extends ChangeEventsForm<
    BatchAccessibilityMapFormProps & WithTranslation,
    BatchAccessibilityMapFormState
> {
    constructor(props: BatchAccessibilityMapFormProps & WithTranslation) {
        super(props);

        const batchRoutingEngine = new TransitBatchAccessibilityMap(
            Object.assign(_cloneDeep(Preferences.get(accessibilityMapPreferencesPath, {}))),
            false,
            props.routingEngine
        );

        this.state = {
            object: batchRoutingEngine,
            formValues: {},
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            cacheCsvAttributes: _cloneDeep(Preferences.get(accessibilityMapPreferencesPath, {})),
            csvUploadedToServer: false,
            csvContent: null,
            geojsonDownloadUrl: null,
            jsonDownloadUrl: null,
            csvDownloadUrl: null,
            batchRoutingInProgress: false,
            errors: [],
            warnings: []
        };
    }

    onCsvFileChange = (file: File) => {
        // ** File upload

        const batchRouting = this.state.object;

        batchRouting.attributes.csvFile = { location: 'upload', filename: file.name };

        this.state.object.validate();

        this.setState({
            csvFile: file,
            object: batchRouting,
            csvAttributes: undefined,
            geojsonDownloadUrl: null,
            jsonDownloadUrl: null,
            csvDownloadUrl: null,
            csvUploadedToServer: false,
            errors: [],
            warnings: []
        });
    };

    onSubmitCsv = async () => {
        if (this.state.csvFile !== undefined) {
            const csvAttributes = await this.state.object.setCsvFile(this.state.csvFile, { location: 'upload' });
            this.setState({
                object: this.state.object,
                csvAttributes
            });
        }
    };

    onCalculationNameChange = (path: string, value: { value: any; valid?: boolean }) => {
        this.onValueChange(path, value);
    };

    onUploadCsv = () => {
        // ** File upload

        // upload csv file to server:
        const uploadIds = this.props.fileUploader.upload(this.props.fileImportRef.current, {
            uploadTo: 'imports',
            data: {
                objects: 'csv',
                filename: 'batchAccessMap.csv'
            }
        });

        this.state.object.updateRoutingPrefs();

        this.setState((oldState) => {
            return {
                csvUploadedToServer: true
            };
        });
    };

    onCalculateBatch = async () => {
        this.setState({
            batchRoutingInProgress: true,
            errors: [],
            warnings: []
        });
        try {
            const routingResult: any = await BatchAccessibilityMapCalculator.calculate(this.state.object);
            this.setState({
                batchRoutingInProgress: false,
                errors: routingResult.errors,
                warnings: routingResult.warnings
            });
        } catch (error) {
            this.setState({
                batchRoutingInProgress: false,
                errors: [TrError.isTrError(error) ? error.export().localizedMessage : String(error)],
                warnings: []
            });
        }
    };

    private setMaxParallelCalculators(max: number) {
        const batchRoutingEngine = this.state.object;
        batchRoutingEngine.attributes.maxCpuCount = max;
        batchRoutingEngine.attributes.cpuCount = Math.min(batchRoutingEngine.attributes.cpuCount || max, max);
        batchRoutingEngine.validate();
        this.setState({
            object: batchRoutingEngine
        });
    }

    componentDidMount() {
        serviceLocator.socketEventManager.emit('service.parallelThreadCount', (response) => {
            this.setMaxParallelCalculators(response.count);
        });
    }

    render() {
        if (!this.state.scenarioCollection) {
            return <LoadingPage />;
        }

        const accessMapRouting = this.state.object;
        const accessMapRoutingId = accessMapRouting.getId();

        const hasAllAttributesSet =
            !_isBlank(accessMapRouting.attributes.idAttribute) &&
            !_isBlank(accessMapRouting.attributes.xAttribute) &&
            !_isBlank(accessMapRouting.attributes.yAttribute) &&
            !_isBlank(accessMapRouting.attributes.timeAttribute) &&
            !_isBlank(accessMapRouting.attributes.timeFormat) &&
            !_isBlank(accessMapRouting.attributes.timeAttributeDepartureOrArrival);

        const slugifiedCalculationName = slugify(accessMapRouting.attributes.calculationName || '');

        const errors = this.state.errors;
        const warnings = this.state.warnings;

        return (
            <Collapsible trigger={this.props.t('transit:transitRouting:BatchAccessibilityMapCsv')} transitionTime={100}>
                <div className="tr__form-section">
                    {
                        /* not yet implemented */ false && this.state.csvAttributes && (
                            <div className="apptr__form-input-container _two-columns _small-inputs">
                                <label>{this.props.t('transit:transitRouting:WithGeometry')}</label>
                                <InputRadio
                                    id={`formFieldTransitBatchRoutingWithGeometry${accessMapRoutingId}`}
                                    value={accessMapRouting.attributes.withGeometries}
                                    sameLine={true}
                                    choices={[
                                        {
                                            value: true
                                        },
                                        {
                                            value: false
                                        }
                                    ]}
                                    localePrefix="transit:transitRouting:withGeometryChoices"
                                    t={this.props.t}
                                    isBoolean={true}
                                    onValueChange={(e) =>
                                        this.onValueChange('withGeometries', { value: _toBool(e.target.value) })
                                    }
                                />
                            </div>
                        )
                    }
                </div>
                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitRouting:CalculationName')}</label>
                        <InputString
                            id={`formFieldTransitBatchRoutingCalculationName${accessMapRoutingId}`}
                            value={accessMapRouting.attributes.calculationName}
                            onValueUpdated={(newValue) => this.onCalculationNameChange('calculationName', newValue)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('main:CsvFile')}</label>
                        <InputFile
                            id={`formFieldTransitBatchRoutingCsvFile${accessMapRoutingId}`}
                            accept={'.csv'}
                            inputRef={this.props.fileImportRef}
                            onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) this.onCsvFileChange(files[0]);
                            }}
                        />
                    </div>
                    {this.state.csvAttributes && (
                        <BatchAttributesSelection
                            onValueChange={this.onValueChange}
                            attributes={accessMapRouting.attributes}
                            csvAttributes={this.state.csvAttributes}
                        />
                    )}
                    {
                        <InputWrapper smallInput={true} label={this.props.t('transit:transitRouting:CpuCount')}>
                            <InputStringFormatted
                                id={`formFieldTransitBatchRoutingCpuCount${accessMapRoutingId}`}
                                value={accessMapRouting.attributes.cpuCount}
                                onValueUpdated={(value) => this.onValueChange('cpuCount', value)}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                type={'number'}
                            />
                        </InputWrapper>
                    }
                </div>

                {this.state.csvAttributes && <FormErrors errors={accessMapRouting.getErrors()} />}
                {errors.length > 0 && <FormErrors errors={errors} />}
                {warnings.length > 0 && <FormErrors errors={warnings} errorType="Warning" />}

                {
                    <div>
                        <div className="tr__form-buttons-container _right">
                            {!this.state.csvAttributes &&
                                accessMapRouting.attributes.csvFile &&
                                !this.state.batchRoutingInProgress && (
                                <Button
                                    icon={faUpload}
                                    iconClass="_icon-alone"
                                    label=""
                                    color="blue"
                                    onClick={this.onSubmitCsv}
                                />
                            )}
                            {this.state.batchRoutingInProgress && (
                                <Loader size={8} color={'#aaaaaa'} loading={true}></Loader>
                            )}
                            {this.state.csvAttributes &&
                                !this.state.csvUploadedToServer &&
                                !this.state.batchRoutingInProgress && (
                                <Button
                                    label={this.props.t('main:PrepareData')}
                                    color="green"
                                    onClick={this.onUploadCsv}
                                />
                            )}
                            {this.state.csvAttributes &&
                                this.state.csvUploadedToServer &&
                            /*!this.state.batchRoutingInProgress &&*/ accessMapRouting.validate() &&
                                hasAllAttributesSet && (
                                <Button
                                    label={this.props.t('main:Calculate')}
                                    color="green"
                                    onClick={this.onCalculateBatch}
                                />
                            )}
                        </div>
                    </div>
                }
                <ExecutableJobComponent defaultPageSize={5} jobType="batchAccessMap" />
            </Collapsible>
        );
    }
}

// ** File upload
//export default FileUploaderHOC(TransitRoutingForm, null, false);
export default FileUploaderHOC(withTranslation(['transit', 'main'])(AccessibilityMapBatchForm), undefined, false);
