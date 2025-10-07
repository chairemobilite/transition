/*
 * Copyright 2025, Polytechnique Montreal and contributors
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
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import ScenarioComparisonTab from './ScenarioComparisonTab';
import { _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import TransitRoutingBaseComponent from '../transitRouting/widgets/TransitRoutingBaseComponent';
import ODCoordinatesComponent from '../transitRouting/widgets/ODCoordinatesComponent';
import TimeOfTripComponent from '../transitRouting/widgets/TimeOfTripComponent';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { calculateRouting } from '../../../services/routing/RoutingUtils';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';

const ScenarioComparisonPanel: React.FC = () => {
    // State hooks
    const routingObj = useRef<TransitRouting>(
        new TransitRouting(_cloneDeep(Preferences.get('transit.routing.transit')), false)
    ).current;
    const [routingAttributes, setRoutingAttributes] = useState<TransitRoutingAttributes>(routingObj.attributes);
    const alternateRoutingObj = useRef<TransitRouting>(
        new TransitRouting(_cloneDeep(Preferences.get('transit.routing.transit')), false)
    ).current;
    // State is not used
    const [, setAlternateRoutingAttributes] = useState<TransitRoutingAttributes>(alternateRoutingObj.attributes);
    const [currentResult, setCurrentResult] = useState<RoutingResultsByMode[] | undefined>(undefined);
    const [scenarioCollection, setScenarioCollection] = useState(serviceLocator.collectionManager.get('scenarios'));
    const [loading, setLoading] = useState(false);
    const [routingErrors, setRoutingErrors] = useState<ErrorMessage[] | undefined>(undefined);
    // FIXME using any to avoid typing the formValues, which would be tedious
    const [formValues, setFormValues] = useState<any>(() => ({
        routingName: routingObj.attributes.routingName || '',
        minWaitingTimeSeconds: routingObj.attributes.minWaitingTimeSeconds,
        maxAccessEgressTravelTimeSeconds: routingObj.attributes.maxAccessEgressTravelTimeSeconds,
        maxTransferTravelTimeSeconds: routingObj.attributes.maxTransferTravelTimeSeconds,
        maxFirstWaitingTimeSeconds: routingObj.attributes.maxFirstWaitingTimeSeconds,
        maxTotalTravelTimeSeconds: routingObj.attributes.maxTotalTravelTimeSeconds,
        alternateScenario1Id: routingObj.attributes.scenarioId,
        alternateScenario2Id: routingObj.attributes.scenarioId,
        withAlternatives: routingObj.attributes.withAlternatives
    }));

    // Using refs for stateful values that don't trigger renders
    const invalidFieldsRef = useRef<{ [key: string]: boolean }>({});
    const calculateRoutingNonceRef = useRef<object>(new Object());

    const { t } = useTranslation(['transit', 'main', 'form']);

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
        path: string,
        newValue: { value: any; valid?: boolean } = { value: null, valid: true },
        resetResultsFlag = true
    ) => {
        onFormFieldChange(path, newValue);
        if (newValue.valid || newValue.valid === undefined) {
            const updatedObject = routingObj;
            updatedObject.set(path, newValue.value);
            if (typeof updatedObject.validate === 'function') {
                updatedObject.validate();
            }
            setRoutingAttributes({ ...updatedObject.attributes });
        }

        if (resetResultsFlag) {
            resetResults();
        }
    };

    const resetResults = () => {
        setCurrentResult(undefined);
        serviceLocator.eventManager.emit('map.updateLayers', {
            routingPaths: undefined,
            routingPathsStrokes: undefined,
            routingPathsAlternate: undefined,
            routingPathsStrokesAlternate: undefined
        });
    };

    const isValid = (): boolean => {
        // Are all form fields valid and the routing object too
        const valid =
            !hasInvalidFields() &&
            routingObj.validate() &&
            alternateRoutingObj.validate() &&
            formValues.alternateScenario1Id &&
            formValues.alternateScenario2Id;
        return valid;
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
        const routing = routingObj;
        const alternate = alternateRoutingObj;
        const newRoutingErrors: ErrorMessage[] = [];
        const isCancelled = () => localNonce !== calculateRoutingNonceRef.current;
        resetResults();
        setLoading(true);

        try {
            routing.attributes.routingModes = ['transit'];
            // Calculate the route for the two scenarios one after the other
            routing.attributes.scenarioId = formValues.alternateScenario1Id;
            const results1 = await calculateRouting(routing, refresh, { isCancelled });
            if (isCancelled()) {
                return;
            }
            alternate.attributes.routingModes = ['transit'];
            alternate.attributes.scenarioId = formValues.alternateScenario2Id;
            const results2 = await calculateRouting(alternate, refresh, { isCancelled });
            if (isCancelled()) {
                return;
            }

            setCurrentResult([results1, results2]);
            setRoutingErrors([]);
        } catch (err) {
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
        const routing = routingObj;
        const alternate = alternateRoutingObj;
        routing.setOrigin(originCoordinates, true);
        routing.setDestination(destinationCoordinates, true);
        alternate.setOrigin(originCoordinates, true);
        alternate.setDestination(destinationCoordinates, true);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'routingPoints',
            data: routing.originDestinationToGeojson()
        });
        if (routing.hasOrigin() && routing.hasDestination() && shouldCalculate) {
            calculate(true);
        }
        setRoutingAttributes({ ...routing.attributes });
        setAlternateRoutingAttributes({ ...alternate.attributes });
        setCurrentResult(undefined);
    };

    const onScenarioCollectionUpdate = () => {
        setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    const downloadCsv = () => {
        const elements = routingObj.attributes.savedForBatch;
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
        const updatedObject = routingObj;
        updatedObject.resetBatchSelection();
        setRoutingAttributes({ ...updatedObject.attributes });
    };

    const onTripTimeChange = (
        time: { value: any; valid?: boolean },
        timeType: 'departure' | 'arrival',
        alternateRouting: TransitRouting
    ) => {
        const timeAttribute =
            timeType === 'departure' ? 'departureTimeSecondsSinceMidnight' : 'arrivalTimeSecondsSinceMidnight';
        updateBothRoutingEngines(timeAttribute, time, alternateRouting);
    };

    const getScenarioNameById = (id: string): string => {
        for (const scenario of scenarioCollection.features) {
            if (scenario.id === id) {
                return scenario.toString(false);
            }
        }
        return '';
    };

    const updateBothRoutingEngines = (
        path: string,
        newValue: { value: any; valid?: boolean },
        alternateRouting: TransitRouting,
        resetResultsFlag = true
    ) => {
        onValueChange(path, newValue, resetResultsFlag);
        if (newValue.valid || newValue.valid === undefined) {
            const updatedAlternate = alternateRouting;
            updatedAlternate.attributes[path] = newValue.value;
            setAlternateRoutingAttributes({ ...updatedAlternate.attributes });
        }
    };

    // Handle componentDidMount and componentWillUnmount
    useEffect(() => {
        // ComponentDidMount
        if (routingObj.hasOrigin()) {
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'routingPoints',
                data: routingObj.originDestinationToGeojson()
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

    const routingId = routingObj.get('id');

    if (_isBlank(routingObj.get('withAlternatives'))) {
        routingObj.attributes.withAlternatives = false;
    }

    const scenarios = scenarioCollection.features.map((scenario) => {
        return {
            value: scenario.id,
            label: scenario.toString(false)
        };
    });

    const routingAttributesErrors = [
        ...((routingObj.getErrors() || []) as any[]),
        ...((alternateRoutingObj.getErrors() || []) as any[])
    ];

    return (
        <React.Fragment>
            <form id="tr__form-transit-routing" className="tr__form-transit-routing apptr__form">
                <h3>{t('transit:transitComparison:ScenarioComparison')}</h3>

                <Collapsible trigger={t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        <TimeOfTripComponent
                            departureTimeSecondsSinceMidnight={routingAttributes.departureTimeSecondsSinceMidnight}
                            arrivalTimeSecondsSinceMidnight={routingAttributes.arrivalTimeSecondsSinceMidnight}
                            onValueChange={(time, timeType) => {
                                onTripTimeChange(time, timeType, alternateRoutingObj);
                            }}
                        />
                        <TransitRoutingBaseComponent
                            onValueChange={(path, newValue) =>
                                updateBothRoutingEngines(path, newValue, alternateRoutingObj)
                            }
                            attributes={routingAttributes}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            <InputWrapper label={t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })}>
                                <InputSelect
                                    id={`formFieldTransitRoutingScenario1${routingId}`}
                                    value={formValues.alternateScenario1Id}
                                    choices={scenarios}
                                    t={t}
                                    onValueChange={(e) => {
                                        onValueChange('alternateScenario1Id', { value: e.target.value }, true);
                                        routingObj.attributes.scenarioId = e.target.value;
                                    }}
                                />
                            </InputWrapper>
                            <InputWrapper
                                label={t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })}
                                textColor="#ff00ff"
                            >
                                <InputSelect
                                    id={`formFieldTransitRoutingScenario2${routingId}`}
                                    value={formValues.alternateScenario2Id}
                                    choices={scenarios}
                                    t={t}
                                    onValueChange={(e) => {
                                        onValueChange('alternateScenario2Id', { value: e.target.value }, true);
                                        alternateRoutingObj.attributes.scenarioId = e.target.value;
                                    }}
                                />
                            </InputWrapper>
                        </div>
                        <InputWrapper label={t('transit:transitRouting:WithAlternatives')}>
                            <InputRadio
                                id={`formFieldTransitRoutingWithAlternatives${routingId}`}
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
                                    updateBothRoutingEngines(
                                        'withAlternatives',
                                        { value: _toBool(e.target.value) },
                                        alternateRoutingObj
                                    )
                                }
                            />
                        </InputWrapper>

                        <div>
                            <ODCoordinatesComponent
                                originGeojson={routingObj.attributes.originGeojson}
                                destinationGeojson={routingObj.attributes.destinationGeojson}
                                onUpdateOD={onUpdateOD}
                            />
                            <InputWrapper label={t('transit:transitRouting:RoutingName')}>
                                <InputString
                                    id={`formFieldTransitRoutingRoutingName${routingId}`}
                                    value={formValues.routingName}
                                    onValueUpdated={(value) =>
                                        updateBothRoutingEngines('routingName', value, alternateRoutingObj, false)
                                    }
                                    pattern={'[^,"\':;\r\n\t\\\\]*'}
                                />
                            </InputWrapper>
                            <div className="tr__form-buttons-container">
                                <Button
                                    size="small"
                                    label={t('transit:transitRouting:SaveTrip')}
                                    color="blue"
                                    onClick={() => saveRoutingForBatch(routingObj)}
                                />
                            </div>
                            {routingObj.attributes.savedForBatch.length > 0 && (
                                <div className="tr__form-buttons-container">
                                    <Button
                                        icon={faFileDownload}
                                        label={`${t(
                                            'transit:transitRouting:DownloadBatchRoutingCsv'
                                        )} (${routingObj.attributes.savedForBatch.length})`}
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

                {routingAttributesErrors.length > 0 && <FormErrors errors={routingAttributesErrors} />}
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
                                        setRoutingAttributes({ ...routingObj.attributes });
                                        setAlternateRoutingAttributes({ ...alternateRoutingObj.attributes });
                                    }
                                }}
                            />
                        </span>
                    </div>
                </div>

                {currentResult?.length === 2 && (
                    <ScenarioComparisonTab
                        result1={currentResult[0]}
                        result2={currentResult[1]}
                        request={routingObj.attributes}
                        scenarioNames={{
                            name1: getScenarioNameById(formValues.alternateScenario1Id),
                            name2: getScenarioNameById(formValues.alternateScenario2Id)
                        }}
                    />
                )}
            </form>
        </React.Fragment>
    );
};

export default ScenarioComparisonPanel;
