/*
 * Copyright 2022, Polytechnique Montreal and contributors
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
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import RoutingResultsComponent from './RoutingResultsComponent';
import { _toInteger, _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import TransitRoutingBatchForm from './TransitRoutingBatchForm';
import TransitRoutingBaseComponent from './widgets/TransitRoutingBaseComponent';
import ODCoordinatesComponent from './widgets/ODCoordinatesComponent';
import TimeOfTripComponent from './widgets/TimeOfTripComponent';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { calculateRouting } from '../../../services/routing/RoutingUtils';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';

export interface TransitRoutingFormProps extends WithTranslation {
    // TODO tahini batch routing
    addEventListeners?: () => void;
    removeEventListeners?: () => void;
    fileUploader?: any;
    fileImportRef?: any;
    availableRoutingModes?: string[];
}

interface TransitRoutingFormState extends ChangeEventsState<TransitRouting> {
    currentResult?: RoutingResultsByMode;
    scenarioCollection: any;
    loading: boolean;
    routingErrors?: ErrorMessage[];
    selectedMode?: RoutingOrTransitMode;
}

class TransitRoutingForm extends ChangeEventsForm<TransitRoutingFormProps, TransitRoutingFormState> {
    // eslint-disable-next-line
    private calculateRoutingNonce: Object = new Object();

    constructor(props: TransitRoutingFormProps) {
        super(props);

        const routingEngine = new TransitRouting(_cloneDeep(Preferences.get('transit.routing.transit')), false);
        this.state = {
            object: routingEngine,
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            loading: false,
            // FIXME tahini: There's probably a better way for this, like with useState
            formValues: {
                routingName: routingEngine.getAttributes().routingName || '',
                routingModes: routingEngine.getAttributes().routingModes || ['transit'],
                minWaitingTimeSeconds: routingEngine.getAttributes().minWaitingTimeSeconds,
                maxAccessEgressTravelTimeSeconds: routingEngine.getAttributes().maxAccessEgressTravelTimeSeconds,
                maxTransferTravelTimeSeconds: routingEngine.getAttributes().maxTransferTravelTimeSeconds,
                maxFirstWaitingTimeSeconds: routingEngine.getAttributes().maxFirstWaitingTimeSeconds,
                maxTotalTravelTimeSeconds: routingEngine.getAttributes().maxTotalTravelTimeSeconds,
                scenarioId: routingEngine.getAttributes().scenarioId,
                withAlternatives: routingEngine.getAttributes().withAlternatives,
                routingPort: routingEngine.getAttributes().routingPort,
                odTripUuid: routingEngine.getAttributes().odTripUuid
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
        this.setState({ currentResult: undefined });
        serviceLocator.eventManager.emit('map.updateLayers', {
            routingPaths: undefined,
            routingPathsStrokes: undefined
        });
    }

    saveRoutingForBatch(routing: TransitRouting) {
        const {
            routingName,
            departureTimeSecondsSinceMidnight,
            arrivalTimeSecondsSinceMidnight,
            originGeojson,
            destinationGeojson
        } = routing.getAttributes();
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
        this.setState({
            object: routing,
            formValues: {
                ...this.state.formValues,
                routingName: routing.getAttributes().routingName
            }
        });
    }

    // FIXME Refactor transit routing to define each component's responsibility, ie who assignes what? when? Also, specify a result and error API for each method used in TransitRouting and TransitRoutingForm
    calculateRouting = async (refresh = false) => {
        if (!this.isValid()) {
            return;
        }
        const localNonce = (this.calculateRoutingNonce = new Object());
        const routing = this.state.object;
        const routingErrors: ErrorMessage[] = [];
        const isCancelled = () => localNonce !== this.calculateRoutingNonce;
        this.resetResults();
        this.setState({ loading: true });

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

            this.setState({
                currentResult: results,
                loading: false,
                routingErrors: []
            });
        } catch (err) {
            // FIXME Refactor error API to make this less custom
            const error = err as any;
            if (error !== 'Cancelled') {
                routingErrors.push(
                    error.localizedMessage ? error.localizedMessage : error.message ? error.message : error.toString()
                );
                this.setState({ currentResult: undefined, loading: false, routingErrors });
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
        routing.setOrigin(originCoordinates, true);
        routing.setDestination(destinationCoordinates, true);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'routingPoints',
            data: routing.originDestinationToGeojson()
        });
        if (routing.hasOrigin() && routing.hasDestination() && shouldCalculate) {
            this.calculateRouting(true);
        }
        this.setState({ object: routing, currentResult: undefined });
    }

    componentDidMount() {
        serviceLocator.eventManager.on('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    private isValid = (): boolean => {
        // Are all form fields valid and the routing object too
        return !this.hasInvalidFields() && this.state.object.validate();
    };

    private downloadCsv() {
        const elements = this.state.object.getAttributes().savedForBatch;
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

    private onTripTimeChange = (time: { value: any; valid?: boolean }, timeType: 'departure' | 'arrival') => {
        this.onValueChange(
            timeType === 'departure' ? 'departureTimeSecondsSinceMidnight' : 'arrivalTimeSecondsSinceMidnight',
            time
        );
    };

    render() {
        if (!this.state.scenarioCollection) {
            return <LoadingPage />;
        }

        const routing = this.state.object;
        const routingId = routing.get('id');

        const routingModes = _cloneDeep(this.props.availableRoutingModes || []);
        routingModes.push('transit');
        const routingModesChoices = routingModes.map((routingMode) => {
            return {
                value: routingMode
            };
        });

        const selectedRoutingModes = this.state.formValues.routingModes || [];
        const hasTransitModeSelected = selectedRoutingModes.includes('transit');

        if (_isBlank(routing.get('withAlternatives'))) {
            routing.getAttributes().withAlternatives = false;
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
                    <h3>{this.props.t('transit:transitRouting:Routing')}</h3>

                    <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            {routingModesChoices.length > 0 && (
                                <InputWrapper
                                    twoColumns={false}
                                    label={this.props.t('transit:transitRouting:RoutingModes')}
                                >
                                    <InputMultiselect
                                        choices={routingModesChoices}
                                        t={this.props.t}
                                        id={`formFieldTransitRoutingRoutingModes${routingId}`}
                                        value={selectedRoutingModes}
                                        localePrefix="transit:transitPath:routingModes"
                                        onValueChange={(e) =>
                                            this.onValueChange('routingModes', { value: e.target.value })
                                        }
                                    />
                                </InputWrapper>
                            )}
                            {hasTransitModeSelected && (
                                <TimeOfTripComponent
                                    departureTimeSecondsSinceMidnight={
                                        this.state.object.getAttributes().departureTimeSecondsSinceMidnight
                                    }
                                    arrivalTimeSecondsSinceMidnight={
                                        this.state.object.getAttributes().arrivalTimeSecondsSinceMidnight
                                    }
                                    onValueChange={this.onTripTimeChange}
                                />
                            )}
                            {hasTransitModeSelected && (
                                <TransitRoutingBaseComponent
                                    onValueChange={this.onValueChange}
                                    attributes={this.state.object.getAttributes()}
                                />
                            )}
                            {hasTransitModeSelected && (
                                <InputWrapper label={this.props.t('transit:transitRouting:Scenario')}>
                                    <InputSelect
                                        id={`formFieldTransitRoutingScenario${routingId}`}
                                        value={this.state.formValues.scenarioId}
                                        choices={scenarios}
                                        t={this.props.t}
                                        onValueChange={(e) =>
                                            this.onValueChange('scenarioId', { value: e.target.value })
                                        }
                                    />
                                </InputWrapper>
                            )}
                            {hasTransitModeSelected && (
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
                                            this.onValueChange('withAlternatives', { value: _toBool(e.target.value) })
                                        }
                                    />
                                </InputWrapper>
                            )}

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
                                        onValueUpdated={(value) => this.onValueChange('routingName', value, false)}
                                        pattern={'[^,"\':;\r\n\t\\\\]*'}
                                    />
                                </InputWrapper>
                                <div className="tr__form-buttons-container">
                                    <Button
                                        size="small"
                                        label={this.props.t('transit:transitRouting:SaveTrip')}
                                        color="blue"
                                        onClick={(e) => this.saveRoutingForBatch(routing)}
                                    />
                                </div>
                                {this.state.object.getAttributes().savedForBatch.length > 0 && (
                                    <div className="tr__form-buttons-container">
                                        <Button
                                            icon={faFileDownload}
                                            label={`${this.props.t(
                                                'transit:transitRouting:DownloadBatchRoutingCsv'
                                            )} (${this.state.object.getAttributes().savedForBatch.length})`}
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
                                    onValueUpdated={(e) => this.onValueChange('routingPort', e)}
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                />
                            </InputWrapper>
                            <InputWrapper label={this.props.t('transit:transitRouting:OdTripUuid')}>
                                <InputString
                                    id={`formFieldTransitRoutingOdTripUuid${routingId}`}
                                    value={this.state.formValues.odTripUuid}
                                    onValueUpdated={(e) => this.onValueChange('odTripUuid', e)}
                                />
                            </InputWrapper>
                        </div>
                    </Collapsible>

                    {this.state.object.getErrors() && <FormErrors errors={this.state.object.getErrors()} />}
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
                                                object: routing
                                            });
                                        }
                                    }}
                                />
                            </span>
                        </div>
                    </div>

                    {this.state.currentResult && (
                        <RoutingResultsComponent
                            results={this.state.currentResult}
                            request={this.state.object.attributes}
                            selectedMode={this.state.selectedMode}
                            setSelectedMode={this.setSelectedMode}
                        />
                    )}
                </form>
                <TransitRoutingBatchForm routingEngine={this.state.object} isRoutingEngineValid={this.isValid} />
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'form'])(TransitRoutingForm);
