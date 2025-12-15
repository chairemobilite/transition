/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import APIResponseBase from './APIResponseBase';
import { AccessibilityMapCalculationResult } from '../../services/routingCalculation/RoutingCalculator';
import { Feature, MultiPolygon, Point } from 'geojson';
import * as TrRoutingApi from 'chaire-lib-common/lib/api/TrRouting';
import {
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';

type AccessibilityMapAPIQueryResponse = {
    locationGeojson: {
        type: 'Feature';
        geometry: Point;
        properties: Record<string, never>; // Empty object
    };
    scenarioId: string;
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    numberOfPolygons: number;
    deltaSeconds: number;
    deltaIntervalSeconds: number;
    maxTotalTravelTimeSeconds: number;
    minWaitingTimeSeconds: number;
    maxAccessEgressTravelTimeSeconds: number;
    maxTransferTravelTimeSeconds: number;
    walkingSpeedMps: number;
    calculatePois: boolean;
};

type AccessibilityMapAPIResultResponse = {
    nodes: TrRoutingApi.TrRoutingApiNode[];
    polygons?: {
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: MultiPolygon;
            properties: {
                durationSeconds: number;
                areaSqM: number;
                accessiblePlacesCountByCategory?: { [key in PlaceCategory]: number };
                accessiblePlacesCountByDetailedCategory?: { [key in PlaceDetailedCategory]: number };
            };
        }>;
    };
};

export type AccessibilityMapAPIResponseFormat = {
    query: AccessibilityMapAPIQueryResponse;
    result: AccessibilityMapAPIResultResponse;
};

export default class AccessibilityMapAPIResponse extends APIResponseBase<
    AccessibilityMapAPIResponseFormat,
    { queryParams: Partial<AccessibilityMapAttributes>; resultParams: AccessibilityMapCalculationResult }
> {
    protected createResponse(input: {
        queryParams: Partial<AccessibilityMapAttributes>;
        resultParams: AccessibilityMapCalculationResult;
    }): AccessibilityMapAPIResponseFormat {
        return {
            query: this.createQueryResponse(input.queryParams),
            result: this.createResultResponse(input.resultParams)
        };
    }

    private createQueryResponse(queryParams: Partial<AccessibilityMapAttributes>): AccessibilityMapAPIQueryResponse {
        return {
            locationGeojson: {
                type: queryParams.locationGeojson!.type,
                geometry: queryParams.locationGeojson!.geometry,
                properties: {}
            },
            scenarioId: queryParams.scenarioId!,
            departureTimeSecondsSinceMidnight: queryParams.departureTimeSecondsSinceMidnight ?? undefined,
            arrivalTimeSecondsSinceMidnight: queryParams.arrivalTimeSecondsSinceMidnight ?? undefined,
            numberOfPolygons: queryParams.numberOfPolygons!,
            deltaSeconds: queryParams.deltaSeconds!,
            deltaIntervalSeconds: queryParams.deltaIntervalSeconds!,
            maxTotalTravelTimeSeconds: queryParams.maxTotalTravelTimeSeconds!,
            minWaitingTimeSeconds: queryParams.minWaitingTimeSeconds!,
            maxAccessEgressTravelTimeSeconds: queryParams.maxAccessEgressTravelTimeSeconds!,
            maxTransferTravelTimeSeconds: queryParams.maxTransferTravelTimeSeconds!,
            walkingSpeedMps: queryParams.walkingSpeedMps!,
            calculatePois: queryParams.calculatePois!
        };
    }

    private createResultResponse(resultParams: AccessibilityMapCalculationResult): AccessibilityMapAPIResultResponse {
        return {
            // FIXME The resultByNode should probably not be undefined, but contain an empty array in case where there is no routing. See https://github.com/chairemobilite/transition/issues/1681
            nodes: resultParams.resultByNode?.nodes ?? [],
            polygons:
                'polygons' in resultParams
                    ? {
                        type: 'FeatureCollection',
                        features: resultParams.polygons.features.map((feature: Feature<MultiPolygon>) => ({
                            type: feature.type,
                            geometry: feature.geometry,
                            properties: {
                                durationSeconds: feature.properties!.durationSeconds,
                                areaSqM: feature.properties!.areaSqM,
                                accessiblePlacesCountByCategory: feature.properties!.accessiblePlacesCountByCategory,
                                accessiblePlacesCountByDetailedCategory:
                                      feature.properties!.accessiblePlacesCountByDetailedCategory
                            }
                        }))
                    }
                    : undefined
        };
    }
}
