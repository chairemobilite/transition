/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import _get from 'lodash/get';
import Loader from 'react-spinners/BeatLoader';
import SocketIOFileClient from 'socket.io-file-client';
import { withTranslation, WithTranslation } from 'react-i18next';

import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputCheckbox, { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import GtfsValidator from 'transition-common/lib/services/importers/GtfsValidator';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsConstants, GtfsImportStatus } from 'transition-common/lib/api/gtfs';
import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import GtfsImportServiceComponent from './GtfsImportServiceComponent';
import GtfsImportAgenciesComponent from './GtfsImportAgenciesComponent';
import GtfsImportNodesComponent from './GtfsImportNodesComponent';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';

type GtfsImportProps = WithTranslation;

interface GtfsImportState {
    validator: GtfsValidator;
    gtfsDataImported: boolean;
    operationInProgress: boolean;
    uploadError: boolean;
    availableImportData: GtfsImportData;
}

class GtfsImportForm extends React.Component<GtfsImportProps, GtfsImportState> {
    private _fileImportRef: React.RefObject<HTMLInputElement>;
    private _zipFileUploader: any;

    constructor(props: GtfsImportProps) {
        super(props);

        this.state = {
            validator: new GtfsValidator({}),
            gtfsDataImported: false,
            operationInProgress: false,
            uploadError: false,
            availableImportData: {
                agencies: [],
                lines: [],
                services: []
            }
        };

        this._fileImportRef = React.createRef() as React.RefObject<HTMLInputElement>;
        this._zipFileUploader = new SocketIOFileClient(serviceLocator.socketEventManager._eventManager, {
            chunkSize: Preferences.current.socketUploadChunkSize
        });
    }

    updateValidator(path, value, stateChange = {}) {
        const validator = this.state.validator;
        validator.set(path, value);
        if (!_isBlank(validator.isValid)) {
            validator.validate();
        }
        this.setState({
            validator: validator,
            uploadError: false,
            ...stateChange
        });
    }

    updateSelection(path: 'agency' | 'line' | 'service', value, stateChange = {}) {
        const importData = this.state.availableImportData;
        if (!importData) {
            return;
        }
        switch (path) {
        case 'agency':
            importData.agencies.forEach((agency) => (agency.selected = value.includes(agency.agency.agency_id)));
            // Unselect lines from unselected agencies
            importData.lines
                .filter((line) => !value.includes(line.line.agency_id) && line.selected)
                .forEach((line) => (line.selected = false));
            break;
        case 'line':
            importData.lines.forEach((line) => (line.selected = value.includes(line.line.route_id)));
            break;
        case 'service':
            importData.services.forEach((service) => (service.selected = value.includes(service.service.name)));
            break;
        }
        this.setState({
            availableImportData: importData,
            ...stateChange
        });
    }

    updateSelectedValue = (path: keyof GtfsImportData, value: string | boolean | number | undefined) => {
        const importData = this.state.availableImportData;
        if (!importData) {
            return;
        }
        importData[path] = value;
        this.setState({
            availableImportData: importData
        });
    };

    componentDidMount() {
        this._zipFileUploader.on('start', this.onZipFileUploadStart);
        this._zipFileUploader.on('stream', this.onZipFileUploadStream);
        this._zipFileUploader.on('complete', this.onZipFileUploadComplete);
        this._zipFileUploader.on('error', this.onZipFileUploadError);
        this._zipFileUploader.on('abort', this.onZipFileUploadAbort);

        serviceLocator.socketEventManager.on('gtfsImporter.gtfsFileUnzipped', this.onGtfsFileUnzipped);
        serviceLocator.socketEventManager.on('gtfsImporter.gtfsFilePrepared', this.onGtfsFilePrepared);
        serviceLocator.socketEventManager.on(GtfsConstants.GTFS_DATA_IMPORTED, this.onGtfsDataImported);
        serviceLocator.socketEventManager.on('gtfsImporter.gtfsUploadError', this.onZipFileUploadError);
    }

    componentWillUnmount() {
        this._zipFileUploader.off('start', this.onZipFileUploadStart);
        this._zipFileUploader.off('stream', this.onZipFileUploadStream);
        this._zipFileUploader.off('complete', this.onZipFileUploadComplete);
        this._zipFileUploader.off('error', this.onZipFileUploadError);
        this._zipFileUploader.off('abort', this.onZipFileUploadAbort);

        serviceLocator.socketEventManager.off('gtfsImporter.gtfsFileUnzipped', this.onGtfsFileUnzipped);
        serviceLocator.socketEventManager.off('gtfsImporter.gtfsFilePrepared', this.onGtfsFilePrepared);
        serviceLocator.socketEventManager.off(GtfsConstants.GTFS_DATA_IMPORTED, this.onGtfsDataImported);
        serviceLocator.socketEventManager.off('gtfsImporter.gtfsUploadError', this.onZipFileUploadError);
    }

