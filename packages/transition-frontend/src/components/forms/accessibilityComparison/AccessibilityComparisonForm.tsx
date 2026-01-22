/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { createRoot, Root } from 'react-dom/client';
import { withTranslation, WithTranslation } from 'react-i18next';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faFileDownload } from '@fortawesome/free-solid-svg-icons/faFileDownload';
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';
import _toString from 'lodash/toString';
import moment from 'moment';
import Loader from 'react-spinners/BeatLoader';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import maplibregl from 'maplibre-gl';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
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
import { calculateAccessibilityMap, calculateAccessibilityMapComparison } from '../../../services/routing/RoutingUtils';
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
import AccessibilityComparisonStatsComponent from './AccessibilityComparisonStatsComponent';
import * as AccessibilityComparisonConstants from './accessibilityComparisonConstants';
import { comparisonModes } from './comparisonModes';
import AccessibilityMapCoordinatesComponent from '../accessibilityMap/widgets/AccessibilityMapCoordinateComponent';
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
    contextMenu: HTMLElement | null;
    contextMenuRoot: Root | undefined;
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
            formValues: {
                selectedMode: 'scenarios'
            },
            selectedMaxTime: 0,
            possibleMaxTimes: [],
            displayMaxTimeSelect: false,
            finalMap: [],
            alternateScenario1Id: '',
            alternateScenario2Id: '',
            contextMenu: null,
            contextMenuRoot: undefined
        };

        this.displayMap = this.displayMap.bind(this);
        this.calculateRouting = this.calculateRouting.bind(this);
        this.onScenarioCollectionUpdate = this.onScenarioCollectionUpdate.bind(this);

        routingEngine.updatePointColor(AccessibilityComparisonConstants.INTERSECTION_COLOR);
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
                scenario1Minus2Color: this.convertToRGBA(AccessibilityComparisonConstants.MAP_1_COLOR, 0.6),
                scenario2Minus1Color: this.convertToRGBA(AccessibilityComparisonConstants.MAP_2_COLOR, 0.6)
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
        // If a previously selected scenario was deleted, the current scenario ID will remain but the scenario itself will no longer exist, leading to an error.
        // In that case, change it to undefined.
        const scenarioId1 = this.state.object.attributes.scenarioId;
        const scenario1 = this.state.scenarioCollection.getById(scenarioId1);
        if (scenarioId1 !== undefined && scenario1 === undefined) {
            this.state.object.set('scenarioId', undefined);
            this.onValueChange('alternateScenario1Id', { value: undefined });
        }

        const scenarioId2 = this.state.alternateScenarioRouting.attributes.scenarioId;
        const scenario2 = this.state.scenarioCollection.getById(scenarioId2);
        if (scenarioId2 !== undefined && scenario2 === undefined) {
            this.state.alternateScenarioRouting.set('scenarioId', undefined);
            this.onValueChange('alternateScenario2Id', { value: undefined });
        }

        const contextMenu = document.getElementById('tr__main-map-context-menu');
        this.setState({
            contextMenu,
            contextMenuRoot: contextMenu ? createRoot(contextMenu) : undefined
        });
        serviceLocator.eventManager.on('collection.update.scenarios', this.onScenarioCollectionUpdate);
        serviceLocator.eventManager.on('map.showMapComparisonContextMenu', this.showContextMenu);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('collection.update.scenarios', this.onScenarioCollectionUpdate);
        serviceLocator.eventManager.off('map.showMapComparisonContextMenu', this.showContextMenu);
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

    onValueChange(path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) {
        this.setState({ routingErrors: [] }); //When a value is changed, remove the current routingErrors to stop displaying them.
        super.onValueChange(path, newValue);
    }

    // FIXME: We only want this menu to be available when the comparison mode is locations, so we include it here instead of AccessibilityMapSectionMapEvents.ts.
    // We should find a way to move this function to the events file once we migrate to Deck.gl.
    private showContextMenu = (e: maplibregl.MapMouseEvent, elements) => {
        if (this.state.formValues.selectedMode !== 'locations') {
            return;
        }
        const contextMenu = this.state.contextMenu;
        if (!contextMenu || !this.state.contextMenuRoot) {
            return;
        }
        contextMenu.style.left = e.point.x + 'px';
        contextMenu.style.top = e.point.y + 'px';
        contextMenu.style.display = 'block';

        this.state.contextMenuRoot.render(
            <ul>
                {elements.map((element) => (
                    <li
                        key={element.key ? element.key : element.title}
                        style={{ display: 'block', padding: '5px' }}
                        onClick={() => {
                            element.onClick();
                            contextMenu.style.display = 'none';
                        }}
                        onMouseOver={() => element.onHover && element.onHover()}
                    >
                        {this.props.t(element.title)}
                    </li>
                ))}
            </ul>
        );
    };

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

    private onUpdateCoordinatesForBothEngines = (
        coordinates?: GeoJSON.Position,
        checkIfHasLocation: boolean = false
    ) => {
        if (coordinates === undefined) {
            return;
        }

        const routing = this.state.object;
        const routingAlternate = this.state.alternateScenarioRouting;
        // We want to check if there is already a location when dragging the point, to avoid bugs with the location being undefined.
        // This is unnecessary when clicking the map, as the location is directly set no matter what.
        if (checkIfHasLocation ? routing.hasLocation() : true) {
            routing.setLocation(coordinates);
            routingAlternate.setLocation(coordinates, false);
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'accessibilityMapPoints',
                data: routing.locationToGeojson()
            });
            this.removePolygons();
        }
    };

    private updateCoordinatesForOneEngine = (
        routingEngine: TransitAccessibilityMapRouting,
        locationName: string,
        coordinates?: GeoJSON.Position,
        checkIfHasLocation: boolean = false
    ) => {
        if (coordinates === undefined) {
            return;
        }

        if (checkIfHasLocation ? routingEngine.hasLocation() : true) {
            routingEngine.setLocation(coordinates, false, locationName);
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'accessibilityMapPoints',
                data: this.bothLocationsToGeojson()
            });
            this.removePolygons();
        }
    };

    private onUpdateCoordinatesForMainRoutingEngine = (
        coordinates?: GeoJSON.Position,
        checkIfHasLocation?: boolean
    ) => {
        const routing = this.state.object;
        this.updateCoordinatesForOneEngine(routing, 'accessibilityMapLocation', coordinates, checkIfHasLocation);
    };

    private onUpdateCoordinatesForAlternateRoutingEngine = (
        coordinates?: GeoJSON.Position,
        checkIfHasLocation?: boolean
    ) => {
        const routingAlternate = this.state.alternateScenarioRouting;
        this.updateCoordinatesForOneEngine(
            routingAlternate,
            'accessibilityMapLocation2',
            coordinates,
            checkIfHasLocation
        );
    };

    private bothLocationsToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        // We start with the second engine so that the first location will be visually above the second when the two points are overlapping.
        const routingAlternate = this.state.alternateScenarioRouting;
        const location2 = routingAlternate.attributes.locationGeojson;
        if (location2) {
            features.push(location2);
        }
        const routing = this.state.object;
        const location1 = routing.attributes.locationGeojson;
        if (location1) {
            features.push(location1);
        }
        return {
            type: 'FeatureCollection',
            features
        };
    }

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

        const returnTabContent = (mode: string) => {
            return (
                <React.Fragment>
                    <Collapsible
                        trigger={this.props.t('transit:accessibilityComparison:Legend')}
                        open={true}
                        transitionTime={100}
                    >
                        <div className="tr__form-section">
                            {mode === 'scenarios'
                                ? this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })
                                : this.props.t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}
                            : &nbsp;
                            <span style={{ color: AccessibilityComparisonConstants.MAP_1_COLOR }}>&#9673;</span>
                        </div>
                        <div className="tr__form-section">
                            {mode === 'scenarios'
                                ? this.props.t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })
                                : this.props.t('transit:accessibilityComparison:LocationN', { locationNumber: '2' })}
                            : &nbsp;
                            <span style={{ color: AccessibilityComparisonConstants.MAP_2_COLOR }}>&#9673;</span>
                        </div>
                        <div className="tr__form-section">
                            {this.props.t(
                                `transit:accessibilityComparison:${mode === 'scenarios' ? 'Scenario' : 'Location'}Intersection`
                            )}
                            : &nbsp;
                            <span style={{ color: AccessibilityComparisonConstants.INTERSECTION_COLOR }}>&#9673;</span>
                        </div>
                    </Collapsible>

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
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('deltaSeconds', value, alternateRouting)
                                    }
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
                                    onValueUpdated={(value) =>
                                        this.updateBothRoutingEngines('deltaIntervalSeconds', value, alternateRouting)
                                    }
                                    stringToValue={minutesToSeconds}
                                    valueToString={(val) => _toString(secondsToMinutes(val))}
                                    type="number"
                                    min={1}
                                    max={MAX_DELTA_INTERVAL_MINUTES}
                                />
                            </InputWrapper>
                            {/* TODO: If we add a new mode, separate the changing sections into different subcomponents to be cleaner. */}
                            {mode === 'scenarios' && (
                                <React.Fragment>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        <InputWrapper
                                            label={this.props.t('transit:transitComparison:ScenarioN', {
                                                scenarioNumber: '1'
                                            })}
                                        >
                                            <InputSelect
                                                id={`formFieldTransitAccessibilityMapScenario1${routingId}`}
                                                value={routing.attributes.scenarioId}
                                                choices={scenarios}
                                                t={this.props.t}
                                                onValueChange={(e) => {
                                                    this.onValueChange('alternateScenario1Id', {
                                                        value: e.target.value
                                                    });
                                                    routing.attributes.scenarioId = e.target.value;
                                                }}
                                            />
                                        </InputWrapper>
                                        <InputWrapper
                                            label={this.props.t('transit:transitComparison:ScenarioN', {
                                                scenarioNumber: '2'
                                            })}
                                        >
                                            <InputSelect
                                                id={`formFieldTransitAccessibilityMapScenario2${routingId}`}
                                                value={alternateRouting.attributes.scenarioId}
                                                choices={scenarios}
                                                t={this.props.t}
                                                onValueChange={(e) => {
                                                    this.onValueChange('alternateScenario2Id', {
                                                        value: e.target.value
                                                    });
                                                    alternateRouting.attributes.scenarioId = e.target.value;
                                                }}
                                            />
                                        </InputWrapper>
                                    </div>
                                    <AccessibilityMapCoordinatesComponent
                                        id={'formFieldTransitAccessibilityMapComparisonLocation'}
                                        locationGeojson={this.state.object.attributes.locationGeojson}
                                        onUpdateCoordinates={this.onUpdateCoordinatesForBothEngines}
                                    />
                                    <InputWrapper label={this.props.t('transit:transitRouting:PlaceName')}>
                                        <InputString
                                            id={`formFieldTransitAccessibilityMapPlaceName${routingId}`}
                                            value={routing.attributes.placeName}
                                            onValueUpdated={(value) =>
                                                this.updateBothRoutingEngines('placeName', value, alternateRouting)
                                            }
                                        />
                                    </InputWrapper>
                                </React.Fragment>
                            )}
                            {mode === 'locations' && (
                                <React.Fragment>
                                    <InputWrapper label={this.props.t('transit:transitRouting:Scenario')}>
                                        <InputSelect
                                            id={`formFieldTransitAccessibilityMapScenario${routingId}`}
                                            value={routing.attributes.scenarioId}
                                            choices={scenarios}
                                            t={this.props.t}
                                            onValueChange={(e) => {
                                                this.onValueChange('scenarioId', { value: e.target.value });
                                                routing.attributes.scenarioId = e.target.value;
                                                alternateRouting.attributes.scenarioId = e.target.value;
                                            }}
                                        />
                                    </InputWrapper>
                                    <AccessibilityMapCoordinatesComponent
                                        id={'formFieldTransitAccessibilityMapComparisonLocation1'}
                                        locationGeojson={this.state.object.attributes.locationGeojson}
                                        onUpdateCoordinates={this.onUpdateCoordinatesForMainRoutingEngine}
                                    />
                                    <InputWrapper label={this.props.t('transit:transitRouting:PlaceNameN', { n: '1' })}>
                                        <InputString
                                            id={`formFieldTransitAccessibilityMapPlace1Name${routingId}`}
                                            value={routing.attributes.placeName}
                                            onValueUpdated={(value) => this.onValueChange('placeName', value)}
                                        />
                                    </InputWrapper>
                                    <br />
                                    <AccessibilityMapCoordinatesComponent
                                        id={'formFieldTransitAccessibilityMapComparisonLocation2'}
                                        locationGeojson={this.state.object.attributes.locationGeojson}
                                        onUpdateCoordinates={this.onUpdateCoordinatesForAlternateRoutingEngine}
                                        locationName={'accessibilityMapLocation2'}
                                    />
                                    <InputWrapper label={this.props.t('transit:transitRouting:PlaceNameN', { n: '2' })}>
                                        <InputString
                                            id={`formFieldTransitAccessibilityMapPlace2Name${routingId}`}
                                            value={alternateRouting.attributes.placeName}
                                            onValueUpdated={(value) => {
                                                this.onValueChange('place2Name', value);
                                                alternateRouting.attributes.placeName = value.value;
                                            }}
                                        />
                                    </InputWrapper>
                                </React.Fragment>
                            )}

                            <TransitRoutingBaseComponent
                                onValueChange={(path, newValue) =>
                                    this.updateBothRoutingEngines(path, newValue, alternateRouting)
                                }
                                attributes={this.state.object.attributes}
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
                                    min={MIN_WALKING_SPEED_KPH}
                                    max={MAX_WALKING_SPEED_KPH}
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
                                        this.updateBothRoutingEngines(
                                            'calculatePois',
                                            { value: _toBool(e.target.value) },
                                            alternateRouting
                                        )
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
                                            this.calculateRouting();
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
                                        `accessibilityMap_${direction}_${routing.get('placeName', '')}${
                                            mode === 'locations' && alternateRouting.attributes.placeName
                                                ? `${routing.attributes.placeName ? '_and_' : ''}${alternateRouting.get('placeName', '')}`
                                                : ''
                                        }_${timeStrWithoutColon}_${moment().format('YYYYMMDD_HHmmss')}.geojson`
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
                            <AccessibilityComparisonStatsComponent
                                accessibilityPolygons={this.state.currentPolygons}
                                mode={mode}
                            />
                        </React.Fragment>
                    )}
                </React.Fragment>
            );
        };

        return (
            <form id="tr__form-transit-accessibility-map" className="tr__form-transit-accessibility-map apptr__form">
                <h3>{this.props.t('transit:accessibilityComparison:Title')}</h3>
                <br></br>
                <Tabs
                    onSelect={(index, lastIndex, _e) => {
                        if (index !== lastIndex) {
                            const value = comparisonModes[index];
                            this.onValueChange('selectedMode', { value });
                            if (value === 'scenarios') {
                                routing.updatePointColor(AccessibilityComparisonConstants.INTERSECTION_COLOR);
                                alternateRouting.updatePointColor(AccessibilityComparisonConstants.INTERSECTION_COLOR);
                                if (routing.hasLocation()) {
                                    alternateRouting.setLocation(
                                        routing.attributes.locationGeojson!.geometry.coordinates
                                    );
                                    (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>(
                                        'map.updateLayer',
                                        {
                                            layerName: 'accessibilityMapPoints',
                                            data: routing.locationToGeojson()
                                        }
                                    );
                                }
                            } else if (value === 'locations') {
                                routing.updatePointColor(AccessibilityComparisonConstants.MAP_1_COLOR);
                                alternateRouting.updatePointColor(AccessibilityComparisonConstants.MAP_2_COLOR);
                                alternateRouting.attributes.scenarioId = routing.attributes.scenarioId;
                                if (routing.hasLocation()) {
                                    alternateRouting.setLocation(
                                        routing.attributes.locationGeojson!.geometry.coordinates,
                                        false,
                                        'accessibilityMapLocation2'
                                    );
                                    (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>(
                                        'map.updateLayer',
                                        {
                                            layerName: 'accessibilityMapPoints',
                                            data: this.bothLocationsToGeojson()
                                        }
                                    );
                                }
                            }
                        }
                    }}
                >
                    <TabList>
                        <Tab key={comparisonModes[0]}>
                            {this.props.t('transit:accessibilityComparison:ComparisonByScenario')}
                        </Tab>
                        <Tab key={comparisonModes[1]}>
                            {this.props.t('transit:accessibilityComparison:ComparisonByLocation')}
                        </Tab>
                    </TabList>
                    <TabPanel key={comparisonModes[0]}>{returnTabContent(comparisonModes[0])}</TabPanel>
                    <TabPanel key={comparisonModes[1]}>{returnTabContent(comparisonModes[1])}</TabPanel>
                </Tabs>
                {/* TODO: Add batch calculation form */}
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(AccessibilityComparisonForm);
