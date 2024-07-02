/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import _cloneDeep from 'lodash/cloneDeep';
import GeoJSON from 'geojson';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { TripRoutingQueryAttributes, RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import { getRouteByMode } from 'chaire-lib-common/lib/services/routing/RoutingUtils';
import { routingServiceManager as trRoutingServiceManager } from 'chaire-lib-common/lib/services/trRouting/TrRoutingServiceManager';
import { TransitMode, RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { TrRoutingRouteResult } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { TransitRouteQueryOptions, HostPort } from 'chaire-lib-common/lib/api/TrRouting';

type TransitOrRouteCalculatorResult =
    | { routingMode: TransitMode; result: TrRoutingRouteResult | TrError }
    | { routingMode: RoutingMode; result: RouteResults | TrError };

const resultIsTransit = (
    result: TransitOrRouteCalculatorResult
): result is { routingMode: TransitMode; result: TrRoutingRouteResult | TrError } => {
    return result.routingMode === 'transit';
};

const resultIsRouting = (
    result: TransitOrRouteCalculatorResult
): result is { routingMode: RoutingMode; result: RouteResults } => {
    return result.routingMode !== 'transit' && (result.result as any).routes !== undefined;
};

export const getTransitRouteQueryOptionsOrDefault = (
    attributes: TripRoutingQueryAttributes,
    od: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>]
): TransitRouteQueryOptions => ({
    minWaitingTime: attributes.minWaitingTimeSeconds || 180,
    maxAccessTravelTime: attributes.maxAccessEgressTravelTimeSeconds || 900,
    maxEgressTravelTime: attributes.maxAccessEgressTravelTimeSeconds || 900,
    maxTransferTravelTime: attributes.maxTransferTravelTimeSeconds || 900,
    maxTravelTime: attributes.maxTotalTravelTimeSeconds || 10800,
    alternatives: attributes.withAlternatives || false,
    scenarioId: attributes.scenarioId || '',
    originDestination: od,
    timeOfTrip: attributes.timeSecondsSinceMidnight,
    timeOfTripType: attributes.timeType,
    maxFirstWaitingTime: attributes.maxFirstWaitingTimeSeconds || undefined
});

const prepareResults = (
    originDestination: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
    routingResults: TransitOrRouteCalculatorResult[],
    maxWalkingTime: number
): RoutingResultsByMode => {
    const results: RoutingResultsByMode = {};

    for (let i = 0, count = routingResults.length; i < count; i++) {
        const routingResult = routingResults[i];
        const routingMode = routingResults[i].routingMode;

        if (resultIsTransit(routingResult)) {
            const walkingRouteResult = routingResults.find((result) => result.routingMode === 'walking');
            const walkOnlyPath =
                walkingRouteResult &&
                !TrError.isTrError(walkingRouteResult.result) &&
                (walkingRouteResult.result as RouteResults).routes[0].duration <= maxWalkingTime
                    ? (walkingRouteResult.result as RouteResults).routes[0]
                    : undefined;

            results[routingResult.routingMode] = {
                origin: originDestination[0],
                destination: originDestination[1],
                paths: TrError.isTrError(routingResult.result) ? [] : routingResult.result.routes,
                walkOnlyPath,
                error: TrError.isTrError(routingResult.result) ? routingResult.result.export() : undefined
            };
        } else if (routingMode !== 'transit') {
            results[routingMode] = {
                routingMode,
                origin: originDestination[0],
                destination: originDestination[1],
                paths: resultIsRouting(routingResult) ? routingResult.result.routes : [],
                error: TrError.isTrError(routingResult.result) ? routingResult.result.export() : undefined
            };
        }
    }
    return results;
};

const calculateTransit = async (
    od: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
    routingAttributes: TripRoutingQueryAttributes
): Promise<TrRoutingRouteResult> => {
    // FIXME This code path will use a fake socket route to do the calculation. Move this code to the backend too
    const trRoutingService = trRoutingServiceManager.getService();
    const queryParams: TransitRouteQueryOptions = getTransitRouteQueryOptionsOrDefault(routingAttributes, od);

    // Build an HostPort
    // TODO reflect the comment in TrRoutingOdTrip.ts, we should manage the port in a better way
    const hostPort: HostPort = { port: routingAttributes.routingPort };
    return await trRoutingService.route(queryParams, hostPort);
};

const calculateRoute = async (
    od: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
    routingAttributes: TripRoutingQueryAttributes,
    routingMode: RoutingMode
): Promise<RouteResults> => {
    // FIXME This code path will use a fake socket route to do the calculation. Move this code to the backend too
    return await getRouteByMode(od[0], od[1], routingMode);
};

export class Routing {
    static async calculate(
        routingAttributes: TripRoutingQueryAttributes,
        options: { isCancelled?: () => boolean } = {}
    ): Promise<RoutingResultsByMode> {
        const { isCancelled } = options;

        // ** backend
        const routingResult: TransitOrRouteCalculatorResult[] = [];

        for (let i = 0, count = routingAttributes.routingModes.length; i < count; i++) {
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }

            const routingMode = routingAttributes.routingModes[i];
            try {
                if (routingMode === 'transit') {
                    routingResult.push({
                        routingMode,
                        result: await calculateTransit(
                            [routingAttributes.originGeojson, routingAttributes.destinationGeojson],
                            routingAttributes
                        )
                    });
                } else {
                    routingResult.push({
                        routingMode,
                        result: await calculateRoute(
                            [routingAttributes.originGeojson, routingAttributes.destinationGeojson],
                            routingAttributes,
                            routingMode
                        )
                    });
                }
            } catch (error) {
                routingResult.push({
                    routingMode,
                    result: !TrError.isTrError(error)
                        ? new TrError(
                            `cannot calculate routing for mode ${routingMode}:  ${error}`,
                            'TRCalculatorError',
                            { text: 'transit:transitRouting:errors:ErrorForMode', params: { mode: routingMode } }
                        )
                        : error
                });
            }
        }

        // Cancel further processing if the request was cancelled
        if (isCancelled && isCancelled()) {
            throw 'Cancelled';
        }
        const maxWalkingTime = Math.min(
            routingAttributes.maxTotalTravelTimeSeconds || 10800,
            2 * (routingAttributes.maxAccessEgressTravelTimeSeconds || 1200)
        );

        return prepareResults(
            [routingAttributes.originGeojson, routingAttributes.destinationGeojson],
            routingResult,
            maxWalkingTime
        );
    }
}