    onZipFileUploadStart = (_fileInfo) => {
        serviceLocator.eventManager.emit('progress', { name: 'UploadingGtfsFile', progress: 0.0 });
        //console.log('GTFS file start uploading', fileInfo);
    };

    onZipFileUploadStream = (_fileInfo) => {
        //console.log('GTFS file streaming... sent ' + fileInfo.sent + ' bytes.');
    };

    onZipFileUploadComplete = (fileInfo: any) => {
        serviceLocator.eventManager.emit('progress', { name: 'UploadingGtfsFile', progress: 1.0 });

        console.log('GTFS file upload Complete', fileInfo);

        const validator = this.state.validator;
        validator.set('isUploaded', true);

        this.setState({ validator: validator });
    };

    onZipFileUploadError = (error) => {
        console.log('GTFS file upload error!', error);
        this.setState({ uploadError: true });
    };
    onZipFileUploadAbort = (fileInfo) => {
        console.log('GTFS file upload aborted: ', fileInfo);
    };

    onGtfsFileUnzipped = () => {
        console.log('gtfsImporter.unzippedAll');
    };

    onGtfsFilePrepared = (validatorAttributes: GtfsImportData) => {
        const validator = this.state.validator;
        validator.set(
            'defaultLayoverRatioOverTotalTravelTime',
            Preferences.current.transit.paths.defaultLayoverRatioOverTotalTravelTime
        );
        validator.set('defaultMinLayoverTimeSeconds', Preferences.current.transit.paths.defaultMinLayoverTimeSeconds);
        console.log('gtfsImporter.prepared', validator);
        validator.set('isPrepared', true);
        if (validatorAttributes.stopAggregationWalkingRadiusSeconds === undefined) {
            validatorAttributes.stopAggregationWalkingRadiusSeconds = Preferences.get(
                'transit.nodes.defaultStopAggregationWalkingRadiusSecondsWhenImportingFromGtfs',
                60
            );
        }
        if (validatorAttributes.nodes_color === undefined) {
            validatorAttributes.nodes_color = Preferences.get('transit.nodes.defaultColor', '#0086FF');
        }
        this.setState({
            validator: validator,
            gtfsDataImported: false,
            uploadError: false,
            availableImportData: validatorAttributes
        });
    };

