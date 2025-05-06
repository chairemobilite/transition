/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faFileDownload } from '@fortawesome/free-solid-svg-icons/faFileDownload';
import _cloneDeep from 'lodash/cloneDeep';
import _toString from 'lodash/toString';
import Loader from 'react-spinners/BeatLoader';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import ScenarioComparisonTab from './ScenarioComparisonTab';
import { _toInteger, _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import TransitRoutingBatchForm from '../transitRouting/TransitRoutingBatchForm';
import TransitRoutingBaseComponent from '../transitRouting/widgets/TransitRoutingBaseComponent';
import ODCoordinatesComponent from '../transitRouting/widgets/ODCoordinatesComponent';
import TimeOfTripComponent from '../transitRouting/widgets/TimeOfTripComponent';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { calculateRouting } from '../../../services/routing/RoutingUtils';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import { emptyFeatureCollection } from 'chaire-lib-common/lib/services/geodata/GeoJSONUtils';

export interface ComparisonPanelProps extends WithTranslation {
    addEventListeners?: () => void;
    removeEventListeners?: () => void;
    availableRoutingModes?: string[];
}

interface ComparisonFormState extends ChangeEventsState<TransitRouting> {
    currentResult?: RoutingResultsByMode[];
    alternateScenarioRouting: TransitRouting;
    scenarioCollection: any;
    loading: boolean;
    routingErrors?: ErrorMessage[];
    selectedMode?: RoutingOrTransitMode;
    alternateScenario1Id?: string;
    alternateScenario2Id?: string;
}

// This component (as well as the other components in the comparison directory), are mostly copied from the components of the Routing tab in ../transitRouting and share many of the same dependencies.
// Compared to the originals, these files are modified to allow the selection of 2 different scenarios, which will then calculate and compare 2 different paths for the same OD pair.
// TODO: Remove/rename any remaining functionality that is unneeded for this tab, and/or refactor the two tabs to avoid code duplication.
class ScenarioComparisonPanel extends ChangeEventsForm<ComparisonPanelProps, ComparisonFormState> {
    // eslint-disable-next-line
    private calculateRoutingNonce: Object = new Object();

    constructor(props: ComparisonPanelProps) {
        super(props);

        const routingEngine = new TransitRouting(_cloneDeep(Preferences.get('transit.routing.transit')), false);
        const routingEngine2 = new TransitRouting(_cloneDeep(Preferences.get('transit.routing.transit')), false);
        this.state = {
            object: routingEngine,
            alternateScenarioRouting: routingEngine2,
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            loading: false,
            formValues: {
                routingName: routingEngine.attributes.routingName || '',
                routingModes: ['transit'],
                minWaitingTimeSeconds: routingEngine.attributes.minWaitingTimeSeconds,
                maxAccessEgressTravelTimeSeconds: routingEngine.attributes.maxAccessEgressTravelTimeSeconds,
                maxTransferTravelTimeSeconds: routingEngine.attributes.maxTransferTravelTimeSeconds,
                maxFirstWaitingTimeSeconds: routingEngine.attributes.maxFirstWaitingTimeSeconds,
                maxTotalTravelTimeSeconds: routingEngine.attributes.maxTotalTravelTimeSeconds,
                alternateScenario1Id: routingEngine.attributes.scenarioId,
                alternateScenario2Id: routingEngine.attributes.scenarioId,
                withAlternatives: routingEngine.attributes.withAlternatives,
                routingPort: routingEngine.attributes.routingPort,
                odTripUuid: routingEngine.attributes.odTripUuid
            }
        };

        this.onUpdateOD = this.onUpdateOD.bind(this);
        this.onScenarioCollectionUpdate = this.onScenarioCollectionUpdate.bind(this);
        this.downloadCsv = this.downloadCsv.bind(this);
        this.resetBatchSelection = this.resetBatchSelection.bind(this);

        if (this.state.object.hasOrigin()) {
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'routingPoints',
                data: this.state.object.originDestinationToGeojson()
            });
        }
    }

    setSelectedMode = (selectedMode: RoutingOrTransitMode) => {
        this.setState({ selectedMode });
    };

    onScenarioCollectionUpdate() {
        this.setState({ scenarioCollection: serviceLocator.collectionManager.get('scenarios') });
    }

    onValueChange(
        path: string,
        newValue: { value: any; valid?: boolean } = { value: null, valid: true },
        resetResults = true
    ) {
        super.onValueChange(path, newValue);
        if (resetResults) {
            this.resetResults();
        }
    }

    resetResults() {
        this.setState({ currentResult: [] });
        serviceLocator.eventManager.emit('map.updateLayers', {
            routingPaths: emptyFeatureCollection,
            routingPathsAlternate: emptyFeatureCollection
        });
    }

    saveRoutingForBatch(routing: TransitRouting) {
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
        this.setState({
            object: routing,
            formValues: {
                ...this.state.formValues,
                routingName: routing.attributes.routingName
            }
        });
    }

    calculateRouting = async (refresh = false) => {
        if (!this.isValid()) {
            return;
        }
        const localNonce = (this.calculateRoutingNonce = new Object());
        const routing = this.state.object;
        const alternateRouting = this.state.alternateScenarioRouting;
        const routingErrors: ErrorMessage[] = [];
        const isCancelled = () => localNonce !== this.calculateRoutingNonce;
        this.resetResults();
        this.setState({ loading: true });

        try {
            routing.attributes.routingModes = ['transit'];
            // Calculate the route for the two scenarios one after the other
            routing.attributes.scenarioId = this.state.formValues.alternateScenario1Id;
            const results1 = await calculateRouting(routing, refresh, { isCancelled });
            if (isCancelled()) {
                return;
            }
            alternateRouting.attributes.routingModes = ['transit'];
            alternateRouting.attributes.scenarioId = this.state.formValues.alternateScenario2Id;
            const results2 = await calculateRouting(alternateRouting, refresh, { isCancelled });
            if (isCancelled()) {
                return;
            }

            this.setState({
                currentResult: [results1, results2],
                loading: false,
                routingErrors: []
            });
        } catch (err) {
            const error = err as any;
            if (error !== 'Cancelled') {
                routingErrors.push(
                    error.localizedMessage ? error.localizedMessage : error.message ? error.message : error.toString()
                );
                this.setState({ currentResult: [], loading: false, routingErrors });
            }
        }
    };

    onUpdateOD(
        originCoordinates?: GeoJSON.Position,
        destinationCoordinates?: GeoJSON.Position,
        shouldCalculate = true
    ) {
        // only both layer and routing engine object:
        const routing = this.state.object;
        const alternateRouting = this.state.alternateScenarioRouting;
        routing.setOrigin(originCoordinates, true);
        routing.setDestination(destinationCoordinates, true);
        alternateRouting.setOrigin(originCoordinates, true);
        alternateRouting.setDestination(destinationCoordinates, true);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'routingPoints',
            data: routing.originDestinationToGeojson()
        });
        if (routing.hasOrigin() && routing.hasDestination() && shouldCalculate) {
            this.calculateRouting(true);
        }
        this.setState({ object: routing, alternateScenarioRouting: alternateRouting, currentResult: [] });
    }

    componentDidMount() {
        serviceLocator.eventManager.on('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    private isValid = (): boolean => {
        // Are all form fields valid and the routing object too
        const valid =
            !this.hasInvalidFields() &&
            this.state.object.validate() &&
            this.state.alternateScenarioRouting.validate() &&
            this.state.formValues.alternateScenario1Id &&
            this.state.formValues.alternateScenario2Id;
        return valid;
    };

    private downloadCsv() {
        const elements = this.state.object.attributes.savedForBatch;
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
    }

    private resetBatchSelection() {
        this.state.object.resetBatchSelection();
        this.setState({ object: this.state.object });
    }

    private onTripTimeChange = (
        time: { value: any; valid?: boolean },
        timeType: 'departure' | 'arrival',
        alternateRouting: TransitRouting
    ) => {
        const timeAttribute =
            timeType === 'departure' ? 'departureTimeSecondsSinceMidnight' : 'arrivalTimeSecondsSinceMidnight';
        this.updateBothRoutingEngines(timeAttribute, time, alternateRouting);
    };

    private getScenarioNameById(id: string): string {
        for (const scenario of this.state.scenarioCollection.features) {
            if (scenario.id === id) {
                return scenario.toString(false);
            }
        }
        return '';
    }

    private updateBothRoutingEngines = (
        path: string,
        newValue: { value: any; valid?: boolean },
        alternateRouting: TransitRouting,
        resetResults = true
    ) => {
        this.onValueChange(path, newValue, resetResults);
        if (newValue.valid || newValue.valid === undefined) {
            alternateRouting.attributes[path] = newValue.value;
        }
    };

    render() {
        if (!this.state.scenarioCollection) {
            return <LoadingPage />;
        }

        const routing = this.state.object;
        const alternateRouting = this.state.alternateScenarioRouting;
        const routingId = routing.get('id');

        if (_isBlank(routing.get('withAlternatives'))) {
            routing.attributes.withAlternatives = false;
        }

        const scenarios = this.state.scenarioCollection.features.map((scenario) => {
            return {
                value: scenario.id,
                label: scenario.toString(false)
            };
        });

        return (
            <React.Fragment>
                <form id="tr__form-transit-routing" className="tr__form-transit-routing apptr__form">
                    <h3>{this.props.t('transit:transitComparison:ScenarioComparison')}</h3>

                    <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            <TimeOfTripComponent
                                departureTimeSecondsSinceMidnight={
                                    this.state.object.attributes.departureTimeSecondsSinceMidnight
                                }
                                arrivalTimeSecondsSinceMidnight={
                                    this.state.object.attributes.arrivalTimeSecondsSinceMidnight
                                }
                                onValueChange={(time, timeType) => {
                                    this.onTripTimeChange(time, timeType, alternateRouting);
                                }}
                            />
                            <TransitRoutingBaseComponent
                                onValueChange={(path, newValue) =>
                                    this.updateBothRoutingEngines(path, newValue, alternateRouting)
                                }
                                attributes={this.state.object.attributes}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                <InputWrapper
                                    label={this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })}
                                >
                                    <InputSelect
                                        id={`formFieldTransitRoutingScenario1${routingId}`}
                                        value={this.state.formValues.alternateScenario1Id}
                                        choices={scenarios}
                                        t={this.props.t}
                                        onValueChange={(e) => {
                                            this.onValueChange('alternateScenario1Id', { value: e.target.value }, true);
                                            routing.attributes.scenarioId = e.target.value;
                                        }}
                                    />
                                </InputWrapper>
                                <InputWrapper
                                    label={this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })}
                                    textColor="#ff00ff"
                                >
                                    <InputSelect
                                        id={`formFieldTransitRoutingScenario2${routingId}`}
                                        value={this.state.formValues.alternateScenario2Id}
                                        choices={scenarios}
                                        t={this.props.t}
                                        onValueChange={(e) => {
                                            this.onValueChange('alternateScenario2Id', { value: e.target.value }, true);
                                            alternateRouting.attributes.scenarioId = e.target.value;
                                        }}
                                    />
                                </InputWrapper>
                            </div>
                            <InputWrapper label={this.props.t('transit:transitRouting:WithAlternatives')}>
                                <InputRadio
                                    id={`formFieldTransitRoutingWithAlternatives${routingId}`}
                                    value={this.state.formValues.withAlternatives}
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
                                    t={this.props.t}
                                    isBoolean={true}
                                    onValueChange={(e) =>
                                        this.updateBothRoutingEngines(
                                            'withAlternatives',
                                            { value: _toBool(e.target.value) },
                                            alternateRouting
                                        )
                                    }
                                />
                            </InputWrapper>

                            <div>
                                <ODCoordinatesComponent
                                    originGeojson={this.state.object.attributes.originGeojson}
                                    destinationGeojson={this.state.object.attributes.destinationGeojson}
                                    onUpdateOD={this.onUpdateOD}
                                />
                                <InputWrapper label={this.props.t('transit:transitRouting:RoutingName')}>
                                    <InputString
                                        id={`formFieldTransitRoutingRoutingName${routingId}`}
                                        value={this.state.formValues.routingName}
                                        onValueUpdated={(value) =>
                                            this.updateBothRoutingEngines('routingName', value, alternateRouting, false)
                                        }
                                        pattern={'[^,"\':;\r\n\t\\\\]*'}
                                    />
                                </InputWrapper>
                                <div className="tr__form-buttons-container">
                                    <Button
                                        size="small"
                                        label={this.props.t('transit:transitRouting:SaveTrip')}
                                        color="blue"
                                        onClick={() => this.saveRoutingForBatch(routing)}
                                    />
                                </div>
                                {this.state.object.attributes.savedForBatch.length > 0 && (
                                    <div className="tr__form-buttons-container">
                                        <Button
                                            icon={faFileDownload}
                                            label={`${this.props.t(
                                                'transit:transitRouting:DownloadBatchRoutingCsv'
                                            )} (${this.state.object.attributes.savedForBatch.length})`}
                                            color="blue"
                                            onClick={this.downloadCsv}
                                        />
                                        <Button
                                            label={this.props.t('transit:transitRouting:ResetBatchRoutingExport')}
                                            color="grey"
                                            onClick={this.resetBatchSelection}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Collapsible>

                    <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                        <div className="tr__form-section">
                            <InputWrapper label={this.props.t('transit:transitRouting:RoutingPort')}>
                                <InputStringFormatted
                                    id={`formFieldTransitRoutingPort${routingId}`}
                                    value={this.state.formValues.routingPort}
                                    onValueUpdated={(e) =>
                                        this.updateBothRoutingEngines('routingPort', e, alternateRouting)
                                    }
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                />
                            </InputWrapper>
                            <InputWrapper label={this.props.t('transit:transitRouting:OdTripUuid')}>
                                <InputString
                                    id={`formFieldTransitRoutingOdTripUuid${routingId}`}
                                    value={this.state.formValues.odTripUuid}
                                    onValueUpdated={(e) =>
                                        this.updateBothRoutingEngines('odTripUuid', e, alternateRouting)
                                    }
                                />
                            </InputWrapper>
                        </div>
                    </Collapsible>

                    {this.state.object.getErrors() && this.state.alternateScenarioRouting.getErrors() && (
                        <FormErrors
                            errors={[
                                ...this.state.object.getErrors(),
                                ...this.state.alternateScenarioRouting.getErrors()
                            ]}
                        />
                    )}
                    {this.state.routingErrors && <FormErrors errors={this.state.routingErrors} />}
                    {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                    <div>
                        <div className="tr__form-buttons-container">
                            {this.state.loading && <Loader size={8} color={'#aaaaaa'} loading={true}></Loader>}
                            <span title={this.props.t('main:Calculate')}>
                                <Button
                                    icon={faCheckCircle}
                                    iconClass="_icon-alone"
                                    label=""
                                    onClick={() => {
                                        if (this.isValid()) {
                                            this.calculateRouting(true);
                                        } else {
                                            this.setState({
                                                object: routing,
                                                alternateScenarioRouting: alternateRouting
                                            });
                                        }
                                    }}
                                />
                            </span>
                        </div>
                    </div>

                    {this.state.currentResult?.length === 2 && (
                        <ScenarioComparisonTab
                            result1={this.state.currentResult[0]}
                            result2={this.state.currentResult[1]}
                            request={this.state.object.attributes}
                            scenarioNames={{
                                name1: this.getScenarioNameById(this.state.formValues.alternateScenario1Id),
                                name2: this.getScenarioNameById(this.state.formValues.alternateScenario2Id)
                            }}
                        />
                    )}
                </form>
                <TransitRoutingBatchForm routingEngine={this.state.object} isRoutingEngineValid={this.isValid} />
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'form'])(ScenarioComparisonPanel);
