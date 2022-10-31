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
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import TransitBatchRouting from 'transition-common/lib/services/transitRouting/TransitBatchRouting';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
// ** File upload
import FileUploaderHOC from 'chaire-lib-frontend/lib/components/input/FileUploaderHOC';
import { _toInteger, _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import BatchAttributesSelection from './widgets/BatchAttributesSelection';
import BatchSaveToDb from './widgets/BatchSaveToDb';
import ExecutableJobComponent from '../../parts/executableJob/ExecutableJobComponent';

export interface TransitBatchRoutingFormProps extends WithTranslation {
    addEventListeners?: () => void;
    removeEventListeners?: () => void;
    fileUploader?: any;
    fileImportRef?: any;
    routingEngine: TransitRouting;
}

interface TransitBatchRoutingFormState extends ChangeEventsState<TransitBatchRouting> {
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
    // array of trRouting raw results
    detailedResult: any;
}

// TODO tahini type this class
class TransitRoutingBatchForm extends ChangeEventsForm<TransitBatchRoutingFormProps, TransitBatchRoutingFormState> {
    private fileReader: any;

    constructor(props: TransitBatchRoutingFormProps) {
        super(props);

        const batchRoutingEngine = new TransitBatchRouting(
            Object.assign(_cloneDeep(Preferences.get('transit.routing.batch')), { saveToDb: false }),
            false,
            props.routingEngine
        );

        this.state = {
            object: batchRoutingEngine,
            formValues: {},
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            cacheCsvAttributes: _cloneDeep(Preferences.get('transit.routing.batch')),
            csvUploadedToServer: false,
            csvContent: null,
            geojsonDownloadUrl: null,
            jsonDownloadUrl: null,
            csvDownloadUrl: null,
            batchRoutingInProgress: false,
            errors: [],
            warnings: [],
            detailedResult: []
        };

        this.onCalculationNameChange = this.onCalculationNameChange.bind(this);

        this.onSubmitCsv = this.onSubmitCsv.bind(this);
        this.onCsvFileChange = this.onCsvFileChange.bind(this);
        this.onUploadCsv = this.onUploadCsv.bind(this);
        this.onCalculateBatch = this.onCalculateBatch.bind(this);

        // ** File upload
        if (!serviceLocator.hasService('fileReader')) {
            serviceLocator.addService('fileReader', new FileReader());
        }
        this.fileReader = serviceLocator.fileReader;
    }

    onCsvFileChange(file) {
        // ** File upload

        const batchRouting = this.state.object;

        batchRouting.attributes.csvFile = file;

        this.state.object.validate();

        this.setState({
            object: batchRouting,
            csvAttributes: undefined,
            geojsonDownloadUrl: null,
            jsonDownloadUrl: null,
            csvDownloadUrl: null,
            csvUploadedToServer: false,
            errors: [],
            warnings: []
        });
    }

    onSubmitCsv() {
        parseCsvFile(
            this.state.object.get('csvFile'),
            (data) => {
                const csvAttributes = Object.keys(data);
                const batchRouting = this.state.object;
                if (
                    batchRouting.attributes.idAttribute &&
                    !csvAttributes.includes(batchRouting.attributes.idAttribute)
                ) {
                    batchRouting.attributes.idAttribute = undefined;
                }
                if (
                    batchRouting.attributes.originXAttribute &&
                    !csvAttributes.includes(batchRouting.attributes.originXAttribute)
                ) {
                    batchRouting.attributes.originXAttribute = undefined;
                }
                if (
                    batchRouting.attributes.originYAttribute &&
                    !csvAttributes.includes(batchRouting.attributes.originYAttribute)
                ) {
                    batchRouting.attributes.originYAttribute = undefined;
                }
                if (
                    batchRouting.attributes.destinationXAttribute &&
                    !csvAttributes.includes(batchRouting.attributes.destinationXAttribute)
                ) {
                    batchRouting.attributes.destinationXAttribute = undefined;
                }
                if (
                    batchRouting.attributes.destinationYAttribute &&
                    !csvAttributes.includes(batchRouting.attributes.destinationYAttribute)
                ) {
                    batchRouting.attributes.destinationYAttribute = undefined;
                }
                if (
                    batchRouting.attributes.timeAttribute &&
                    !csvAttributes.includes(batchRouting.attributes.timeAttribute)
                ) {
                    batchRouting.attributes.timeAttribute = undefined;
                }

                this.setState({
                    object: batchRouting,
                    csvAttributes
                });
            },
            {
                header: true,
                nbRows: 1 // only get the header
            }
        );
    }

    onCalculationNameChange(path: string, value: { value: any; valid?: boolean }) {
        this.onValueChange(path, value);
    }

    onUploadCsv() {
        // ** File upload

        // upload csv file to server:
        const uploadIds = this.props.fileUploader.upload(this.props.fileImportRef.current, {
            uploadTo: 'imports',
            data: {
                objects: 'csv',
                filename: 'batchRouting.csv'
            }
        });

        this.state.object.updateRoutingPrefs();

        this.setState((oldState) => {
            return {
                csvUploadedToServer: true
            };
        });
    }

    async onCalculateBatch() {
        this.setState({
            batchRoutingInProgress: true,
            errors: [],
            warnings: []
        });
        const attributes = this.state.object.attributes;
        try {
            const routingResult: any = await this.state.object.calculate(true);
            this.setState({
                batchRoutingInProgress: false,
                detailedResult: routingResult.results,
                errors: routingResult.errors,
                warnings: routingResult.warnings
            });
            if (attributes.saveToDb !== false && attributes.saveToDb.type === 'new') {
                await serviceLocator.collectionManager
                    .get('dataSources')
                    .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
                serviceLocator.collectionManager.refresh('dataSources');
            }
        } catch (error) {
            this.setState({
                batchRoutingInProgress: false,
                detailedResult: [],
                errors: [TrError.isTrError(error) ? error.export().localizedMessage : String(error)],
                warnings: []
            });
        }
    }

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
        if (this.props.addEventListeners) this.props.addEventListeners();

        serviceLocator.socketEventManager.emit('service.parallelThreadCount', (response) => {
            this.setMaxParallelCalculators(response.count);
        });
    }

    componentWillUnmount() {
        if (this.props.removeEventListeners) this.props.removeEventListeners();
    }

    render() {
        if (!this.state.scenarioCollection) {
            return <LoadingPage />;
        }

        const batchRouting = this.state.object;
        const batchRoutingId = batchRouting.getId();

        const hasAllAttributesSet =
            !_isBlank(batchRouting.attributes.idAttribute) &&
            !_isBlank(batchRouting.attributes.originXAttribute) &&
            !_isBlank(batchRouting.attributes.originYAttribute) &&
            !_isBlank(batchRouting.attributes.destinationXAttribute) &&
            !_isBlank(batchRouting.attributes.destinationYAttribute) &&
            !_isBlank(batchRouting.attributes.timeAttribute) &&
            !_isBlank(batchRouting.attributes.timeFormat) &&
            !_isBlank(batchRouting.attributes.timeAttributeDepartureOrArrival);

        const errors = this.state.errors;
        const warnings = this.state.warnings;

        return (
            <Collapsible trigger={this.props.t('transit:transitRouting:BatchRoutingCsv')} transitionTime={100}>
                <div className="tr__form-section">
                    {/* not yet implemented */ false && this.state.csvAttributes && (
                        <div className="apptr__form-input-container _two-columns _small-inputs">
                            <label>{this.props.t('transit:transitRouting:WithGeometry')}</label>
                            <InputRadio
                                id={`formFieldTransitBatchRoutingWithGeometry${batchRoutingId}`}
                                value={batchRouting.attributes.withGeometries}
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
                    )}
                </div>
                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitRouting:CalculationName')}</label>
                        <InputString
                            id={`formFieldTransitBatchRoutingCalculationName${batchRoutingId}`}
                            value={batchRouting.attributes.calculationName}
                            onValueUpdated={(newValue) => this.onCalculationNameChange('calculationName', newValue)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('main:CsvFile')}</label>
                        <InputFile
                            id={`formFieldTransitBatchRoutingCsvFile${batchRoutingId}`}
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
                            attributes={batchRouting.attributes}
                            csvAttributes={this.state.csvAttributes}
                        />
                    )}
                    {this.state.csvAttributes &&
                        Preferences.get('transit.routing.batch.allowSavingOdTripsToDb', false) && (
                        <BatchSaveToDb
                            onValueChange={this.onValueChange}
                            attributes={batchRouting.attributes}
                            defaultDataSourceName={batchRouting.attributes.csvFile.name || ''}
                        />
                    )}
                    {
                        <InputWrapper smallInput={true} label={this.props.t('transit:transitRouting:CpuCount')}>
                            <InputStringFormatted
                                id={`formFieldTransitBatchRoutingCpuCount${batchRoutingId}`}
                                value={batchRouting.attributes.cpuCount}
                                onValueUpdated={(value) => this.onValueChange('cpuCount', value)}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                type={'number'}
                            />
                        </InputWrapper>
                    }
                </div>

                {this.state.csvAttributes && <FormErrors errors={batchRouting.getErrors()} />}
                {errors.length > 0 && <FormErrors errors={errors} />}
                {warnings.length > 0 && <FormErrors errors={warnings} errorType="Warning" />}

                {
                    <div>
                        <div className="tr__form-buttons-container _right">
                            {!this.state.csvAttributes &&
                                batchRouting.attributes.csvFile &&
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
                            /*!this.state.batchRoutingInProgress &&*/ batchRouting.validate() &&
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
                <ExecutableJobComponent defaultPageSize={5} jobType="batchRoute" />
            </Collapsible>
        );
    }
}

// ** File upload
//export default FileUploaderHOC(TransitRoutingForm, null, false);
export default FileUploaderHOC(withTranslation(['transit', 'main'])(TransitRoutingBatchForm), undefined, false);
