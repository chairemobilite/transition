/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash.get';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import {
    TrRoutingPath,
    TrRoutingBoardingStep,
    TrRoutingUnboardingStep,
    TrRoutingWalkingStep,
    TrRoutingStep
} from 'chaire-lib-common/lib/api/TrRouting';
import { Route, RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { getRouteByMode } from 'chaire-lib-common/lib/services/routing/RoutingUtils';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import PathCollection from '../path/PathCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { RouteCalculatorResult } from './RouteCalculatorResult';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';

interface StepGeojsonProperties {
    distanceMeters: number;
    travelTimeSeconds: number;
    color?: string;
    stepSequence?: number;
    mode?: string;
    action?: 'walking' | 'ride';
    type?: string;
    departureTimeSeconds?: number;
    agencyAcronym?: string;
    agencyUuid?: string;
    lineShortname?: string;
    lineUuid?: string;
    pathUuid?: string;
    legSequenceInTrip?: number;
    arrivalTimeSeconds?: number;
    inVehicleTimeSeconds?: number;
    inVehicleDistanceMeters?: number;
}

// TODO tahini: paths and walkOnlyPath should share a same type
interface TransitResultParams {
    origin: GeoJSON.Feature<GeoJSON.Point>;
    destination: GeoJSON.Feature<GeoJSON.Point>;
    hasAlternatives: boolean;
    paths: TrRoutingPath[];
    walkOnlyPath?: Route;
    maxWalkingTime?: number | undefined;
    error?: TrError;
}

export class TransitRoutingResult implements RouteCalculatorResult {
    private _origin: GeoJSON.Feature<GeoJSON.Point>;
    private _destination: GeoJSON.Feature<GeoJSON.Point>;
    private _paths: TrRoutingPath[];
    private _hasAlternatives: boolean;
    private _walkOnlyPath: Route | undefined;
    private _walkOnlyPathIndex: number;
    private _error: TrError | undefined;

    constructor(params: TransitResultParams) {
        this._origin = params.origin;
        this._destination = params.destination;
        this._hasAlternatives = params.hasAlternatives;
        this._paths = params.paths;
        this._walkOnlyPath = params.walkOnlyPath;
        this._error = params.error;

        // Find the index at which to place the walk only path
        if (params.walkOnlyPath) {
            const walkPathDuration = params.walkOnlyPath.duration;
            if (params.maxWalkingTime && params.maxWalkingTime < walkPathDuration) {
                this._walkOnlyPathIndex = -1;
            } else {
                const walkIndex = this._paths.findIndex((path) => walkPathDuration <= path.totalTravelTimeMinutes * 60);
                this._walkOnlyPathIndex = walkIndex >= 0 ? walkIndex : this._paths.length;
            }
        } else {
            this._walkOnlyPathIndex = -1;
        }
    }

    hasAlternatives(): boolean {
        return this._walkOnlyPathIndex !== -1 ? true : this._hasAlternatives;
    }

    getAlternativesCount(): number {
        return this._walkOnlyPathIndex !== -1 ? this._paths.length + 1 : this._paths.length;
    }

    getRoutingMode(): RoutingOrTransitMode {
        return 'transit';
    }

    getPath(index: number): TrRoutingPath | undefined {
        return index === this._walkOnlyPathIndex
            ? undefined
            : this._walkOnlyPathIndex !== -1 && index >= this._walkOnlyPathIndex
                ? this._paths[index - 1]
                : this._paths[index];
    }

    getWalkOnlyRoute(): Route | undefined {
        return this._walkOnlyPath;
    }

    originDestinationToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        return {
            type: 'FeatureCollection',
            features: [this._origin, this._destination]
        };
    }

    private async generatePathGeojson(
        steps: TrRoutingStep[],
        walkingSegmentsGeojson: GeoJSON.Feature<GeoJSON.Geometry, StepGeojsonProperties>[],
        options: { completeData?: boolean; pathCollection?: PathCollection } = { completeData: false }
    ): Promise<GeoJSON.FeatureCollection> {
        //console.log('steps', steps);
        const features: GeoJSON.Feature[] = [];
        let walkingSegmentIndex = 0;
        let currentStepIndex = 0;
        const completeData = options.completeData || false;
        const pathCollection: PathCollection = options.pathCollection || serviceLocator.collectionManager?.get('paths');

        // FIXME tahini Do something about the walking only segment
        for (let i = 0, count = steps.length; i < count; i++) {
            const step = steps[i];
            if (step.action === 'walking') {
                const walkingSegmentGeojson = walkingSegmentsGeojson[walkingSegmentIndex];
                if (walkingSegmentGeojson) {
                    // TODO: transferring at same node doesn't generate a path, we should deal with this.
                    walkingSegmentGeojson.id = i + 2;
                    // TODO tahini: this class shouldn't access preferences, properties could be passed somehow
                    walkingSegmentGeojson.properties = {
                        ...walkingSegmentGeojson.properties,
                        color: _get(Preferences.current, 'transit.routing.transit.walkingSegmentsColor'),
                        mode: 'walking',
                        action: 'walking',
                        stepSequence: currentStepIndex++
                    };
                    if (completeData) {
                        walkingSegmentGeojson.properties = {
                            ...walkingSegmentGeojson.properties,
                            type: step.type,
                            departureTimeSeconds: step.departureTimeSeconds,
                            arrivalTimeSeconds: step.arrivalTimeSeconds
                        };
                    }
                    features.push(walkingSegmentGeojson);
                }
                walkingSegmentIndex++;
            }
            if (step.action === 'board') {
                const boardStep = step as TrRoutingBoardingStep;
                const nextStep = steps[i + 1];
                if (nextStep && nextStep.action === 'unboard' && nextStep.pathUuid && pathCollection) {
                    const unboardStep = nextStep as TrRoutingUnboardingStep;
                    const path = pathCollection.getById(unboardStep.pathUuid);
                    if (path && path.geometry) {
                        const pathCoordinates = path.geometry.coordinates;
                        const pathSegments = path.properties.segments;
                        const startSequence = step.legSequenceInTrip - 1;
                        const endSequence = unboardStep.legSequenceInTrip - 1;
                        const pathCoordinatesStartIndex = pathSegments[startSequence];
                        const pathCoordinatesEndIndex =
                            pathSegments.length - 1 >= endSequence + 1
                                ? pathSegments[endSequence + 1]
                                : pathCoordinates.length - 1;
                        const segmentCoordinates = pathCoordinates.slice(
                            pathCoordinatesStartIndex,
                            pathCoordinatesEndIndex + 1
                        ); // slice does not include end index
                        let properties: StepGeojsonProperties = {
                            distanceMeters: unboardStep.inVehicleDistanceMeters,
                            travelTimeSeconds: unboardStep.inVehicleTimeSeconds,
                            color: path.properties.color,
                            stepSequence: currentStepIndex++,
                            action: 'ride'
                        };
                        if (completeData) {
                            properties = {
                                ...properties,
                                departureTimeSeconds: boardStep.departureTimeSeconds,
                                agencyAcronym: boardStep.agencyAcronym,
                                agencyUuid: boardStep.agencyUuid,
                                lineShortname: boardStep.lineShortname,
                                lineUuid: boardStep.lineUuid,
                                pathUuid: boardStep.pathUuid,
                                mode: boardStep.mode,
                                legSequenceInTrip: boardStep.legSequenceInTrip,
                                arrivalTimeSeconds: unboardStep.arrivalTimeSeconds
                            };
                        }
                        features.push({
                            type: 'Feature',
                            id: i + 2,
                            properties,
                            geometry: {
                                type: 'LineString',
                                coordinates: segmentCoordinates
                            }
                        });
                    }
                }
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }

    getWalkPathGeojson(): GeoJSON.FeatureCollection {
        // TODO tahini: A route to geojson should be somewhere else than here
        if (!this._walkOnlyPath) {
            throw 'Walk only path not available!';
        }
        if (this._walkOnlyPath.geometry) {
            const geojson: GeoJSON.Feature<GeoJSON.Geometry, StepGeojsonProperties> = {
                type: 'Feature',
                geometry: this._walkOnlyPath.geometry,
                properties: {
                    distanceMeters: this._walkOnlyPath.distance,
                    travelTimeSeconds: this._walkOnlyPath.duration,
                    mode: 'walking',
                    color: _get(Preferences.current, 'transit.routing.transit.walkingSegmentsColor')
                } as StepGeojsonProperties
            };
            return {
                type: 'FeatureCollection',
                features: [geojson]
            };
        }
        throw 'Geometry should be in the route, it is not';
    }

    async getPathGeojson(
        index: number,
        options: { completeData?: boolean; pathCollection?: PathCollection } = { completeData: false }
    ): Promise<GeoJSON.FeatureCollection> {
        // TODO tahini: Path vs walk only route should be better managed
        // Find whether we display a path, or the walk only route
        if (index === this._walkOnlyPathIndex) {
            return this.getWalkPathGeojson();
        }
        const path =
            this._walkOnlyPathIndex !== -1 && index >= this._walkOnlyPathIndex
                ? this._paths[index - 1]
                : this._paths[index];
        if (!path) {
            return {
                type: 'FeatureCollection',
                features: []
            };
        }
        const walkingSegmentsRoutingPromises: Promise<RouteResults>[] = [];
        const steps = path.steps;

        steps.forEach((step, stepIndex) => {
            // TODO tahini: there's an assumption on the type of the next step. This class shouldn't be responsible for it
            if (step.action !== 'walking') {
                return;
            }
            const walkingStep = step as TrRoutingWalkingStep;
            if (walkingStep.type === 'access') {
                // access segment
                const nextBoardingStep = steps[stepIndex + 1] as TrRoutingBoardingStep;
                const nodeCoordinates = nextBoardingStep.nodeCoordinates;
                walkingSegmentsRoutingPromises.push(
                    getRouteByMode(
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: this._origin.geometry.coordinates },
                            properties: {}
                        },
                        { type: 'Feature', geometry: { type: 'Point', coordinates: nodeCoordinates }, properties: {} }
                    )
                );
            } else if (walkingStep.type === 'egress') {
                // egress segment
                const prevUnboardingStep = steps[stepIndex - 1] as TrRoutingUnboardingStep;
                const nodeCoordinates = prevUnboardingStep.nodeCoordinates;
                walkingSegmentsRoutingPromises.push(
                    getRouteByMode(
                        { type: 'Feature', geometry: { type: 'Point', coordinates: nodeCoordinates }, properties: {} },
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: this._destination.geometry.coordinates },
                            properties: {}
                        }
                    )
                );
            } else if (walkingStep.type === 'transfer') {
                const nextBoardingStep = steps[stepIndex + 1] as TrRoutingBoardingStep;
                const prevUnboardingStep = steps[stepIndex - 1] as TrRoutingUnboardingStep;
                const alightingNodeCoordinates = prevUnboardingStep.nodeCoordinates;
                const boardingNodeCoordinates = nextBoardingStep.nodeCoordinates;
                walkingSegmentsRoutingPromises.push(
                    getRouteByMode(
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: alightingNodeCoordinates },
                            properties: {}
                        },
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: boardingNodeCoordinates },
                            properties: {}
                        }
                    )
                );
            }
        });

        const walkingSegmentsGeojson: GeoJSON.Feature<GeoJSON.Geometry, StepGeojsonProperties>[] = [];
        const routingResults = await Promise.allSettled(walkingSegmentsRoutingPromises);
        routingResults.forEach((walkingRoutingResult, routingIndex) => {
            if (walkingRoutingResult.status === 'rejected') {
                return;
            }
            const routes = walkingRoutingResult.value.routes;
            if (routes.length === 0) {
                return;
            }
            const route = routes[0];
            if (route.geometry) {
                const geojson: GeoJSON.Feature<GeoJSON.Geometry, StepGeojsonProperties> = {
                    type: 'Feature',
                    geometry: route.geometry,
                    properties: {
                        distanceMeters: route.distance,
                        travelTimeSeconds: route.duration
                    } as StepGeojsonProperties
                };
                walkingSegmentsGeojson.push(geojson);
            }
        });

        return await this.generatePathGeojson(steps, walkingSegmentsGeojson, options);
    }

    hasError(): boolean {
        return this._error !== undefined;
    }

    getError(): TrError | undefined {
        return this._error;
    }
}
