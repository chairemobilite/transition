/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash.get';
import _set from 'lodash.set';
import _cloneDeep from 'lodash.clonedeep';
import GeoJSON from 'geojson';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { TransitRouting } from './TransitRouting';
import { getRouteByMode } from 'chaire-lib-common/lib/services/routing/RoutingUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { routingServiceManager as trRoutingServiceManager } from 'chaire-lib-common/lib/services/trRouting/TrRoutingServiceManager';
import { RoutingOrTransitMode, TransitMode, RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import {
    TrRoutingResult,
    TrRoutingResultPath,
    TrRoutingResultAlternatives
} from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { TransitRoutingResult } from './TransitRoutingResult';
import { UnimodalRouteCalculationResult, RouteCalculatorResult } from './RouteCalculatorResult';

type TransitOrRouteCalculatorResult =
    | { routingMode: TransitMode; result: TrRoutingResult | TrError }
    | { routingMode: RoutingMode; result: RouteResults | TrError };

const resultIsTrRouting = (
    result: TransitOrRouteCalculatorResult
): result is { routingMode: TransitMode; result: TrRoutingResult } => {
    return result.routingMode === 'transit' && (result.result as any).type !== undefined;
};

const resultIsRouting = (
    result: TransitOrRouteCalculatorResult
): result is { routingMode: RoutingMode; result: RouteResults } => {
    return result.routingMode !== 'transit' && (result.result as any).routes !== undefined;
};

export type ResultsByMode = {
    [key in RoutingMode]?: RouteCalculatorResult;
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

            if (routingMode === 'transit') {
                // walking is always added when calculating transit, so it can't be undefined
                const walkingRouteResult = routingResults.find((result) => result.routingMode === 'walking');
                const walkOnlyPath =
                    walkingRouteResult && !TrError.isTrError(walkingRouteResult.result)
                        ? (walkingRouteResult.result as RouteResults).routes[0]
                        : undefined;

                results[routingMode] = new TransitRoutingResult({
                    origin: originDestination.features[0],
                    destination: originDestination.features[1],
                    hasAlternatives:
                        resultIsTrRouting(routingResult) && routingResult.result.type === 'withAlternatives',
                    paths: resultIsTrRouting(routingResult)
                        ? routingResult.result.type === 'withAlternatives'
                            ? (routingResult.result as TrRoutingResultAlternatives).alternatives
                            : [(routingResult.result as TrRoutingResultPath).path]
                        : [],
                    walkOnlyPath,
                    maxWalkingTime: maxWalkingTime,
                    error: resultIsTrRouting(routingResult) ? undefined : (routingResult.result as TrError)
                });
            } else {
                results[routingMode] = new UnimodalRouteCalculationResult({
                    routingMode,
                    origin: originDestination.features[0],
                    destination: originDestination.features[1],
                    paths: resultIsRouting(routingResult) ? routingResult.result.routes : [],
                    error: resultIsRouting(routingResult) ? undefined : (routingResult.result as TrError)
                });
            }
        }
        return results;
    }

    private static async calculateTransit(
        od: GeoJSON.FeatureCollection<GeoJSON.Point>,
        routing: TransitRouting,
        queryOptions: any
    ) {
        const departureTime = routing.getAttributes().departureTimeSecondsSinceMidnight;
        const arrivalTime = routing.getAttributes().arrivalTimeSecondsSinceMidnight;
        const trRoutingService = trRoutingServiceManager.getService();

        const queryParams = {
            minWaitingTime: routing.getAttributes().minWaitingTimeSeconds || 180,
            maxAccessTravelTime: routing.getAttributes().maxAccessEgressTravelTimeSeconds || 900,
            maxEgressTravelTime: routing.getAttributes().maxAccessEgressTravelTimeSeconds || 900,
            maxTransferTravelTime: routing.getAttributes().maxTransferTravelTimeSeconds || 900,
            maxTravelTime: routing.getAttributes().maxTotalTravelTimeSeconds || 10800,
            alternatives: routing.getAttributes().withAlternatives || false,
            scenarioId: routing.getAttributes().scenarioId || '',
            originDestination:
                od.features.length === 2
                    ? ([od.features[0], od.features[1]] as [
                          GeoJSON.Feature<GeoJSON.Point>,
                          GeoJSON.Feature<GeoJSON.Point>
                      ])
                    : undefined,
            odTripUuid: !_isBlank(routing.getAttributes().odTripUuid) ? routing.getAttributes().odTripUuid : undefined,
            routingName: !_isBlank(routing.getAttributes().routingName)
                ? routing.getAttributes().routingName
                : undefined, // TODO: ignored by trRouting for now
            timeOfTrip: !_isBlank(departureTime) ? (departureTime as number) : (arrivalTime as number),
            timeOfTripType: !_isBlank(routing.getAttributes().departureTimeSecondsSinceMidnight)
                ? ('departure' as const)
                : ('arrival' as const),
            maxFirstWaitingTime: routing.getAttributes().maxFirstWaitingTimeSeconds || undefined
        };
        return await trRoutingService.routeV1(queryParams, queryOptions);
    }

    private static async calculateRoute(od: GeoJSON.FeatureCollection<GeoJSON.Point>, routingMode: RoutingMode) {
        if (od.features.length < 2) {
            throw 'Invalid origin/destination for mode ' + routingMode;
        }
        return await getRouteByMode(od.features[0], od.features[1], routingMode);
    }

    // FIXME: Type the options
    static async calculate(
        routing: TransitRouting,
        updatePreferences = false,
        options: { isCancelled?: () => void; [key: string]: any } = {}
    ): Promise<ResultsByMode> {
        if (updatePreferences) {
            routing.updateRoutingPrefs();
        }

        const od = routing.originDestinationToGeojson();
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
                        result: await TransitRoutingCalculator.calculateTransit(od, routing, queryOptions)
                    });
                } else {
                    routingResult.push({
                        routingMode,
                        result: await TransitRoutingCalculator.calculateRoute(od, routingMode)
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