    onGtfsDataImported = async (importResult: GtfsImportStatus) => {
        const validator = this.state.validator;

        if (importResult.status === 'failed') {
            validator.set('errors', importResult.errors);
        } else {
            validator.set('errors', importResult.errors);
            validator.set('warnings', importResult.warnings);
        }

        try {
            await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
            await serviceLocator.collectionManager
                .get('lines')
                .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
            await serviceLocator.collectionManager
                .get('agencies')
                .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
            await serviceLocator.collectionManager
                .get('nodes')
                .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
            await serviceLocator.collectionManager
                .get('services')
                .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        } catch (error) {
            console.log(error);
        }
        serviceLocator.eventManager.emit('progress', {
            name: 'ImportingGtfsData',
            progress: 1.0
        });
        serviceLocator.collectionManager.refresh('nodes');
        serviceLocator.collectionManager.refresh('agencies');
        serviceLocator.collectionManager.refresh('lines');
        serviceLocator.collectionManager.refresh('services');
        serviceLocator.collectionManager.refresh('paths');
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitPaths: serviceLocator.collectionManager.get('paths').toGeojson(),
            transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson()
        });
        this.setState({
            validator: validator,
            gtfsDataImported: true,
            operationInProgress: false
        });
        if (validator.getErrors().length === 0 && validator.attributes.warnings.length === 0) {
            serviceLocator.eventManager.emit('section.change', 'agencies');
        }
    };

    importGtfsData = (e) => {
        const validator = this.state.validator;
        const { periodsGroupShortname, ...rest } = this.state.availableImportData;
        // import
        if (this.state.operationInProgress) {
            console.log('Another operation is in progress');
            return;
        }
        if (validator.validatePeriodsGroup()) {
            this.setState({ operationInProgress: true });
            serviceLocator.eventManager.emit('progress', {
                name: 'ImportingGtfsData',
                progress: 0.0
            });
            // TODO Add the period group here
            serviceLocator.socketEventManager.emit(GtfsConstants.GTFS_IMPORT_DATA, {
                ...rest,
                periodsGroupShortname: validator.getAttributes().periodsGroupShortname
            });
        } else {
            this.setState({ validator: validator });
        }
    };

    render() {
        const validator = this.state.validator;
        const availableImportData = this.state.availableImportData;

        const validatorId = validator.getId();

        const selectedAgencies =
            availableImportData?.agencies
                .filter((agency) => agency.selected === true)
                .map((agency) => agency.agency.agency_id) || [];
        const selectedAgenciesCount = selectedAgencies.length;

        const selectedServices =
            availableImportData?.services
                .filter((service) => service.selected === true)
                .map((service) => service.service.name || '') || [];
        const selectedServicesCount = selectedServices.length;

        const selectedLines =
            availableImportData?.lines.filter((line) => line.selected === true).map((line) => line.line.route_id) || [];
        const selectedLinesCount = selectedLines.length;

        const linesChoices =
            availableImportData?.lines
                .filter((line) => selectedAgencies.includes(line.line.agency_id))
                .map((line) => ({
                    value: line.line.route_id,
                    label: line.line.route_short_name + ' ' + line.line.route_long_name
                })) || [];

        const periodsGroups = Preferences.current.transit.periods;
        const periodsGroupShortname = validator.getAttributes().periodsGroupShortname;
        const periodsGroup = periodsGroupShortname ? periodsGroups[periodsGroupShortname] : null;
        if (periodsGroup) {
            availableImportData.periodsGroup = periodsGroup;
        }
        const periodsGroupChoices: { value: string; label: string }[] = [];
        for (const periodsGroupShortname in periodsGroups) {
            const periodsGroup = periodsGroups[periodsGroupShortname];
            if (periodsGroup) {
                periodsGroupChoices.push({
                    value: periodsGroupShortname,
                    label: periodsGroup.name[this.props.i18n.language] || periodsGroupShortname
                });
            }
        }

        const errors = [...(validator.getErrors() || [])];
        const warnings = validator.getAttributes().warnings || [];
        if (this.state.uploadError) {
            errors.push('transit:gtfs:errors:ErrorUploadingFile');
        }

        return (
            <form id="tr__form-transit-gtfs-import" className="tr__form-transit-gtfs-import apptr__form">
                <h3>{this.props.t('transit:gtfs:Import')}</h3>

                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:gtfs:ZipFile')}</label>
                        <InputFile
                            id={`formFieldTransitGtfsImporterFile${validatorId}`}
                            accept=".zip"
                            inputRef={this._fileImportRef}
                            onChange={(e) => {
                                this.setState({
                                    validator: new GtfsValidator({}),
                                    uploadError: false
                                });
                            }}
                        />
                    </div>
                </div>
                <div className="tr__form-buttons-container">
                    {this._fileImportRef.current && this._fileImportRef.current.files?.length === 1 && (
                        <Button
                            icon={faUpload}
                            iconClass="_icon-alone"
                            label=""
                            color="blue"
                            onClick={() => {
                                // upload
                                this._zipFileUploader.upload(this._fileImportRef.current, {
                                    uploadTo: 'gtfs',
                                    data: {
                                        objects: 'gtfs',
                                        filename: 'import.zip'
                                    }
                                });
                            }}
                        />
                    )}
                </div>
                <div className="tr__form-section">
                    {(this.state.validator.get('isPrepared') as boolean) && (
                        <div className="apptr__form-input-container">{this.props.t('transit:gtfs:NewOrUpdate')}</div>
                    )}
                    {availableImportData?.agencies.length > 0 && (
                        <div className="apptr__form-input-container">
                            <label className="_flex">{this.props.t('transit:gtfs:SelectedAgencies')}</label>
                            <GtfsImportAgenciesComponent
                                agencies={availableImportData?.agencies}
                                id={`formFieldTransitGtfsImporterSelectedAgencies${validatorId}`}
                                value={selectedAgencies}
                                onSelectionChange={(e) =>
                                    this.updateSelection('agency', e.target.value, {
                                        gtfsDataImported: false
                                    })
                                }
                                onAgencyDataUpdated={(agenciesData) =>
                                    this.setState({
                                        availableImportData: Object.assign({}, this.state.availableImportData, {
                                            agencies: agenciesData
                                        })
                                    })
                                }
                                allowSelectAll={true}
                            />
                        </div>
                    )}
                    {availableImportData?.agencies.length > 0 && (
                        <div className="apptr__form-input-container _two-columns">
                            <label className="_flex">{this.props.t('transit:gtfs:DefaultAgencyColor')}</label>
                            <InputColor
                                id={`formFieldTransitGtfsImporterFileDefaultAgencyColor${validatorId}`}
                                value={availableImportData.agencies_color}
                                defaultColor={Preferences.get('transit.agencies.defaultColor', '#0086FF')}
                                onValueChange={(e) => this.updateSelectedValue('agencies_color', e.target.value)}
                            />
                        </div>
                    )}
                    {linesChoices.length > 0 && (
                        <div className="apptr__form-input-container">
                            <label className="_flex">{this.props.t('transit:gtfs:SelectedLines')}</label>
                            <InputCheckbox
                                choices={linesChoices}
                                id={`formFieldTransitGtfsImporterSelectedLines${validatorId}`}
                                value={selectedLines}
                                onValueChange={(e) =>
                                    this.updateSelection('line', e.target.value, { gtfsDataImported: false })
                                }
                                allowSelectAll={true}
                            />
                        </div>
                    )}
                    {availableImportData?.services.length > 0 && (
                        <div className="apptr__form-input-container">
                            <label className="_flex">{this.props.t('transit:gtfs:SelectedServices')}</label>
                            <GtfsImportServiceComponent
                                services={availableImportData?.services}
                                id={`formFieldTransitGtfsImporterSelectedServices${validatorId}`}
                                value={selectedServices}
                                onValueChange={(e) =>
                                    this.updateSelection('service', e.target.value, {
                                        gtfsDataImported: false
                                    })
                                }
                                allowSelectAll={true}
                            />
                        </div>
                    )}
                    {availableImportData?.services.length > 1 && (
                        <div className="apptr__form-input-container">
                            <InputCheckboxBoolean
                                id={`formFieldTransitGtfsImporterServiceMerge${validatorId}`}
                                isChecked={availableImportData.mergeSameDaysServices}
                                label={this.props.t('transit:gtfs:MergeSamePeriodServices')}
                                onValueChange={(e) =>
                                    this.updateSelectedValue('mergeSameDaysServices', e.target.value === true)
                                }
                            />
                        </div>
                    )}
                    {availableImportData?.agencies.length > 0 && availableImportData?.services.length > 0 && (
                        <div className="apptr__form-input-container">
                            <GtfsImportNodesComponent
                                id={validatorId}
                                updateSelectedValue={this.updateSelectedValue}
                                gtfsImportData={availableImportData}
                            />
                        </div>
                    )}
                    {selectedServicesCount > 0 && (
                        <div className="apptr__form-input-container ">
                            <label>{this.props.t('transit:transitSchedule:PeriodsGroup')}</label>
                            <InputSelect
                                id={`formFieldTransitGtfsImporterPeriodsGroup${validatorId}`}
                                value={validator.getAttributes().periodsGroupShortname}
                                choices={periodsGroupChoices}
                                t={this.props.t}
                                onValueChange={(e) => this.updateValidator('periodsGroupShortname', e.target.value)}
                            />
                        </div>
                    )}
                    {selectedServicesCount > 0 && (
                        <div className="apptr__form-input-container">
                            <InputWrapper
                                twoColumns={true}
                                label={''}
                                help={this.props.t('transit:gtfs:GenerateFrequencyBasedSchedulesHelp')}
                            >
                                <InputCheckboxBoolean
                                    id={`formFieldTransitGtfsImporterFrequencyBased${validatorId}`}
                                    isChecked={availableImportData.generateFrequencyBasedSchedules}
                                    label={this.props.t('transit:gtfs:GenerateFrequencyBasedSchedules')}
                                    onValueChange={(e) =>
                                        this.updateSelectedValue(
                                            'generateFrequencyBasedSchedules',
                                            e.target.value === true
                                        )
                                    }
                                />
                            </InputWrapper>
                        </div>
                    )}
                </div>

                <FormErrors errors={errors} />
                <FormErrors errors={warnings} errorType="Warning" />

                <div>
                    {this.state.operationInProgress && (
                        <div className="tr__form-buttons-container">
                            <label>{this.props.t('transit:gtfs:OperationInProgress')}</label>
                            <Loader size={8} color={'#aaaaaa'} loading={true}></Loader>
                        </div>
                    )}

                    {/* import schedules */}
                    <div className="tr__form-buttons-container">
                        {selectedAgenciesCount > 0 && selectedLinesCount > 0 && selectedServicesCount > 0 && (
                            <Button
                                icon={faFileImport}
                                disabled={this.state.gtfsDataImported}
                                iconClass="_icon"
                                label={this.props.t('transit:gtfs:ImportGtfsData')}
                                onClick={this.importGtfsData}
                            />
                        )}
                    </div>
                </div>
            </form>
        );
    }
}

export default withTranslation(['transit', 'notifications'])(GtfsImportForm);
