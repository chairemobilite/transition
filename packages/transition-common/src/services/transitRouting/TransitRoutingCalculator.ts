/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import GeoJSON from 'geojson';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { TransitRouting } from './TransitRouting';
import { getRouteByMode } from 'chaire-lib-common/lib/services/routing/RoutingUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { routingServiceManager as trRoutingServiceManager } from 'chaire-lib-common/lib/services/trRouting/TrRoutingServiceManager';
import { TransitMode, RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { TrRoutingRouteResult } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { TransitRoutingResult } from './TransitRoutingResult';
import { UnimodalRouteCalculationResult, RouteCalculatorResult } from './RouteCalculatorResult';
import { HostPort, TransitRouteQueryOptions } from 'chaire-lib-common/lib/api/TrRouting';

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

export type ResultsByMode = {
    [key in RoutingMode]?: UnimodalRouteCalculationResult;
} & {
    transit?: TransitRoutingResult;
};

export class TransitRoutingCalculator {
    private static async prepareResults(
        originDestination: GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>,
        routingResults: TransitOrRouteCalculatorResult[],
        maxWalkingTime: number
    ): Promise<ResultsByMode> {
        const results: ResultsByMode = {};

        for (let i = 0, count = routingResults.length; i < count; i++) {
            const routingResult = routingResults[i];
            const routingMode = routingResults[i].routingMode;

            if (resultIsTransit(routingResult)) {
                // walking is always added when calculating transit, so it can't be undefined
                const walkingRouteResult = routingResults.find((result) => result.routingMode === 'walking');
                const walkOnlyPath =
                    walkingRouteResult && !TrError.isTrError(walkingRouteResult.result)
                        ? (walkingRouteResult.result as RouteResults).routes[0]
                        : undefined;

                results[routingResult.routingMode] = new TransitRoutingResult({
                    origin: originDestination.features[0],
                    destination: originDestination.features[1],
                    paths: TrError.isTrError(routingResult.result) ? [] : routingResult.result.routes,
                    walkOnlyPath,
                    maxWalkingTime: maxWalkingTime,
                    error: TrError.isTrError(routingResult.result) ? routingResult.result.export() : undefined
                });
            } else if (routingMode !== 'transit') {
                results[routingMode] = new UnimodalRouteCalculationResult({
                    routingMode,
                    origin: originDestination.features[0],
                    destination: originDestination.features[1],
                    paths: resultIsRouting(routingResult) ? routingResult.result.routes : [],
                    error: TrError.isTrError(routingResult.result) ? routingResult.result.export() : undefined
                });
            }
        }
        return results;
    }

    private static async calculateTransit(
        od: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
        routing: TransitRouting,
        queryOptions: HostPort
    ) {
        const departureTime = routing.getAttributes().departureTimeSecondsSinceMidnight;
        const arrivalTime = routing.getAttributes().arrivalTimeSecondsSinceMidnight;
        const trRoutingService = trRoutingServiceManager.getService();

        const queryParams: TransitRouteQueryOptions = {
            minWaitingTime: routing.getAttributes().minWaitingTimeSeconds || 180,
            maxAccessTravelTime: routing.getAttributes().maxAccessEgressTravelTimeSeconds || 900,
            maxEgressTravelTime: routing.getAttributes().maxAccessEgressTravelTimeSeconds || 900,
            maxTransferTravelTime: routing.getAttributes().maxTransferTravelTimeSeconds || 900,
            maxTravelTime: routing.getAttributes().maxTotalTravelTimeSeconds || 10800,
            alternatives: routing.getAttributes().withAlternatives || false,
            scenarioId: routing.getAttributes().scenarioId || '',
            originDestination: od,
            timeOfTrip: !_isBlank(departureTime) ? (departureTime as number) : (arrivalTime as number),
            timeOfTripType: !_isBlank(departureTime) ? ('departure' as const) : ('arrival' as const),
            maxFirstWaitingTime: routing.getAttributes().maxFirstWaitingTimeSeconds || undefined
        };
        return await trRoutingService.route(queryParams, queryOptions);
    }

    private static async calculateRoute(
        od: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>],
        routingMode: RoutingMode
    ) {
        return await getRouteByMode(od[0], od[1], routingMode);
    }

    // FIXME: Type the options
    static async calculate(
        routing: TransitRouting,
        updatePreferences = false,
        options: { isCancelled?: () => boolean; [key: string]: any } = {}
    ): Promise<ResultsByMode> {
        if (updatePreferences) {
            routing.updateRoutingPrefs();
        }

        const od = routing.originDestinationToGeojson();
        if (od.features.length < 2) {
            throw 'Invalid origin/destination';
        }
        const { isCancelled, ...queryOptions } = options;
        queryOptions.port = routing.getAttributes().routingPort;

        const routingResult: TransitOrRouteCalculatorResult[] = [];

        const routingModes = _cloneDeep(routing.getAttributes().routingModes || []); // we need to keep the original modes for the results' ui
        if (routingModes.includes('transit') && !routingModes.includes('walking')) {
            // force add walking when selecting transit mode, so we can check if walking is better
            routingModes.push('walking');
        }
        for (let i = 0, count = routingModes.length; i < count; i++) {
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }

            const routingMode = routingModes[i];
            try {
                if (routingMode === 'transit') {
                    routingResult.push({
                        routingMode,
                        result: await TransitRoutingCalculator.calculateTransit(
                            [od.features[0], od.features[1]],
                            routing,
                            queryOptions
                        )
                    });
                } else {
                    routingResult.push({
                        routingMode,
                        result: await TransitRoutingCalculator.calculateRoute(
                            [od.features[0], od.features[1]],
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

        const maxWalkingTime = Math.min(
            routing.getAttributes().maxTotalTravelTimeSeconds || 10800,
            2 * (routing.getAttributes().maxAccessEgressTravelTimeSeconds || 1200)
        );

        // Cancel further processing if the request was cancelled
        if (isCancelled && isCancelled()) {
            throw 'Cancelled';
        }

        return await TransitRoutingCalculator.prepareResults(od, routingResult, maxWalkingTime);
    }
}
