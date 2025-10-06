/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useRef, useEffect } from 'react';
import Collapsible from 'react-collapsible';
import { useTranslation } from 'react-i18next';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faFileDownload } from '@fortawesome/free-solid-svg-icons/faFileDownload';
import _cloneDeep from 'lodash/cloneDeep';
import Loader from 'react-spinners/BeatLoader';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import RoutingResultsComponent from './RoutingResultsComponent';
import { _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import TransitRoutingBaseComponent from './widgets/TransitRoutingBaseComponent';
import ODCoordinatesComponent from './widgets/ODCoordinatesComponent';
import TimeOfTripComponent from './widgets/TimeOfTripComponent';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { calculateRouting } from '../../../services/routing/RoutingUtils';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';

export interface TransitRoutingFormProps {
    availableRoutingModes?: string[];
}

const TransitRoutingForm: React.FC<TransitRoutingFormProps> = (props) => {
    // State hooks to replace class state
    const transitRouting = useRef<TransitRouting>(
        new TransitRouting(_cloneDeep(Preferences.get('transit.routing.transit')))
    ).current;
    // State value is not used
    const [, setRoutingAttributes] = useState<TransitRoutingAttributes>(transitRouting.attributes);
    // FIXME using any to avoid typing the formValues, which would be tedious, will be rewritten soon anyway
    const [formValues, setFormValues] = useState<any>(() => ({
        routingName: transitRouting.attributes.routingName || '',
        routingModes: transitRouting.attributes.routingModes || ['transit'],
        minWaitingTimeSeconds: transitRouting.attributes.minWaitingTimeSeconds,
        maxAccessEgressTravelTimeSeconds: transitRouting.attributes.maxAccessEgressTravelTimeSeconds,
        maxTransferTravelTimeSeconds: transitRouting.attributes.maxTransferTravelTimeSeconds,
        maxFirstWaitingTimeSeconds: transitRouting.attributes.maxFirstWaitingTimeSeconds,
        maxTotalTravelTimeSeconds: transitRouting.attributes.maxTotalTravelTimeSeconds,
        scenarioId: transitRouting.attributes.scenarioId,
        withAlternatives: transitRouting.attributes.withAlternatives
    }));

    const [currentResult, setCurrentResult] = useState<RoutingResultsByMode | undefined>(undefined);
    const [scenarioCollection, setScenarioCollection] = useState(serviceLocator.collectionManager.get('scenarios'));
    const [loading, setLoading] = useState(false);
    const [routingErrors, setRoutingErrors] = useState<ErrorMessage[] | undefined>(undefined);
    const [selectedMode, setSelectedMode] = useState<RoutingOrTransitMode | undefined>(undefined);

    const { t } = useTranslation(['transit', 'main', 'form']);

    // Using refs for stateful values that don't trigger renders
    const invalidFieldsRef = useRef<{ [key: string]: boolean }>({});
    const calculateRoutingNonceRef = useRef<object>(new Object());

    // Functionality from ChangeEventsForm
    const hasInvalidFields = (): boolean => {
        return Object.keys(invalidFieldsRef.current).filter((key) => invalidFieldsRef.current[key]).length > 0;
    };

    const onFormFieldChange = (
        path: string,
        newValue: { value: any; valid?: boolean } = { value: null, valid: true }
    ) => {
        setFormValues((prevValues) => ({ ...prevValues, [path]: newValue.value }));
        if (newValue.valid !== undefined && !newValue.valid) {
            invalidFieldsRef.current[path] = true;
        } else {
            invalidFieldsRef.current[path] = false;
        }
    };

    const onValueChange = (
        path: keyof TransitRoutingAttributes,
        newValue: { value: any; valid?: boolean } = { value: null, valid: true },
        resetResults = true
    ) => {
        onFormFieldChange(path, newValue);
        if (newValue.valid || newValue.valid === undefined) {
            const updatedObject = transitRouting;
            updatedObject.set(path, newValue.value);
            setRoutingAttributes({ ...updatedObject.attributes });
        }

        if (resetResults) {
            resetResultsData();
        }
    };

    const resetResultsData = () => {
        setCurrentResult(undefined);
        serviceLocator.eventManager.emit('map.updateLayers', {
            routingPaths: undefined,
            routingPathsStrokes: undefined
        });
    };

    const isValid = (): boolean => {
        // Are all form fields valid and the routing object too
        return !hasInvalidFields() && transitRouting.isValid();
    };

    const saveRoutingForBatch = (routing: TransitRouting) => {
        const {
            routingName,
            departureTimeSecondsSinceMidnight,
            arrivalTimeSecondsSinceMidnight,
            originGeojson,
            destinationGeojson
        } = routing.attributes;
        if (!originGeojson || !destinationGeojson) {
            return;
        }
        // Save the origin et destinations lat/lon, and time, along with whether it is arrival or departure
        // TODO Support specifying departure/arrival as variable in batch routing
        routing.addElementForBatch({
            routingName,
            departureTimeSecondsSinceMidnight,
            arrivalTimeSecondsSinceMidnight,
            originGeojson,
            destinationGeojson
        });

        routing.set('routingName', ''); // empty routing name for the next route
        setRoutingAttributes({ ...routing.attributes });
        setFormValues((prevValues) => ({
            ...prevValues,
            routingName: routing.attributes.routingName
        }));
    };

    const calculate = async (refresh = false) => {
        if (!isValid()) {
            return;
        }
        const localNonce = (calculateRoutingNonceRef.current = new Object());
        const routing = transitRouting;
        const newRoutingErrors: ErrorMessage[] = [];
        const isCancelled = () => localNonce !== calculateRoutingNonceRef.current;
        resetResultsData();
        setLoading(true);

        try {
            // TODO tahini: Do something about the walk only route
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'routingPoints',
                data: routing.originDestinationToGeojson()
            });
            const results = await calculateRouting(routing, refresh, { isCancelled });
            if (isCancelled()) {
                return;
            }
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'routingPoints',
                data: routing.originDestinationToGeojson()
            });

            setCurrentResult(results);
            setRoutingErrors([]);
        } catch (err) {
            // FIXME Refactor error API to make this less custom
            const error = err as any;
            if (error !== 'Cancelled') {
                newRoutingErrors.push(
                    error.localizedMessage ? error.localizedMessage : error.message ? error.message : error.toString()
                );
                setCurrentResult(undefined);
                setRoutingErrors(newRoutingErrors);
            }
        } finally {
            if (!isCancelled()) {
                setLoading(false);
            }
        }
    };

    const onUpdateOD = (
        originCoordinates?: GeoJSON.Position,
        destinationCoordinates?: GeoJSON.Position,
        shouldCalculate = true
    ) => {
        // update both layer and routing engine object:
        const routing = transitRouting;
        routing.setOrigin(originCoordinates, true);
        routing.setDestination(destinationCoordinates, true);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'routingPoints',
            data: routing.originDestinationToGeojson()
        });
        if (routing.hasOrigin() && routing.hasDestination() && shouldCalculate) {
            calculate(true);
        }
        setRoutingAttributes({ ...routing.attributes });
        setCurrentResult(undefined);
    };

    const onScenarioCollectionUpdate = () => {
        setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    const downloadCsv = () => {
        const elements = transitRouting.attributes.savedForBatch;
        const lines: string[] = [];
        lines.push('id,routingName,originLon,originLat,destinationLon,destinationLat,time');
        elements.forEach((element, index) => {
            const time = !_isBlank(element.arrivalTimeSecondsSinceMidnight)
                ? element.arrivalTimeSecondsSinceMidnight
                : element.departureTimeSecondsSinceMidnight;
            lines.push(
                index +
                    ',' +
                    (element.routingName || '') +
                    ',' +
                    element.originGeojson?.geometry.coordinates[0] +
                    ',' +
                    element.originGeojson?.geometry.coordinates[1] +
                    ',' +
                    element.destinationGeojson?.geometry.coordinates[0] +
                    ',' +
                    element.destinationGeojson?.geometry.coordinates[1] +
                    ',' +
                    (!_isBlank(time) ? secondsSinceMidnightToTimeStr(time as number) : '')
            );
        });
        const csvFileContent = lines.join('\n');

        const element = document.createElement('a');
        const file = new Blob([csvFileContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = 'batchRouting.csv';
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
    };

    const resetBatchSelection = () => {
        const updatedObject = transitRouting;
        updatedObject.resetBatchSelection();
        setRoutingAttributes({ ...updatedObject.attributes });
    };

    const onTripTimeChange = (time: { value: any; valid?: boolean }, timeType: 'departure' | 'arrival') => {
        onValueChange(
            timeType === 'departure' ? 'departureTimeSecondsSinceMidnight' : 'arrivalTimeSecondsSinceMidnight',
            time
        );
    };

    // Handle componentDidMount and componentWillUnmount
    useEffect(() => {
        // ComponentDidMount
        if (transitRouting.hasOrigin()) {
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'routingPoints',
                data: transitRouting.originDestinationToGeojson()
            });
        }

        serviceLocator.eventManager.on('collection.update.scenarios', onScenarioCollectionUpdate);

        // ComponentWillUnmount
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onScenarioCollectionUpdate);
        };
    }, []);

    if (!scenarioCollection) {
        return <LoadingPage />;
    }

    const routingModes = Array.from(new Set([...(props.availableRoutingModes || []), 'transit']));
    const routingModesChoices = routingModes.map((routingMode) => {
        return {
            value: routingMode
        };
    });

    const selectedRoutingModes = formValues.routingModes || [];
    const hasTransitModeSelected = selectedRoutingModes.includes('transit');

    if (_isBlank(transitRouting.get('withAlternatives'))) {
        transitRouting.set('withAlternatives', false);
    }

    const scenarios = scenarioCollection.features.map((scenario) => {
        return {
            value: scenario.id,
            label: scenario.toString(false)
        };
    });

    return (
        <React.Fragment>
            <form id="tr__form-transit-routing" className="tr__form-transit-routing apptr__form">
                <h3>{t('transit:transitRouting:Routing')}</h3>

                <Collapsible trigger={t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        {routingModesChoices.length > 0 && (
                            <InputWrapper twoColumns={false} label={t('transit:transitRouting:RoutingModes')}>
                                <InputMultiselect
                                    choices={routingModesChoices}
                                    t={t}
                                    id={'formFieldTransitRoutingRoutingModes'}
                                    value={selectedRoutingModes}
                                    localePrefix="transit:transitPath:routingModes"
                                    onValueChange={(e) => onValueChange('routingModes', { value: e.target.value })}
                                />
                            </InputWrapper>
                        )}
                        {hasTransitModeSelected && (
                            <TimeOfTripComponent
                                departureTimeSecondsSinceMidnight={
                                    transitRouting.attributes.departureTimeSecondsSinceMidnight
                                }
                                arrivalTimeSecondsSinceMidnight={
                                    transitRouting.attributes.arrivalTimeSecondsSinceMidnight
                                }
                                onValueChange={onTripTimeChange}
                            />
                        )}
                        {hasTransitModeSelected && (
                            <TransitRoutingBaseComponent
                                onValueChange={onValueChange}
                                attributes={transitRouting.attributes}
                            />
                        )}
                        {hasTransitModeSelected && (
                            <InputWrapper label={t('transit:transitRouting:Scenario')}>
                                <InputSelect
                                    id={'formFieldTransitRoutingScenario'}
                                    value={formValues.scenarioId}
                                    choices={scenarios}
                                    t={t}
                                    onValueChange={(e) => onValueChange('scenarioId', { value: e.target.value })}
                                />
                            </InputWrapper>
                        )}
                        {hasTransitModeSelected && (
                            <InputWrapper label={t('transit:transitRouting:WithAlternatives')}>
                                <InputRadio
                                    id={'formFieldTransitRoutingWithAlternatives'}
                                    value={formValues.withAlternatives}
                                    sameLine={true}
                                    disabled={false}
                                    choices={[
                                        {
                                            value: true
                                        },
                                        {
                                            value: false
                                        }
                                    ]}
                                    localePrefix="transit:transitRouting"
                                    t={t}
                                    isBoolean={true}
                                    onValueChange={(e) =>
                                        onValueChange('withAlternatives', { value: _toBool(e.target.value) })
                                    }
                                />
                            </InputWrapper>
                        )}

                        <div>
                            <ODCoordinatesComponent
                                originGeojson={transitRouting.attributes.originGeojson}
                                destinationGeojson={transitRouting.attributes.destinationGeojson}
                                onUpdateOD={onUpdateOD}
                            />
                            <InputWrapper label={t('transit:transitRouting:RoutingName')}>
                                <InputString
                                    id={'formFieldTransitRoutingRoutingName'}
                                    value={formValues.routingName}
                                    onValueUpdated={(value) => onValueChange('routingName', value, false)}
                                    pattern={'[^,"\':;\r\n\t\\\\]*'}
                                />
                            </InputWrapper>
                            <div className="tr__form-buttons-container">
                                <Button
                                    size="small"
                                    label={t('transit:transitRouting:SaveTrip')}
                                    color="blue"
                                    onClick={() => saveRoutingForBatch(transitRouting)}
                                />
                            </div>
                            {transitRouting.attributes.savedForBatch.length > 0 && (
                                <div className="tr__form-buttons-container">
                                    <Button
                                        icon={faFileDownload}
                                        label={`${t(
                                            'transit:transitRouting:DownloadBatchRoutingCsv'
                                        )} (${transitRouting.attributes.savedForBatch.length})`}
                                        color="blue"
                                        onClick={downloadCsv}
                                    />
                                    <Button
                                        label={t('transit:transitRouting:ResetBatchRoutingExport')}
                                        color="grey"
                                        onClick={resetBatchSelection}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </Collapsible>

                {transitRouting.getErrors() && <FormErrors errors={transitRouting.getErrors()} />}
                {routingErrors && <FormErrors errors={routingErrors} />}
                {hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                <div>
                    <div className="tr__form-buttons-container">
                        {loading && <Loader size={8} color={'#aaaaaa'} loading={true}></Loader>}
                        <span title={t('main:Calculate')}>
                            <Button
                                icon={faCheckCircle}
                                iconClass="_icon-alone"
                                label=""
                                onClick={() => {
                                    if (isValid()) {
                                        calculate(true);
                                    } else {
                                        setRoutingAttributes({ ...transitRouting.attributes });
                                    }
                                }}
                            />
                        </span>
                    </div>
                </div>

                {currentResult && (
                    <RoutingResultsComponent
                        results={currentResult}
                        request={transitRouting.attributes}
                        selectedMode={selectedMode}
                        setSelectedMode={setSelectedMode}
                    />
                )}
            </form>
        </React.Fragment>
    );
};

export default TransitRoutingForm;
