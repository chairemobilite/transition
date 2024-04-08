/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import APIResponseBase from './APIResponseBase';
import { AccessibilityMapCalculationResult } from '../../services/routingCalculation/RoutingCalculator';
import { Feature, MultiLineString, MultiPolygon, Point } from 'geojson';
import * as TrRoutingApi from 'chaire-lib-common/lib/api/TrRouting';

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
};

type AccessibilityMapAPIResultResponse = {
    nodes: TrRoutingApi.TrRoutingApiNode[];
    polygons?: {
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: MultiPolygon;
            properties: Record<string, never>; // Empty object
        }>;
    };
    strokes?: {
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: MultiLineString;
            properties: Record<string, never>; // Empty object
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
            walkingSpeedMps: queryParams.walkingSpeedMps!
        };
    }

    private createResultResponse(resultParams: AccessibilityMapCalculationResult): AccessibilityMapAPIResultResponse {
        return {
            nodes: resultParams.resultByNode!.nodes,
            polygons:
                'polygons' in resultParams
                    ? {
                        type: 'FeatureCollection',
                        features: resultParams.polygons.features.map((feature: Feature<MultiPolygon>) => ({
                            type: feature.type,
                            geometry: feature.geometry,
                            properties: {}
                        }))
                    }
                    : undefined,
            strokes:
                'strokes' in resultParams
                    ? {
                        type: 'FeatureCollection',
                        features: resultParams.strokes.features.map((feature: Feature<MultiLineString>) => ({
                            type: feature.type,
                            geometry: feature.geometry,
                            properties: {}
                        }))
                    }
                    : undefined
        };
    }
}
