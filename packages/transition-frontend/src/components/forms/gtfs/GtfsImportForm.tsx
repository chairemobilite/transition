/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useRef, useEffect } from 'react';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import Loader from 'react-spinners/BeatLoader';
import SocketIOFileClient from 'socket.io-file-client';
import { useTranslation } from 'react-i18next';

import InputFile from 'chaire-lib-frontend/lib/components/input/InputFile';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputCheckbox, { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
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

const GtfsImportForm: React.FC = () => {
    const [isUploaded, setIsUploaded] = useState(false);
    const [isPrepared, setIsPrepared] = useState(false);
    const [periodsGroupShortname, setPeriodsGroupShortname] = useState<string | undefined>(undefined);
    const [warnings, setWarnings] = useState<any[]>([]);
    const [errors, setErrors] = useState<any[]>([]);
    const [gtfsDataImported, setGtfsDataImported] = useState(false);
    const [operationInProgress, setOperationInProgress] = useState(false);
    const [availableImportData, setAvailableImportData] = useState<GtfsImportData>({
        agencies: [],
        lines: [],
        services: []
    });

    const { t, i18n } = useTranslation(['transit', 'notifications']);

    const fileImportRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
    const zipFileUploader = useRef(
        new SocketIOFileClient(serviceLocator.socketEventManager._eventManager, {
            chunkSize: Preferences.current.socketUploadChunkSize
        })
    );

    const updateSelection = (
        path: 'agency' | 'line' | 'service',
        value,
        stateChange: { gtfsDataImported?: boolean } = {}
    ) => {
        const importData = { ...availableImportData };
        if (!importData) return;

        switch (path) {
        case 'agency':
            importData.agencies.forEach((agency) => (agency.selected = value.includes(agency.agency.agency_id)));
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
        setAvailableImportData(importData);
        if (stateChange) {
            Object.entries(stateChange).forEach(([key, val]) => {
                if (key === 'gtfsDataImported') setGtfsDataImported(val);
            });
        }
    };

    const updateSelectedValue = (path: keyof GtfsImportData, value: string | boolean | number | undefined) => {
        const importData = { ...availableImportData };
        if (!importData) return;
        importData[path] = value;
        setAvailableImportData(importData);
    };

    const onGtfsFileUnzipped = () => {
        console.log('gtfsImporter.unzippedAll');
    };

    useEffect(() => {
        const uploader = zipFileUploader.current;

        const onZipFileUploadStart = (_fileInfo) => {
            serviceLocator.eventManager.emit('progress', { name: 'UploadingGtfsFile', progress: 0.0 });
        };

        const onZipFileUploadComplete = () => {
            serviceLocator.eventManager.emit('progress', { name: 'UploadingGtfsFile', progress: 1.0 });
            setIsUploaded(true);
        };

        const onZipFileUploadError = (error) => {
            console.log('GTFS file upload error!', error);
            setErrors((prevErrors) => [...prevErrors, 'transit:gtfs:errors:ErrorUploadingFile']);
        };

        const onGtfsFilePrepared = (validatorAttributes: GtfsImportData) => {
            validatorAttributes.stopAggregationWalkingRadiusSeconds ??= Preferences.get(
                'transit.nodes.defaultStopAggregationWalkingRadiusSecondsWhenImportingFromGtfs',
                60
            );
            validatorAttributes.nodes_color ??= Preferences.get('transit.nodes.defaultColor', '#0086FF');
            setAvailableImportData(validatorAttributes);
            setGtfsDataImported(false);
        };

        const onGtfsDataImported = async (importResult: GtfsImportStatus) => {
            setErrors(importResult.errors || []);

            if (importResult.status !== 'failed') {
                setWarnings(importResult.warnings || []);
                const collections = ['paths', 'lines', 'agencies', 'nodes', 'services'];
                try {
                    for (const collection of collections) {
                        await serviceLocator.collectionManager
                            .get(collection)
                            .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
                    }
                } catch (error) {
                    console.log(error);
                }

                serviceLocator.eventManager.emit('progress', { name: 'ImportingGtfsData', progress: 1.0 });
                for (const collection of collections) {
                    serviceLocator.collectionManager.refresh(collection);
                }

                serviceLocator.eventManager.emit('map.updateLayers', {
                    transitPaths: serviceLocator.collectionManager.get('paths').toGeojson(),
                    transitNodes: serviceLocator.collectionManager.get('nodes').toGeojson()
                });

                if (importResult.errors.length === 0 && importResult.warnings.length === 0) {
                    serviceLocator.eventManager.emit('section.change', 'agencies');
                }
            }

            setGtfsDataImported(true);
            setOperationInProgress(false);
        };

        uploader.on('start', onZipFileUploadStart);
        uploader.on('complete', onZipFileUploadComplete);
        uploader.on('error', onZipFileUploadError);

        serviceLocator.socketEventManager.on('gtfsImporter.gtfsFilePrepared', onGtfsFilePrepared);
        serviceLocator.socketEventManager.on('gtfsImporter.gtfsFileUnzipped', onGtfsFileUnzipped);
        serviceLocator.socketEventManager.on(GtfsConstants.GTFS_DATA_IMPORTED, onGtfsDataImported);
        serviceLocator.socketEventManager.on('gtfsImporter.gtfsUploadError', onZipFileUploadError);

        return () => {
            uploader.off('start', onZipFileUploadStart);
            uploader.off('complete', onZipFileUploadComplete);
            uploader.off('error', onZipFileUploadError);

            serviceLocator.socketEventManager.off('gtfsImporter.gtfsFilePrepared', onGtfsFilePrepared);
            serviceLocator.socketEventManager.off('gtfsImporter.gtfsFileUnzipped', onGtfsFileUnzipped);
            serviceLocator.socketEventManager.off(GtfsConstants.GTFS_DATA_IMPORTED, onGtfsDataImported);
            serviceLocator.socketEventManager.off('gtfsImporter.gtfsUploadError', onZipFileUploadError);
        };
    }, []);

    const importGtfsData = (_e) => {
        if (operationInProgress) {
            console.log('Another operation is in progress');
            return;
        }

        if (periodsGroupShortname === undefined) {
            setErrors(['transit:gtfs:errors:PeriodsGroupIsRequired']);
        } else {
            setOperationInProgress(true);
            setErrors([]);
            serviceLocator.eventManager.emit('progress', {
                name: 'ImportingGtfsData',
                progress: 0.0
            });
            serviceLocator.socketEventManager.emit(GtfsConstants.GTFS_IMPORT_DATA, {
                ...availableImportData,
                periodsGroupShortname: periodsGroupShortname
            });
        }
    };

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
                label: periodsGroup.name[i18n.language] || periodsGroupShortname
            });
        }
    }

    const resetFileData = () => {
        setIsPrepared(false);
        setWarnings([]);
        setErrors([]);
        setGtfsDataImported(false);
        setPeriodsGroupShortname(undefined);
    };

    return (
        <form id="tr__form-transit-gtfs-import" className="tr__form-transit-gtfs-import apptr__form">
            <h3>{t('transit:gtfs:Import')}</h3>

            <div className="tr__form-section">
                <div className="apptr__form-input-container _two-columns">
                    <label>{t('transit:gtfs:ZipFile')}</label>
                    <InputFile
                        id={'formFieldTransitGtfsImporterFile'}
                        accept=".zip"
                        inputRef={fileImportRef}
                        onChange={resetFileData}
                    />
                </div>
            </div>
            <div className="tr__form-buttons-container">
                {fileImportRef.current && fileImportRef.current.files?.length === 1 && (
                    <Button
                        icon={faUpload}
                        iconClass="_icon-alone"
                        label=""
                        color="blue"
                        onClick={() => {
                            zipFileUploader.current.upload(fileImportRef.current, {
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
                {isPrepared && <div className="apptr__form-input-container">{t('transit:gtfs:NewOrUpdate')}</div>}
                {availableImportData?.agencies.length > 0 && (
                    <div className="apptr__form-input-container">
                        <label className="_flex">{t('transit:gtfs:SelectedAgencies')}</label>
                        <GtfsImportAgenciesComponent
                            agencies={availableImportData?.agencies}
                            id={'formFieldTransitGtfsImporterSelectedAgencies'}
                            value={selectedAgencies}
                            onSelectionChange={(e) =>
                                updateSelection('agency', e.target.value, {
                                    gtfsDataImported: false
                                })
                            }
                            onAgencyDataUpdated={(agenciesData) =>
                                setAvailableImportData({
                                    ...availableImportData,
                                    agencies: agenciesData
                                })
                            }
                            allowSelectAll={true}
                        />
                    </div>
                )}
                {availableImportData?.agencies.length > 0 && (
                    <div className="apptr__form-input-container _two-columns">
                        <label className="_flex">{t('transit:gtfs:DefaultAgencyColor')}</label>
                        <InputColor
                            id={'formFieldTransitGtfsImporterFileDefaultAgencyColor'}
                            value={availableImportData.agencies_color}
                            defaultColor={Preferences.get('transit.agencies.defaultColor', '#0086FF')}
                            onValueChange={(e) => updateSelectedValue('agencies_color', e.target.value)}
                        />
                    </div>
                )}
                {linesChoices.length > 0 && (
                    <div className="apptr__form-input-container">
                        <label className="_flex">{t('transit:gtfs:SelectedLines')}</label>
                        <InputCheckbox
                            choices={linesChoices}
                            id={'formFieldTransitGtfsImporterSelectedLines'}
                            value={selectedLines}
                            onValueChange={(e) => updateSelection('line', e.target.value, { gtfsDataImported: false })}
                            allowSelectAll={true}
                        />
                    </div>
                )}
                {availableImportData?.services.length > 0 && (
                    <div className="apptr__form-input-container">
                        <label className="_flex">{t('transit:gtfs:SelectedServices')}</label>
                        <GtfsImportServiceComponent
                            services={availableImportData?.services}
                            id={'formFieldTransitGtfsImporterSelectedServices'}
                            value={selectedServices}
                            onValueChange={(e) =>
                                updateSelection('service', e.target.value, {
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
                            isChecked={availableImportData.mergeSameDaysServices}
                            id={'formFieldTransitGtfsImporterSelectedServicesMerge'}
                            label={t('transit:gtfs:MergeSamePeriodServices')}
                            onValueChange={(e) => updateSelectedValue('mergeSameDaysServices', e.target.value === true)}
                        />
                    </div>
                )}
                {availableImportData?.agencies.length > 0 && availableImportData?.services.length > 0 && (
                    <div className="apptr__form-input-container">
                        <GtfsImportNodesComponent
                            id="formFieldTransitGtfsImporterNodeComponent"
                            updateSelectedValue={updateSelectedValue}
                            gtfsImportData={availableImportData}
                        />
                    </div>
                )}
                {selectedServicesCount > 0 && (
                    <div className="apptr__form-input-container ">
                        <label>{t('transit:transitSchedule:PeriodsGroup')}</label>
                        <InputSelect
                            id="formFieldTransitGtfsImporterPeriodsGroup"
                            value={periodsGroupShortname}
                            choices={periodsGroupChoices}
                            t={t}
                            onValueChange={(e) => {
                                setPeriodsGroupShortname(e.target.value);
                                setErrors([]);
                            }}
                        />
                    </div>
                )}
                {selectedServicesCount > 0 && (
                    <div className="apptr__form-input-container">
                        <InputWrapper
                            twoColumns={true}
                            label={''}
                            help={t('transit:gtfs:GenerateFrequencyBasedSchedulesHelp')}
                        >
                            <InputCheckboxBoolean
                                id={'formFieldTransitGtfsImporterFrequencyBased'}
                                isChecked={availableImportData.generateFrequencyBasedSchedules}
                                label={t('transit:gtfs:GenerateFrequencyBasedSchedules')}
                                onValueChange={(e) =>
                                    updateSelectedValue('generateFrequencyBasedSchedules', e.target.value === true)
                                }
                            />
                        </InputWrapper>
                    </div>
                )}
            </div>

            <FormErrors errors={errors} />
            <FormErrors errors={warnings} errorType="Warning" />

            <div>
                {operationInProgress && (
                    <div className="tr__form-buttons-container">
                        <label>{t('transit:gtfs:OperationInProgress')}</label>
                        <Loader size={8} color={'#aaaaaa'} loading={true}></Loader>
                    </div>
                )}

                <div className="tr__form-buttons-container">
                    {selectedAgenciesCount > 0 && selectedLinesCount > 0 && selectedServicesCount > 0 && (
                        <Button
                            icon={faFileImport}
                            disabled={gtfsDataImported}
                            iconClass="_icon"
                            label={t('transit:gtfs:ImportGtfsData')}
                            onClick={importGtfsData}
                        />
                    )}
                </div>
            </div>
        </form>
    );
};

export default GtfsImportForm;
