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
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';
import _toString from 'lodash/toString';
import moment from 'moment';
import Loader from 'react-spinners/BeatLoader';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { calculateAccessibilityMap, calculateAccessibilityMapComparison } from '../../../services/routing/RoutingUtils';
import { TransitAccessibilityMapWithPolygonResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { mpsToKph, kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import DownloadsUtils from 'chaire-lib-frontend/lib/services/DownloadsService';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    secondsSinceMidnightToTimeStr,
    secondsToMinutes,
    minutesToSeconds
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import AccessibilityComparisonStatsComponent from './AccessibilityComparisonStatsComponent';
import * as AccessibilityComparisonConstants from './AccessibilityComparisonConstants';
import TimeOfTripComponent from '../transitRouting/widgets/TimeOfTripComponent';
import TransitRoutingBaseComponent from '../transitRouting/widgets/TransitRoutingBaseComponent';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { FeatureCollection } from 'geojson';

export interface AccessibilityComparisonFormProps extends WithTranslation {
    addEventListeners?: () => void;
    removeEventListeners?: () => void;
    fileUploader?: any;
    fileImportRef?: any;
}

type TransitAccessibilityMapWithPolygonAndTimeResult = TransitAccessibilityMapWithPolygonResult & {
    travelTime?: number;
};

interface TransitRoutingFormState extends ChangeEventsState<TransitAccessibilityMapRouting> {
    currentPolygons?: {
        result1: FeatureCollection;
        result2: FeatureCollection;
    };
    alternateScenarioRouting: TransitAccessibilityMapRouting;
    scenarioCollection: any;
    loading: boolean;
    routingErrors?: ErrorMessage[];
    geojsonDownloadUrl: string | null;
    jsonDownloadUrl: string | null;
    csvDownloadUrl: string | null;
    selectedMaxTime: number;
    possibleMaxTimes: { value: string }[];
    displayMaxTimeSelect: boolean;
    finalMap: TransitAccessibilityMapWithPolygonAndTimeResult[];
    alternateScenario1Id?: string;
    alternateScenario2Id?: string;
}

class AccessibilityComparisonForm extends ChangeEventsForm<AccessibilityComparisonFormProps, TransitRoutingFormState> {
    calculateRoutingNonce = new Object();

    constructor(props) {
        super(props);

        const routingEngine = new TransitAccessibilityMapRouting(
            _cloneDeep(_get(Preferences.current, 'transit.routing.transitAccessibilityMap'))
        );
        const routingEngine2 = new TransitAccessibilityMapRouting(
            _cloneDeep(_get(Preferences.current, 'transit.routing.transitAccessibilityMap'))
        );

        this.state = {
            object: routingEngine,
            alternateScenarioRouting: routingEngine2,
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            loading: false,
            geojsonDownloadUrl: null,
            jsonDownloadUrl: null,
            csvDownloadUrl: null,
            formValues: {},
            selectedMaxTime: 0,
            possibleMaxTimes: [],
            displayMaxTimeSelect: false,
            finalMap: [],
            alternateScenario1Id: '',
            alternateScenario2Id: ''
        };

        this.onClickedOnMap = this.onClickedOnMap.bind(this);
        this.onDragLocation = this.onDragLocation.bind(this);
        this.onUpdateLocation = this.onUpdateLocation.bind(this);
        this.displayMap = this.displayMap.bind(this);
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

    onClickedOnMap(coordinates) {
        const routing = this.state.object;
        const routingAlternate = this.state.alternateScenarioRouting;
        routing.setLocation(coordinates);
        routingAlternate.setLocation(coordinates);

        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPoints',
            data: routing.locationToGeojson()
        });

        this.removePolygons();
    }

    async calculateRouting(refresh = false) {
        const localNonce = (this.calculateRoutingNonce = new Object());
        const isCancelled = () => localNonce !== this.calculateRoutingNonce;
        const routing = this.state.object;
        const alternateRouting = this.state.alternateScenarioRouting;
        serviceLocator.eventManager.emit('progress', { name: 'CalculateAccessibilityMap', progress: 0.0 });
        this.setState({ loading: true });
        try {
            const scenario1Name = routing.attributes.scenarioId
                ? this.state.scenarioCollection.getById(routing.attributes.scenarioId).get('name')
                : '';
            const currentResult1 = await calculateAccessibilityMap(routing, refresh, {
                isCancelled,
                additionalProperties: { scenarioName: scenario1Name }
            });
            if (isCancelled()) {
                return;
            }

            const scenario2Name = alternateRouting.attributes.scenarioId
                ? this.state.scenarioCollection.getById(routing.attributes.scenarioId).get('name')
                : '';
            const currentResult2 = await calculateAccessibilityMap(alternateRouting, refresh, {
                isCancelled,
                additionalProperties: { scenarioName: scenario2Name }
            });
            if (isCancelled()) {
                return;
            }

            const numberOfPolygons = routing.attributes.numberOfPolygons as number;

            const colors = {
                intersectionColor: this.convertToRGBA(AccessibilityComparisonConstants.INTERSECTION_COLOR, 0.6),
                scenario1Minus2Color: this.convertToRGBA(AccessibilityComparisonConstants.SCENARIO_1_COLOR, 0.6),
                scenario2Minus1Color: this.convertToRGBA(AccessibilityComparisonConstants.SCENARIO_2_COLOR, 0.6)
            };

            const mapComparison = await calculateAccessibilityMapComparison(
                currentResult1.polygons,
                currentResult2.polygons,
                numberOfPolygons,
                colors
            );

            const finalMap: TransitAccessibilityMapWithPolygonAndTimeResult[] = [];

            for (let i = 0; i < numberOfPolygons; i++) {
                const singleMap = mapComparison[i];

                const polygons = turfFeatureCollection([
                    ...singleMap.polygons.intersection,
                    ...singleMap.polygons.scenario1Minus2,
                    ...singleMap.polygons.scenario2Minus1
                ]);
                const strokes = turfFeatureCollection([
                    ...singleMap.strokes.intersection,
                    ...singleMap.strokes.scenario1Minus2,
                    ...singleMap.strokes.scenario2Minus1
                ]);
                const travelTime =
                    numberOfPolygons === 1
                        ? routing.attributes.maxTotalTravelTimeSeconds
                        : Number(this.state.possibleMaxTimes[i].value);

                finalMap.push({ polygons, strokes, travelTime });
            }

            this.setState({ finalMap });
            this.setState(
                {
                    currentPolygons: {
                        result1: currentResult1.polygons,
                        result2: currentResult2.polygons
                    }
                },
                () => {
                    this.displayMap(0);
                }
            ); //Function is put in callback, otherwise the map will try to display before the state is updated and throw an error.
            this.removePolygons(false);
        } catch {
            this.setState({
                routingErrors: ['main:errors:ErrorCalculatingAccessibilityMap']
            });
        } finally {
            serviceLocator.eventManager.emit('progress', { name: 'CalculateAccessibilityMap', progress: 1.0 });
            this.setState({ loading: false });
        }
    }

    toggleMapByMaxTime() {
        this.removePolygons(false);
        const selectedMaxTime = this.state.selectedMaxTime;
        if (selectedMaxTime === 0) {
            return;
        }

        const finalMap = this.state.finalMap;

        for (let i = 0; i < finalMap.length; i++) {
            if (selectedMaxTime === finalMap[i].travelTime) {
                this.displayMap(i);
                return;
            }
        }
    }

    removePolygons(removeCurrentResult: boolean = true) {
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPolygons',
            data: turfFeatureCollection([])
        });
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPolygonStrokes',
            data: turfFeatureCollection([])
        });
        this.setState({
            loading: false
        });
        if (removeCurrentResult) {
            this.setState({
                currentPolygons: undefined
            });
        }
    }

    onDragLocation(coordinates) {
        const routing = this.state.object;
        const routingAlternate = this.state.alternateScenarioRouting;
        if (routing.hasLocation()) {
            routing.setLocation(coordinates, false);
            routingAlternate.setLocation(coordinates, false);
            // only update layer for better performance:
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'accessibilityMapPoints',
                data: routing.locationToGeojson()
            });
            this.removePolygons();
        }
    }

    onUpdateLocation(coordinates) {
        const routing = this.state.object;
        const routingAlternate = this.state.alternateScenarioRouting;
        // only update layer and routing engine object:
        routing.setLocation(coordinates);
        routingAlternate.setLocation(coordinates, false);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'accessibilityMapPoints',
            data: routing.locationToGeojson()
        });
        this.removePolygons();
    }

    displayMap(index: number) {
        const currentResult = this.state.finalMap[index];
        const { polygons, strokes } = currentResult;

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
            loading: false
        });
    }

    componentDidMount() {
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.dragLocation', this.onDragLocation);
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.updateLocation', this.onUpdateLocation);
        serviceLocator.eventManager.on('routing.transitAccessibilityMap.clickedOnMap', this.onClickedOnMap);
        serviceLocator.eventManager.on('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('routing.transitAccessibilityMap.dragLocation', this.onDragLocation);
        serviceLocator.eventManager.off('routing.transitAccessibilityMap.updateLocation', this.onUpdateLocation);
        serviceLocator.eventManager.off('routing.transitAccessibilityMap.clickedOnMap', this.onClickedOnMap);
        serviceLocator.eventManager.off('collection.update.scenarios', this.onScenarioCollectionUpdate);
    }

    getDurations() {
        const routing = this.state.object;
        const maxDuration = routing.attributes.maxTotalTravelTimeSeconds as number;
        const numberOfPolygons = routing.attributes.numberOfPolygons as number;
        const durations: any[] = [];
        for (let i = numberOfPolygons; i > 0; i--) {
            const timeInSeconds = Math.ceil((i * maxDuration) / numberOfPolygons);
            const timeInMinutes = secondsToMinutes(timeInSeconds) as number;
            durations.push({ value: timeInMinutes.toString() });
        }
        this.setState({ possibleMaxTimes: durations });
    }

    validateNumberOfPolygons() {
        const routing = this.state.object;
        const maxDuration = routing.attributes.maxTotalTravelTimeSeconds;
        const numberOfPolygons = routing.attributes.numberOfPolygons;
        if (typeof numberOfPolygons !== 'number' || numberOfPolygons <= 1) {
            this.setState({ displayMaxTimeSelect: false });
            this.setState({ possibleMaxTimes: [] });
            return;
        }

        // We do not want the number of poygons to be larger than the number of minutes, hence why we divide the time by 60.
        if (typeof maxDuration !== 'number' || maxDuration / 60 < numberOfPolygons) {
            this.setState({ displayMaxTimeSelect: false });
            this.setState({ possibleMaxTimes: [] });
            return;
        }

        this.setState({ displayMaxTimeSelect: true });
        this.getDurations();
    }

    private onTripTimeChange = (
        time: { value: any; valid?: boolean },
        timeType: 'departure' | 'arrival',
        alternateRouting: TransitAccessibilityMapRouting
    ) => {
        const timeAttribute =
            timeType === 'departure' ? 'departureTimeSecondsSinceMidnight' : 'arrivalTimeSecondsSinceMidnight';
        this.updateBothRoutingEngines(timeAttribute, time, alternateRouting);
    };

    private updateBothRoutingEngines = (
        path: string,
        newValue: { value: any; valid?: boolean },
        alternateRouting: TransitAccessibilityMapRouting
    ) => {
        this.onValueChange(path, newValue);
        if (newValue.valid || newValue.valid === undefined) {
            alternateRouting.attributes[path] = newValue.value;
        }
    };

    private convertToRGBA = (rgbValue: string, alpha: number) => {
        return rgbValue.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    };

    render() {
        if (!this.state.scenarioCollection) {
            return <LoadingPage />;
        }

        const routing = this.state.object;
        const alternateRouting = this.state.alternateScenarioRouting;
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
                    <h3>{this.props.t('transit:accessibilityComparison:Title')}</h3>

                    <Collapsible
                        trigger={this.props.t('transit:accessibilityComparison:Legend')}
                        open={true}
                        transitionTime={100}
                    >
                        <div className="tr__form-section">
                            {this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })}: &nbsp;
                            <span style={{ color: AccessibilityComparisonConstants.SCENARIO_1_COLOR }}>&#9673;</span>
                        </div>
                        <div className="tr__form-section">
                            {this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })}: &nbsp;
                            <span style={{ color: AccessibilityComparisonConstants.SCENARIO_2_COLOR }}>&#9673;</span>
                        </div>
                        <div className="tr__form-section">
                            {this.props.t('transit:accessibilityComparison:ScenarioIntersection')}: &nbsp;
                            <span style={{ color: AccessibilityComparisonConstants.INTERSECTION_COLOR }}>&#9673;</span>
                        </div>
                    </Collapsible>

                    <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            <TimeOfTripComponent
                                departureTimeSecondsSinceMidnight={
                                    this.state.object.getAttributes().departureTimeSecondsSinceMidnight
                                }
                                arrivalTimeSecondsSinceMidnight={
                                    this.state.object.getAttributes().arrivalTimeSecondsSinceMidnight
                                }
                                onValueChange={(time, timeType) => {
                                    this.onTripTimeChange(time, timeType, alternateRouting);
                                }}
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
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('numberOfPolygons', value, alternateRouting)
                                    }
                                    stringToValue={_toInteger}
                                    valueToString={_toString}
                                    type="number"
                                />
                            </InputWrapper>
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:AccessibilityMapDelta')}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityMapDelta${routingId}`}
                                    value={routing.get('deltaSeconds')}
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('deltaSeconds', value, alternateRouting)
                                    }
                                    stringToValue={minutesToSeconds}
                                    valueToString={(val) => _toString(secondsToMinutes(val))}
                                    type="number"
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
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('deltaIntervalSeconds', value, alternateRouting)
                                    }
                                    stringToValue={minutesToSeconds}
                                    valueToString={(val) => _toString(secondsToMinutes(val))}
                                    type="number"
                                />
                            </InputWrapper>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                <InputWrapper
                                    label={this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })}
                                >
                                    <InputSelect
                                        id={`formFieldTransitAccessibilityMapScenario1${routingId}`}
                                        value={routing.attributes.scenarioId}
                                        choices={scenarios}
                                        t={this.props.t}
                                        onValueChange={(e) => {
                                            this.onValueChange('alternateScenario1Id', { value: e.target.value });
                                            routing.attributes.scenarioId = e.target.value;
                                        }}
                                    />
                                </InputWrapper>
                                <InputWrapper
                                    label={this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })}
                                >
                                    <InputSelect
                                        id={`formFieldTransitAccessibilityMapScenario2${routingId}`}
                                        value={alternateRouting.attributes.scenarioId}
                                        choices={scenarios}
                                        t={this.props.t}
                                        onValueChange={(e) => {
                                            this.onValueChange('alternateScenario2Id', { value: e.target.value });
                                            alternateRouting.attributes.scenarioId = e.target.value;
                                        }}
                                    />
                                </InputWrapper>
                            </div>
                            <InputWrapper label={this.props.t('transit:transitRouting:PlaceName')}>
                                <InputString
                                    id={`formFieldTransitAccessibilityMapPlaceName${routingId}`}
                                    value={routing.attributes.placeName}
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('placeName', value, alternateRouting)
                                    }
                                />
                            </InputWrapper>

                            <TransitRoutingBaseComponent
                                onValueChange={(path, newValue) =>
                                    this.updateBothRoutingEngines(path, newValue, alternateRouting)
                                }
                                attributes={this.state.object.getAttributes()}
                            />
                            <InputWrapper
                                smallInput={true}
                                label={this.props.t('transit:transitRouting:WalkingSpeedKph')}
                            >
                                <InputStringFormatted
                                    id={`formFieldTransitAccessibilityMapWalkingSpeedKph${routingId}`}
                                    value={routing.get('walkingSpeedMps')}
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('walkingSpeedMps', value, alternateRouting)
                                    }
                                    stringToValue={(value) =>
                                        !isNaN(parseFloat(value)) ? kphToMps(parseFloat(value)) : null
                                    }
                                    valueToString={(value) =>
                                        _toString(!isNaN(parseFloat(value)) ? roundToDecimals(mpsToKph(value), 1) : '')
                                    }
                                    type="number"
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
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('routingPort', value, alternateRouting)
                                    }
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
                                        this.validateNumberOfPolygons();
                                        this.setState({ object: routing, alternateScenarioRouting: alternateRouting });
                                        if (routing.isValid && !this.hasInvalidFields()) {
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
                    {this.state.currentPolygons && (
                        <React.Fragment>
                            {this.state.displayMaxTimeSelect && (
                                <InputWrapper label={this.props.t('transit:accessibilityComparison:SelectMaxTime')}>
                                    <InputSelect
                                        id={`formFieldTransitAccessibilityMaxTimeChoice${routingId}`}
                                        value={this.state.selectedMaxTime.toString()}
                                        choices={this.state.possibleMaxTimes}
                                        t={this.props.t}
                                        noBlank={true}
                                        onValueChange={(e) => {
                                            this.setState(
                                                { selectedMaxTime: Number(e.target.value) },
                                                this.toggleMapByMaxTime
                                            );
                                        }}
                                    />
                                </InputWrapper>
                            )}
                            <AccessibilityComparisonStatsComponent accessibilityPolygons={this.state.currentPolygons} />
                        </React.Fragment>
                    )}
                </form>
                {/* TODO: Add batch calculation form */}
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(AccessibilityComparisonForm);
