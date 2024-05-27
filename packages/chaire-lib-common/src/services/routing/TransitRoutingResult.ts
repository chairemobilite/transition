/*
 * Copyright 2022-2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';

import Preferences from '../../config/Preferences';
import { TrRoutingV2 } from '../../api/TrRouting';
import { TrRoutingRoute } from '../trRouting/TrRoutingService';
import { Route, RouteResults } from './RoutingService';
import { getRouteByMode } from './RoutingUtils';
import TrError, { ErrorMessage } from '../../utils/TrError';
import { RoutingResult } from './RoutingResult';
import { RoutingOrTransitMode } from '../../config/routingModes';

export interface StepGeojsonProperties {
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
export interface TransitRoutingResultData {
    origin: GeoJSON.Feature<GeoJSON.Point>;
    destination: GeoJSON.Feature<GeoJSON.Point>;
    paths: TrRoutingRoute[];
    walkOnlyPath?: Route;
    error?: { localizedMessage: ErrorMessage; error: string; errorCode: string };
}

export type SegmentToGeoJSON = (
    boardingStep: TrRoutingV2.TripStepBoarding,
    unboardingStep: TrRoutingV2.TripStepUnboarding,
    completeData: boolean,
    currentStepIndex: number
) => Promise<GeoJSON.Feature<GeoJSON.LineString>>;

export class TransitRoutingResult implements RoutingResult<TransitRoutingResultData> {
    private _hasAlternatives: boolean;
    private _walkOnlyPathIndex: number;

    constructor(private _params: TransitRoutingResultData) {
        this._hasAlternatives = this._params.paths.length > 1;

        // Find the index at which to place the walk only path
        if (this._params.walkOnlyPath) {
            const walkPathDuration = this._params.walkOnlyPath.duration;
            const walkIndex = this._params.paths.findIndex((path) => walkPathDuration <= path.totalTravelTime);
            this._walkOnlyPathIndex = walkIndex >= 0 ? walkIndex : this._params.paths.length;
        } else {
            this._walkOnlyPathIndex = -1;
        }
    }

    hasAlternatives(): boolean {
        return this._walkOnlyPathIndex !== -1 ? true : this._hasAlternatives;
    }

    getAlternativesCount(): number {
        return this._walkOnlyPathIndex !== -1 ? this._params.paths.length + 1 : this._params.paths.length;
    }

    getRoutingMode(): RoutingOrTransitMode {
        return 'transit';
    }

    // TODO Why do we return undefined for the walk only path? It should be a path. Refactor when the routing calculations are generalized
    getPath(index: number): TrRoutingRoute | undefined {
        return index === this._walkOnlyPathIndex
            ? undefined
            : this._walkOnlyPathIndex !== -1 && index >= this._walkOnlyPathIndex
                ? this._params.paths[index - 1]
                : this._params.paths[index];
    }

    getWalkOnlyRoute(): Route | undefined {
        return this._params.walkOnlyPath;
    }

    originDestinationToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        return {
            type: 'FeatureCollection',
            features: [this._params.origin, this._params.destination]
        };
    }

    private async generatePathGeojson(
        steps: TrRoutingV2.TripStep[],
        walkingSegmentsGeojson: GeoJSON.Feature<GeoJSON.Geometry, StepGeojsonProperties>[],
        options: { completeData?: boolean; segmentToGeojson?: SegmentToGeoJSON } = { completeData: false }
    ): Promise<GeoJSON.FeatureCollection> {
        //console.log('steps', steps);
        const features: GeoJSON.Feature[] = [];
        let walkingSegmentIndex = 0;
        let currentStepIndex = 0;
        const completeData = options.completeData || false;

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
                            departureTimeSeconds: step.departureTime,
                            arrivalTimeSeconds: step.arrivalTime
                        };
                    }
                    features.push(walkingSegmentGeojson);
                }
                walkingSegmentIndex++;
            }
            if (step.action === 'boarding') {
                const boardStep = step as TrRoutingV2.TripStepBoarding;
                const nextStep = steps[i + 1];
                if (nextStep && nextStep.action === 'unboarding' && nextStep.pathUuid && options.segmentToGeojson) {
                    const stepGeoJSON = await options.segmentToGeojson(
                        boardStep,
                        nextStep,
                        completeData,
                        currentStepIndex
                    );
                    features.push(stepGeoJSON);
                }
                currentStepIndex++;
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }

    getWalkPathGeojson(): GeoJSON.FeatureCollection {
        // TODO tahini: A route to geojson should be somewhere else than here
        if (!this._params.walkOnlyPath) {
            throw 'Walk only path not available!';
        }
        if (this._params.walkOnlyPath.geometry) {
            const geojson: GeoJSON.Feature<GeoJSON.Geometry, StepGeojsonProperties> = {
                type: 'Feature',
                geometry: this._params.walkOnlyPath.geometry,
                properties: {
                    distanceMeters: this._params.walkOnlyPath.distance,
                    travelTimeSeconds: this._params.walkOnlyPath.duration,
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
        options: { completeData?: boolean; segmentToGeojson?: SegmentToGeoJSON } = { completeData: false }
    ): Promise<GeoJSON.FeatureCollection> {
        // TODO tahini: Path vs walk only route should be better managed
        // Find whether we display a path, or the walk only route
        if (index === this._walkOnlyPathIndex) {
            return this.getWalkPathGeojson();
        }
        const path =
            this._walkOnlyPathIndex !== -1 && index >= this._walkOnlyPathIndex
                ? this._params.paths[index - 1]
                : this._params.paths[index];
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
            const walkingStep = step as TrRoutingV2.TripStepWalking;
            if (walkingStep.type === 'access') {
                // access segment
                const nextBoardingStep = steps[stepIndex + 1] as TrRoutingV2.TripStepBoarding;
                const nodeCoordinates = nextBoardingStep.nodeCoordinates;
                walkingSegmentsRoutingPromises.push(
                    getRouteByMode(
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: this._params.origin.geometry.coordinates },
                            properties: {}
                        },
                        { type: 'Feature', geometry: { type: 'Point', coordinates: nodeCoordinates }, properties: {} }
                    )
                );
            } else if (walkingStep.type === 'egress') {
                // egress segment
                const prevUnboardingStep = steps[stepIndex - 1] as TrRoutingV2.TripStepUnboarding;
                const nodeCoordinates = prevUnboardingStep.nodeCoordinates;
                walkingSegmentsRoutingPromises.push(
                    getRouteByMode(
                        { type: 'Feature', geometry: { type: 'Point', coordinates: nodeCoordinates }, properties: {} },
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: this._params.destination.geometry.coordinates },
                            properties: {}
                        }
                    )
                );
            } else if (walkingStep.type === 'transfer') {
                const nextBoardingStep = steps[stepIndex + 1] as TrRoutingV2.TripStepBoarding;
                const prevUnboardingStep = steps[stepIndex - 1] as TrRoutingV2.TripStepUnboarding;
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
        return this._params.error !== undefined;
    }

    getError(): TrError | undefined {
        const error = this._params.error;
        return error !== undefined ? new TrError(error.error, error.errorCode, error.localizedMessage) : undefined;
    }

    getParams = (): TransitRoutingResultData => this._params;
}
