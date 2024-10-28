/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    RouteCalculationResultParamsByMode,
    TransitRouteCalculationResultParams,
    UnimodalRouteCalculationResultParams
} from '../../services/routingCalculation/RoutingCalculator';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { RoutingMode, RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import * as TrRoutingApi from 'chaire-lib-common/lib/api/TrRouting';
import { TrRoutingRoute } from 'chaire-lib-common/lib/services/transitRouting/types';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import APIResponseBase from './APIResponseBase';
import { TripRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';

type RouteAPIUnimodalResultResponse = {
    paths: Array<{
        geometry: LineString;
        distanceMeters: number;
        travelTimeSeconds: number;
    }>;
    pathsGeojson?: Array<{
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: LineString;
            properties: {
                mode: string;
                distanceMeters: number;
                travelTimeSeconds: number;
            };
        }>;
    }>;
    noRoutingReason?: {
        message: string;
        code: string;
    };
};

type RouteAPITransitResultResponse = {
    paths: TrRoutingApi.TrRoutingV2.SingleRouteResult[];
    pathsGeojson?: Array<{
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: LineString;
            properties: {
                stepSequence: number;
                action: string;
                distanceMeters: number;
                travelTimeSeconds: number;
            };
        }>;
    }>;
    noRoutingReason?: {
        message: string;
        code: string;
    };
};

type RouteAPIQueryResponse = {
    routingModes: RoutingOrTransitMode[];
    originGeojson: {
        type: 'Feature';
        properties: {
            location: 'origin';
        };
        geometry: Point;
    };
    destinationGeojson: {
        type: 'Feature';
        properties: {
            location: 'destination';
        };
        geometry: Point;
    };
    scenarioId?: string;
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    maxTotalTravelTimeSeconds?: number;
    minWaitingTimeSeconds?: number;
    maxTransferTravelTimeSeconds?: number;
    maxAccessEgressTravelTimeSeconds?: number;
    maxFirstWaitingTimeSeconds?: number;
    withAlternatives?: boolean;
};

type RouteAPIResultResponse = {
    [key in RoutingMode]?: RouteAPIUnimodalResultResponse;
} & {
    transit?: RouteAPITransitResultResponse;
};

export type RouteAPIResponseFormat = {
    query: RouteAPIQueryResponse;
    result: RouteAPIResultResponse;
};

export default class RouteAPIResponse extends APIResponseBase<
    RouteAPIResponseFormat,
    { queryParams: TripRoutingQueryAttributes; resultParams: RouteCalculationResultParamsByMode }
> {
    protected createResponse(input: {
        queryParams: TripRoutingQueryAttributes;
        resultParams: RouteCalculationResultParamsByMode;
    }): RouteAPIResponseFormat {
        return {
            query: this.createQueryResponse(input.queryParams),
            result: this.createResultResponse(input.resultParams)
        };
    }

    private createQueryResponse(queryParams: TripRoutingQueryAttributes): RouteAPIQueryResponse {
        const query: RouteAPIQueryResponse = {
            routingModes: queryParams.routingModes,
            originGeojson: {
                type: queryParams.originGeojson.type,
                properties: {
                    location: 'origin'
                },
                geometry: queryParams.originGeojson.geometry
            },
            destinationGeojson: {
                type: queryParams.destinationGeojson.type,
                properties: {
                    location: 'destination'
                },
                geometry: queryParams.destinationGeojson.geometry
            },
            withAlternatives: queryParams.withAlternatives
        };

        if (queryParams.routingModes!.includes('transit')) {
            query.scenarioId = queryParams.scenarioId;
            query.departureTimeSecondsSinceMidnight =
                queryParams.timeType === 'departure' ? queryParams.timeSecondsSinceMidnight : undefined;
            query.arrivalTimeSecondsSinceMidnight =
                queryParams.timeType === 'arrival' ? queryParams.timeSecondsSinceMidnight : undefined;
            query.maxTotalTravelTimeSeconds = queryParams.maxTotalTravelTimeSeconds;
            query.minWaitingTimeSeconds = queryParams.minWaitingTimeSeconds;
            query.maxTransferTravelTimeSeconds = queryParams.maxTransferTravelTimeSeconds;
            query.maxAccessEgressTravelTimeSeconds = queryParams.maxAccessEgressTravelTimeSeconds;
            query.maxFirstWaitingTimeSeconds = queryParams.maxFirstWaitingTimeSeconds;
        }

        return query;
    }

    private createResultResponse(resultParams: RouteCalculationResultParamsByMode): RouteAPIResultResponse {
        const result: RouteAPIResultResponse = {};

        for (const mode in resultParams) {
            if (mode === 'transit') {
                const transitResultParams: TransitRouteCalculationResultParams = resultParams[mode]!;
                result[mode] = this.createTransitResultResponse(transitResultParams);
            } else {
                const unimodalResultParams: UnimodalRouteCalculationResultParams = resultParams[mode];
                result[mode] = this.createUnimodalResultResponse(unimodalResultParams);
            }
        }

        return result;
    }

    private createTransitResultResponse(
        transitResultParams: TransitRouteCalculationResultParams
    ): RouteAPITransitResultResponse {
        return {
            paths: transitResultParams.paths.map((path: TrRoutingRoute) => {
                const { originDestination, timeOfTrip, timeOfTripType, ...rest } = path;
                return rest;
            }),
            pathsGeojson: transitResultParams.pathsGeojson?.map((pathGeojson: FeatureCollection<LineString>) => ({
                type: pathGeojson.type,
                features: pathGeojson.features.map((feature: Feature<LineString>) => ({
                    type: feature.type,
                    geometry: feature.geometry,
                    properties: {
                        stepSequence: feature.properties!.stepSequence,
                        action: feature.properties!.action,
                        distanceMeters: feature.properties!.distanceMeters,
                        travelTimeSeconds: feature.properties!.travelTimeSeconds
                    }
                }))
            })),
            noRoutingReason:
                transitResultParams.error === undefined
                    ? undefined
                    : { message: transitResultParams.error?.error, code: transitResultParams.error?.errorCode }
        };
    }

    private createUnimodalResultResponse(
        unimodalResultParams: UnimodalRouteCalculationResultParams
    ): RouteAPIUnimodalResultResponse {
        return {
            paths: unimodalResultParams.paths.map((path: Route) => ({
                geometry: path.geometry as LineString,
                distanceMeters: path.distance,
                travelTimeSeconds: path.duration
            })),
            pathsGeojson: unimodalResultParams.pathsGeojson?.map((pathGeojson: FeatureCollection<LineString>) => ({
                type: pathGeojson.type,
                features: pathGeojson.features.map((feature: Feature<LineString>) => ({
                    type: feature.type,
                    geometry: feature.geometry,
                    properties: {
                        mode: feature.properties!.mode,
                        distanceMeters: feature.properties!.distanceMeters,
                        travelTimeSeconds: feature.properties!.travelTimeSeconds
                    }
                }))
            })),
            noRoutingReason:
                unimodalResultParams.error === undefined
                    ? undefined
                    : { message: unimodalResultParams.error?.error, code: unimodalResultParams.error?.errorCode }
        };
    }
}
