/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _sum from 'lodash/sum';
import _uniq from 'lodash/uniq';

import { TrRoutingResultAccessibilityMap } from 'chaire-lib-common/lib/services/transitRouting/types';
import {
    categories,
    detailedCategories,
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import NodeCollection from '../nodes/NodeCollection';
import { placesInWalkingTravelTimeRadiusSeconds } from '../nodes/NodeGeographyUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

export interface TransitAccessibilityMapResult {
    result: TransitAccessibilityMapResultByNode;
    durations: number[];
    nbCalculations: number;
    routingResult: TrRoutingResultAccessibilityMap | undefined;
}

export interface TransitAccessibilityMapWithPolygonResult {
    polygons: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;
    strokes: GeoJSON.FeatureCollection<GeoJSON.MultiLineString>;
    resultByNode: TrRoutingResultAccessibilityMap | undefined;
}

/**
 * Keep transit accessibility map results for potentially multiple queries at
 * different times
 */
export class TransitAccessibilityMapResultByNode {
    // Maps the node id to the node travel times for each request
    private _travelTimesByNodeId: { [nodeId: string]: number[] } = {};
    private _resultsCount: number;

    constructor(routingResult: TrRoutingResultAccessibilityMap[], maxTravelTime: number) {
        this._resultsCount = routingResult.length;
        routingResult.forEach((result) => this.updateNodesTravelTimes(result, maxTravelTime));
    }

    private updateNodesTravelTimes(routingResult: TrRoutingResultAccessibilityMap, maxTravelTimeSeconds: number) {
        const nodesTravelTimes = routingResult.nodes;
        for (let i = 0, countI = nodesTravelTimes.length; i < countI; i++) {
            const nodeTravelTime = nodesTravelTimes[i];
            const nodeId = nodeTravelTime.id;
            const travelTimeSeconds = nodeTravelTime.totalTravelTimeSeconds;
            if (travelTimeSeconds && travelTimeSeconds <= maxTravelTimeSeconds) {
                const travelTimes = this._travelTimesByNodeId[nodeId] || [];
                travelTimes.push(travelTimeSeconds);
                this._travelTimesByNodeId[nodeId] = travelTimes;
            }
        }
    }

    getTraveTimesByNodeId(): { [nodeId: string]: number[] } {
        return this._travelTimesByNodeId;
    }

    /**
     * Get accessible places statistics from these results.
     *
     * TODO Node accessible places are taken from a pre-calculated array by
     * time. But time depends on walking speed and distance. It may not be
     * correct.
     *
     * @param duration The duration for which to get the stats of trips for
     * which to get the stats. Nodes for which the travel time is longer than
     * duration are considered as not accessible.
     * @param nodeCollection The node collection
     * @returns
     */
    getAccessibilityStatsForDuration = (
        duration: number,
        nodeCollection: NodeCollection,
        options: {
            statMethod?: (placeIds: number[], fastestTimeByPlaceId: { [placeId: number]: number }) => number;
        } = {}
    ): {
        accessiblePlacesCountByCategory: { [key in PlaceCategory]: number };
        accessiblePlacesCountByDetailedCategory: { [key in PlaceDetailedCategory]: number };
    } => {
        const travelTimesByNodeId = this._travelTimesByNodeId;
        const statMethod = options.statMethod || ((placeIds: number[], _) => placeIds.length);

        // Initialize places categories, detailed categories and fastest times
        const nodePlacesByCategory: { [key in PlaceCategory]: number[] } = categories.reduce(
            (categoriesAsKeys, category) => ((categoriesAsKeys[category] = []), categoriesAsKeys),
            {}
        ) as { [key in PlaceCategory]: number[] };
        const nodePlacesByDetailedCategory: {
            [key in PlaceDetailedCategory]: number[];
        } = detailedCategories.reduce(
            (categoriesAsKeys, category) => ((categoriesAsKeys[category] = []), categoriesAsKeys),
            {}
        ) as { [key in PlaceDetailedCategory]: number[] };
        // Variable to keep track of the fastest time to reach a place. Some
        // stat methods may use this information, for example, in gravity models.
        const fastestTimeByPlaceId: { [placeId: number]: number } = {};

        for (const nodeId in travelTimesByNodeId) {
            // TODO Do not retrieve with serviceLocator. Backend and tasks may not have filled it
            const node = nodeCollection.getById(nodeId);
            if (node === undefined) {
                console.error(`accessibility map places statistics: Undefined node: ${nodeId}`);
                continue;
            }
            const nodeAttributes = node.properties;
            const remainingTimesSeconds = travelTimesByNodeId[nodeId].map((travelTimeSeconds) => {
                return Math.max(0, duration - travelTimeSeconds);
            });

            // we need to average over the delta count, since empty result
            // for a duration must count as 0, not null. The accessibility
            // map is more a heatmap of accessible places, so a location
            // accessible only in one delta should not be shown with the
            // same weight as the one accessible for each delta. Downside is
            // that a location on the border of the accessible area in one
            // of the delta query will thus not be part of the accessibility
            // map at all.
            //
            // TODO Show the complete accessibility map for the deltas, but
            // with heatmaps showing more accessible locations
            const avgTravelTimeMinutes = Math.floor(_sum(travelTimesByNodeId[nodeId]) / this._resultsCount / 60.0);
            const avgRemainingTimeSeconds = _sum(remainingTimesSeconds) / this._resultsCount;
            const avgRemainingTimeMinutes = Math.floor(avgRemainingTimeSeconds / 60.0);

            if (avgRemainingTimeMinutes <= 0) {
                continue;
            }

            // FIXME node's 'data' field is not accessible in the frontend
            // anymore, at least when retrieved from the node collection, so
            // this feature will not work anymore as long as it is calculated in
            // the frontend
            const nodeAccessiblePlacesByCategory =
                nodeAttributes.data?.accessiblePlaces?.walking?.placesByTravelTimeByCategory; // TODO: allow stats for other modes
            const nodeAccessiblePlacesByDetailedCategory =
                nodeAttributes.data?.accessiblePlaces?.walking?.placesByTravelTimeByDetailedCategory;
            for (let timeMinutes = avgRemainingTimeMinutes; timeMinutes >= 0; timeMinutes--) {
                if (nodeAccessiblePlacesByCategory) {
                    const accessiblePlacesForTravelTimeByCategory = nodeAccessiblePlacesByCategory[timeMinutes];
                    for (const category in accessiblePlacesForTravelTimeByCategory) {
                        nodePlacesByCategory[category].push(...accessiblePlacesForTravelTimeByCategory[category]);
                        accessiblePlacesForTravelTimeByCategory[category].forEach((placeId) => {
                            // Fill the fastest time by place ID object
                            fastestTimeByPlaceId[placeId] = _isBlank(fastestTimeByPlaceId[placeId])
                                ? avgTravelTimeMinutes + timeMinutes
                                : Math.min(fastestTimeByPlaceId[placeId], avgTravelTimeMinutes + timeMinutes);
                        });
                    }
                }
                if (nodeAccessiblePlacesByDetailedCategory) {
                    const accessiblePlacesForTravelTimeByDetailedCategory =
                        nodeAccessiblePlacesByDetailedCategory[timeMinutes];
                    for (const detailedCategory in accessiblePlacesForTravelTimeByDetailedCategory) {
                        nodePlacesByDetailedCategory[detailedCategory].push(
                            ...accessiblePlacesForTravelTimeByDetailedCategory[detailedCategory]
                        );
                    }
                }
            }
        }

        const accessiblePlacesCountByCategory = {} as { [key in PlaceCategory]: number };
        const accessiblePlacesCountByDetailedCategory = {} as { [key in PlaceDetailedCategory]: number };
        // fetch uniq places inside accessibility polygon:
        for (const category in nodePlacesByCategory) {
            nodePlacesByCategory[category] = _uniq(nodePlacesByCategory[category]);
            accessiblePlacesCountByCategory[category] = statMethod(
                nodePlacesByCategory[category],
                fastestTimeByPlaceId
            );
        }
        for (const detailedCategory in nodePlacesByDetailedCategory) {
            nodePlacesByDetailedCategory[detailedCategory] = _uniq(nodePlacesByDetailedCategory[detailedCategory]);
            accessiblePlacesCountByDetailedCategory[detailedCategory] = statMethod(
                nodePlacesByDetailedCategory[detailedCategory],
                fastestTimeByPlaceId
            );
        }

        return { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory };
    };
}
