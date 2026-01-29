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
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';
import _toString from 'lodash/toString';
import { unparse } from 'papaparse';
import moment from 'moment';
import Loader from 'react-spinners/BeatLoader';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import TransitAccessibilityMapRouting, {
    MAX_DELTA_MINUTES,
    MAX_DELTA_INTERVAL_MINUTES,
    MIN_WALKING_SPEED_KPH,
    MAX_WALKING_SPEED_KPH
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { calculateAccessibilityMap } from '../../../services/routing/RoutingUtils';
import { TransitAccessibilityMapWithPolygonResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { mpsToKph, kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import DownloadsUtils from 'chaire-lib-frontend/lib/services/DownloadsService';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { _toBool } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    secondsSinceMidnightToTimeStr,
    secondsToMinutes,
    minutesToSeconds
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import AccessibilityMapStatsComponent from './AccessibilityMapStatsComponent';
import TimeOfTripComponent from '../transitRouting/widgets/TimeOfTripComponent';
import TransitRoutingBaseComponent from '../transitRouting/widgets/TransitRoutingBaseComponent';
import AccessibilityMapBatchForm from './AccessibilityMapBatchForm';
import AccessibilityMapCoordinatesComponent from './widgets/AccessibilityMapCoordinateComponent';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

export interface AccessibilityMapFormProps extends WithTranslation {
    addEventListeners?: () => void;
    removeEventListeners?: () => void;
    fileUploader?: any;
    fileImportRef?: any;
}

interface TransitRoutingFormState extends ChangeEventsState<TransitAccessibilityMapRouting> {
    currentResult?: TransitAccessibilityMapWithPolygonResult;
    scenarioCollection: any;
    loading: boolean;
    routingErrors?: ErrorMessage[];
    geojsonDownloadUrl: string | null;
    jsonDownloadUrl: string | null;
    csvDownloadUrl: string | null;
}

class AccessibilityMapForm extends ChangeEventsForm<AccessibilityMapFormProps, TransitRoutingFormState> {
    calculateRoutingNonce = new Object();

    constructor(props) {
        super(props);

        const routingEngine = new TransitAccessibilityMapRouting(
            _cloneDeep(_get(Preferences.current, 'transit.routing.transitAccessibilityMap'))
        );
        this.state = {
            object: routingEngine,
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            loading: false,
            geojsonDownloadUrl: null,
            jsonDownloadUrl: null,
            csvDownloadUrl: null,
            formValues: {}
        };

        this.polygonCalculated = this.polygonCalculated.bind(this);
        this.calculateRouting = this.calculateRouting.bind(this);
        this.onScenarioCollectionUpdate = this.onScenarioCollectionUpdate.bind(this);

        if (routingEngine.hasLocation()) {
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'accessibilityMapPoints',
                data: routingEngine.locationToGeojson()
            });
        }
    }

    onScenarioCollectionUpdate() {
        this.setState({ scenarioCollection: serviceLocator.collectionManager.get('scenarios') });
    }

    async calculateRouting(refresh = false) {
        const localNonce = (this.calculateRoutingNonce = new Object());
        const isCancelled = () => localNonce !== this.calculateRoutingNonce;
        const routing = this.state.object;
        serviceLocator.eventManager.emit('progress', { name: 'CalculateAccessibilityMap', progress: 0.0 });
        this.setState({ loading: true });
        try {
            const scenarioName = routing.attributes.scenarioId
                ? this.state.scenarioCollection.getById(routing.attributes.scenarioId).get('name')
                : '';
            const currentResult = await calculateAccessibilityMap(routing, refresh, {
                isCancelled,
                additionalProperties: { scenarioName }
            });
            if (isCancelled()) {
                return;
            }
            this.polygonCalculated(currentResult);
        } catch {
            this.setState({
                routingErrors: ['main:errors:ErrorCalculatingAccessibilityMap']
            });
        } finally {
            serviceLocator.eventManager.emit('progress', { name: 'CalculateAccessibilityMap', progress: 1.0 });
            this.setState({ loading: false });
        }
    }

    removePolygons() {
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPolygons',
            data: turfFeatureCollection([])
        });
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPolygonStrokes',
            data: turfFeatureCollection([])
        });
        this.setState({
            currentResult: undefined,
            loading: false
        });
    }

    polygonCalculated(currentResult: TransitAccessibilityMapWithPolygonResult) {
        const { polygons, strokes, resultByNode } = currentResult;

        console.log('polygons calculated');

        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPolygons',
            data: polygons
        });
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPolygonStrokes',
            data: strokes
        });

        this.setState({
            geojsonDownloadUrl: DownloadsUtils.generateJsonDownloadUrl(polygons),
            jsonDownloadUrl: resultByNode ? DownloadsUtils.generateJsonDownloadUrl(resultByNode) : null,
            csvDownloadUrl: resultByNode ? DownloadsUtils.generateCsvDownloadUrl(unparse(resultByNode.nodes)) : null,
            currentResult: currentResult,
            loading: false
        });
    }

    componentDidMount() {
        // If the previously selected scenario was deleted, the current scenario ID will remain but the scenario itself will no longer exist, leading to an error.
        // In that case, change it to undefined.
        const scenarioId = this.state.object.attributes.scenarioId;
        const scenario = this.state.scenarioCollection.getById(scenarioId);
        if (scenarioId !== undefined && scenario === undefined) {
            this.onValueChange('scenarioId', { value: undefined });
        }

        serviceLocator.eventManager.on('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    onValueChange(path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) {
        this.setState({ routingErrors: [] }); //When a value is changed, remove the current routingErrors to stop displaying them.
        super.onValueChange(path, newValue);
    }

    private onTripTimeChange = (time: { value: any; valid?: boolean }, timeType: 'departure' | 'arrival') => {
        this.onValueChange(
            timeType === 'departure' ? 'departureTimeSecondsSinceMidnight' : 'arrivalTimeSecondsSinceMidnight',
            time
        );
    };

    private onUpdateCoordinates = (coordinates?: GeoJSON.Position, checkIfHasLocation: boolean = false) => {
        if (coordinates === undefined) {
            return;
        }

        const routing = this.state.object;
        if (checkIfHasLocation ? routing.hasLocation() : true) {
            routing.setLocation(coordinates);
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'accessibilityMapPoints',
                data: routing.locationToGeojson()
            });
            this.removePolygons();
        }
    };

    render() {
        if (!this.state.scenarioCollection) {
            return <LoadingPage />;
        }

        const routing = this.state.object;
        const routingId = routing.getId();
        const direction = routing.attributes.departureTimeSecondsSinceMidnight
            ? 'from'
            : routing.attributes.arrivalTimeSecondsSinceMidnight
                ? 'to'
                : null;
        const timeSeconds =
            routing.attributes.departureTimeSecondsSinceMidnight || routing.attributes.arrivalTimeSecondsSinceMidnight;
        const timeStr = timeSeconds ? secondsSinceMidnightToTimeStr(timeSeconds) : '';
        const timeStrWithoutColon = timeStr ? timeStr.replace(':', '') : '';

        const scenarios = this.state.scenarioCollection.features.map((scenario) => {
            return {
                value: scenario.id,
                label: scenario.toString(false)
            };
        });

        return (
            <React.Fragment>
                <form
                    id="tr__form-transit-accessibility-map"
                    className="tr__form-transit-accessibility-map apptr__form"
                >
                    <h3>{this.props.t('transit:transitRouting:AccessibilityMap')}</h3>

                    <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            <TimeOfTripComponent
                                departureTimeSecondsSinceMidnight={
                                    this.state.object.attributes.departureTimeSecondsSinceMidnight
                                }
                                arrivalTimeSecondsSinceMidnight={
                                    this.state.object.attributes.arrivalTimeSecondsSinceMidnight
                                }
                                onValueChange={this.onTripTimeChange}
                            />
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:AccessibilityMapNumberOfPolygons')}
                                help={this.props.t(
                                    'transit:transitRouting:AccessibilityMapExampleDurationAndNumberOfPolygons'
                                )}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityMapNumberOfPolygons${routingId}`}
                                    value={routing.get('numberOfPolygons')}
                                    onValueUpdated={(value) => this.onValueChange('numberOfPolygons', value)}
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                    type="number"
                                    min={1}
                                />
                            </InputWrapper>
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:AccessibilityMapDelta')}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityMapDelta${routingId}`}
                                    value={routing.get('deltaSeconds')}
                                    onValueUpdated={(value) => this.onValueChange('deltaSeconds', value)}
                                    stringToValue={minutesToSeconds}
                                    valueToString={(val) => _toString(secondsToMinutes(val))}
                                    type="number"
                                    min={1}
                                    max={MAX_DELTA_MINUTES}
                                />
                            </InputWrapper>
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:AccessibilityMapDeltaInterval')}
                                help={this.props.t('transit:transitRouting:AccessibilityMapExampleDelta')}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityMapDeltaInterval${routingId}`}
                                    value={routing.get('deltaIntervalSeconds')}
                                    onValueUpdated={(value) => this.onValueChange('deltaIntervalSeconds', value)}
                                    stringToValue={minutesToSeconds}
                                    valueToString={(val) => _toString(secondsToMinutes(val))}
                                    type="number"
                                    min={1}
                                    max={MAX_DELTA_INTERVAL_MINUTES}
                                />
                            </InputWrapper>
                            <InputWrapper label={this.props.t('transit:transitRouting:Scenario')}>
                                <InputSelect
                                    id={`formFieldTransitAccessibilityMapScenario${routingId}`}
                                    value={routing.attributes.scenarioId}
                                    choices={scenarios}
                                    t={this.props.t}
                                    onValueChange={(e) => this.onValueChange('scenarioId', { value: e.target.value })}
                                />
                            </InputWrapper>
                            <AccessibilityMapCoordinatesComponent
                                id={'formFieldTransitAccessibilityMapLocation'}
                                locationGeojson={this.state.object.attributes.locationGeojson}
                                onUpdateCoordinates={this.onUpdateCoordinates}
                            />
                            <InputWrapper label={this.props.t('transit:transitRouting:PlaceName')}>
                                <InputString
                                    id={`formFieldTransitAccessibilityMapPlaceName${routingId}`}
                                    value={routing.attributes.placeName}
                                    onValueUpdated={(value) => this.onValueChange('placeName', value)}
                                />
                            </InputWrapper>

                            <TransitRoutingBaseComponent
                                onValueChange={this.onValueChange}
                                attributes={this.state.object.attributes}
                            />
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:WalkingSpeedKph')}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityMapWalkingSpeedKph${routingId}`}
                                    value={routing.get('walkingSpeedMps')}
                                    onValueUpdated={(value) => this.onValueChange('walkingSpeedMps', value)}
                                    stringToValue={(value) =>
                                        !isNaN(parseFloat(value)) ? kphToMps(parseFloat(value)) : null
                                    }
                                    valueToString={(value) =>
                                        _toString(!isNaN(parseFloat(value)) ? roundToDecimals(mpsToKph(value), 1) : '')
                                    }
                                    type="number"
                                    min={MIN_WALKING_SPEED_KPH}
                                    max={MAX_WALKING_SPEED_KPH}
                                />
                            </InputWrapper>
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:CalculatePopulation')}
                            >
                                <InputRadio
                                    id={`formFieldTransitAccessibilityMapCalculatePopulation${routingId}`}
                                    value={routing.attributes.calculatePopulation}
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
                                        this.onValueChange('calculatePopulation', { value: _toBool(e.target.value) })
                                    }
                                />
                            </InputWrapper>
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:CalculatePois')}
                            >
                                <InputRadio
                                    id={`formFieldTransitAccessibilityMapCalculatePOIS${routingId}`}
                                    value={routing.attributes.calculatePois}
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
                                        this.onValueChange('calculatePois', { value: _toBool(e.target.value) })
                                    }
                                />
                            </InputWrapper>
                        </div>
                    </Collapsible>

                    <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                        <div className="tr__form-section">
                            <InputWrapper smallInput={true} label={this.props.t('transit:transitRouting:RoutingPort')}>
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityRoutingPort${routingId}`}
                                    value={routing.get('routingPort')}
                                    onValueUpdated={(value) => this.onValueChange('routingPort', value)}
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                />
                            </InputWrapper>
                        </div>
                    </Collapsible>

                    {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                    {this.state.routingErrors && <FormErrors errors={this.state.routingErrors} />}

                    <FormErrors errors={routing.errors} />

                    <div>
                        <div className="tr__form-buttons-container">
                            {this.state.loading && <Loader size={8} color={'#aaaaaa'} loading={true}></Loader>}
                            {this.state.loading && (
                                <Button
                                    iconClass="_icon-alone"
                                    label={this.props.t('main:Cancel')}
                                    onClick={() => {
                                        this.calculateRoutingNonce = new Object();
                                        console.log('Cancelling');
                                        this.setState({ loading: false });
                                    }}
                                />
                            )}
                            <span title={this.props.t('main:Calculate')}>
                                <Button
                                    icon={faCheckCircle}
                                    iconClass="_icon-alone"
                                    label=""
                                    onClick={() => {
                                        routing.validate();
                                        if (routing.isValid && !this.hasInvalidFields()) {
                                            this.calculateRouting(true);
                                        } else {
                                            this.setState({ object: routing });
                                        }
                                    }}
                                />
                            </span>
                        </div>
                    </div>
                    <div className="tr__form-buttons-container">
                        {this.state.geojsonDownloadUrl && (
                            <Button
                                icon={faFileDownload}
                                color="blue"
                                iconClass="_icon"
                                label={this.props.t('main:GeoJSON')}
                                onClick={() => {
                                    DownloadsUtils.downloadJsonFromBlob(
                                        this.state.geojsonDownloadUrl,
                                        `accessibilityMap_${direction}_${routing.get(
                                            'placeName',
                                            ''
                                        )}_${timeStrWithoutColon}_${moment().format('YYYYMMDD_HHmmss')}.geojson`
                                    );
                                }}
                            />
                        )}
                        {this.state.jsonDownloadUrl && (
                            <Button
                                icon={faFileDownload}
                                color="blue"
                                iconClass="_icon"
                                label={this.props.t('main:JSON')}
                                onClick={() => {
                                    DownloadsUtils.downloadJsonFromBlob(
                                        this.state.jsonDownloadUrl,
                                        `accessibilityMap_${direction}_${routing.get(
                                            'placeName',
                                            ''
                                        )}_${timeStrWithoutColon}_${moment().format('YYYYMMDD_HHmmss')}.json`
                                    );
                                }}
                            />
                        )}
                        {this.state.csvDownloadUrl && (
                            <Button
                                icon={faFileDownload}
                                color="blue"
                                iconClass="_icon"
                                label={this.props.t('main:CSV')}
                                onClick={() => {
                                    DownloadsUtils.downloadCsvFromBlob(
                                        this.state.csvDownloadUrl,
                                        `accessibilityMap_${direction}_${routing.get(
                                            'placeName',
                                            ''
                                        )}_${timeStrWithoutColon}_${moment().format('YYYYMMDD_HHmmss')}.csv`
                                    );
                                }}
                            />
                        )}
                    </div>
                    {this.state.currentResult && (
                        <AccessibilityMapStatsComponent accessibilityPolygons={this.state.currentResult.polygons} />
                    )}
                </form>
                <AccessibilityMapBatchForm routingEngine={this.state.object} />
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(AccessibilityMapForm);
