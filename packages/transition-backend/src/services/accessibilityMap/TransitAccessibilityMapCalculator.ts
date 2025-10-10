/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    featureCollection as turfFeatureCollection,
    lineString as turfLineString,
    multiLineString as turfMultiLineString,
    area as turfArea,
    polygonToLine as turfPolygonToLine,
    intersect as turfIntersect,
    difference as turfDifference
} from '@turf/turf';
import {
    Feature,
    FeatureCollection,
    Point,
    MultiPolygon,
    MultiLineString,
    LineString,
    GeoJsonProperties
} from 'geojson';

import _cloneDeep from 'lodash/cloneDeep';
import _sum from 'lodash/sum';
import { randomUUID } from 'crypto'; //TODO Only for console.time id, to me removed

import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TrRoutingResultAccessibilityMap } from 'chaire-lib-common/lib/services/transitRouting/types';
import { AccessibilityMapQueryOptions } from 'chaire-lib-common/lib/api/TrRouting';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import transitRoutingService from 'chaire-lib-backend/lib/services/transitRouting/TransitRoutingService';
import {
    TransitAccessibilityMapResultByNode,
    TransitAccessibilityMapWithPolygonResult,
    TransitAccessibilityMapResult,
    TransitAccessibilityMapComparisonResult
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import {
    TransitMapCalculationOptions,
    TransitMapColorOptions
} from 'transition-common/lib/services/accessibilityMap/types';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import nodeDbQueries from '../../models/db/transitNodes.db.queries';
import placesDbQueries from '../../models/db/places.db.queries';
import { clipPolygon as clipPolygonWithPostGIS } from '../../models/db/geometryUtils.db.queries';

const getDurations = (maxDuration: number, numberOfPolygons: number): number[] => {
    const durations = [maxDuration];
    for (let i = numberOfPolygons - 1; i > 0; i--) {
        durations.push(Math.ceil((i * maxDuration) / numberOfPolygons));
    }
    return durations;
};

const getTimes = (time: number, delta?: number, deltaInterval?: number) => {
    const deltaNb = delta ? delta : 0;
    const deltaIntervalNb = deltaInterval ? (deltaInterval <= 0 ? 60 : deltaInterval) : 60;
    const times: number[] = [];
    for (let i = time - deltaNb; i <= time + deltaNb; i += deltaIntervalNb) {
        if (i >= 0) {
            times.push(i);
        }
    }
    return times;
};

const isNumber = (val: any): val is number => {
    return Number.isFinite(val);
};

export const getAttributesOrDefault = (attributes: Partial<AccessibilityMapAttributes>) => {
    if (!attributes.locationGeojson) {
        throw 'There should be a valid location';
    }
    return {
        departureTimeSecondsSinceMidnight: attributes.departureTimeSecondsSinceMidnight,
        departureTime: isNumber(attributes.departureTimeSecondsSinceMidnight)
            ? secondsSinceMidnightToTimeStr(attributes.departureTimeSecondsSinceMidnight)
            : '',
        arrivalTimeSecondsSinceMidnight: attributes.arrivalTimeSecondsSinceMidnight,
        arrivalTime: isNumber(attributes.arrivalTimeSecondsSinceMidnight)
            ? secondsSinceMidnightToTimeStr(attributes.arrivalTimeSecondsSinceMidnight)
            : '',
        maxTotalTravelTimeSeconds: attributes.maxTotalTravelTimeSeconds || 900,
        numberOfPolygons: attributes.numberOfPolygons || 1,
        deltaSeconds: attributes.deltaSeconds || 0,
        deltaIntervalSeconds: attributes.deltaIntervalSeconds || 60,
        locationGeojson: attributes.locationGeojson,
        minWaitingTimeSeconds: attributes.minWaitingTimeSeconds || 180,
        maxAccessEgressTravelTimeSeconds: attributes.maxAccessEgressTravelTimeSeconds || 900,
        maxTransferTravelTimeSeconds: attributes.maxTransferTravelTimeSeconds || 900,
        walkingSpeedMps: attributes.walkingSpeedMps || 5.0 / 3.6,
        walkingSpeedFactor: attributes.walkingSpeedFactor,
        scenarioId: attributes.scenarioId,
        locationColor: attributes.locationColor,
        color: attributes.color,
        placeName: attributes.placeName,
        calculatePois: attributes.calculatePois
    };
};

const getDefaultGeojsonPolygon = (locationColor) =>
    ({
        type: 'Feature',
        properties: {
            color: locationColor
        },
        geometry: {
            type: 'MultiPolygon',
            coordinates: []
        }
    }) as Feature<MultiPolygon>;

export class TransitAccessibilityMapCalculator {
    private static generateQuery(
        query: {
            minWaitingTime: number;
            maxAccessTravelTime: number;
            maxEgressTravelTime: number;
            maxTransferTravelTime: number;
            scenarioId: string;
        },
        options: {
            timeSecondsSinceMidnight: number;
            maxTravelTimeSeconds: number;
            timeOfTripType: 'departure' | 'arrival';
            location: Feature<Point>;
        }
    ): AccessibilityMapQueryOptions {
        const params: AccessibilityMapQueryOptions = {
            ...query,
            maxTravelTime: options.maxTravelTimeSeconds,
            location: options.location,
            timeOfTrip: options.timeSecondsSinceMidnight,
            timeOfTripType: options.timeOfTripType
        };
        return params;
    }

    // FIXME: Type the options
    static async calculate(
        routingAttributes: AccessibilityMapAttributes,
        options: TransitMapCalculationOptions = {}
    ): Promise<TransitAccessibilityMapResult> {
        const attributes = getAttributesOrDefault(routingAttributes);
        const durations = getDurations(attributes.maxTotalTravelTimeSeconds, attributes.numberOfPolygons);
        const departureTime = attributes.departureTimeSecondsSinceMidnight;
        const arrivalTime = attributes.arrivalTimeSecondsSinceMidnight;
        const specifiedTime = !_isBlank(departureTime) ? (departureTime as number) : (arrivalTime as number);
        const times = getTimes(specifiedTime, attributes.deltaSeconds, attributes.deltaIntervalSeconds);

        const { isCancelled, ...queryOptions } = options;
        const promises: Promise<TrRoutingResultAccessibilityMap>[] = [];
        let specifiedTimeIndex = 0;

        const baseQuery = {
            minWaitingTime: attributes.minWaitingTimeSeconds,
            maxAccessTravelTime: attributes.maxAccessEgressTravelTimeSeconds,
            maxEgressTravelTime: attributes.maxAccessEgressTravelTimeSeconds,
            maxTransferTravelTime: attributes.maxTransferTravelTimeSeconds,
            scenarioId: attributes.scenarioId as string
            // TODO needed?
            // maxFirstWaitingTime: routing.get('maxFirstWaitingTimeSeconds', undefined)
        };
        for (let i = 0, countI = times.length; i < countI; i++) {
            const time = times[i];
            if (time === specifiedTime) {
                specifiedTimeIndex = i;
            }
            const query = this.generateQuery(baseQuery, {
                location: attributes.locationGeojson,
                timeSecondsSinceMidnight: time,
                maxTravelTimeSeconds: durations[0],
                timeOfTripType: !_isBlank(departureTime) ? 'departure' : 'arrival'
            });

            //accessibleMap expect the port number to be in an HostPort struct
            //TODO This should be refactored, but this is a quick fix for #861
            queryOptions.hostPort = { port: queryOptions.port };
            promises.push(transitRoutingService.accessibleMap(query, queryOptions));
        }

        try {
            const promiseResults = await Promise.allSettled(promises);
            let routingResultAtTime: TrRoutingResultAccessibilityMap | undefined = undefined;
            const routingResults = promiseResults
                .map((promiseResult, index) => {
                    if (promiseResult.status === 'rejected') {
                        // TODO Return something for no routing found?
                        return undefined;
                    }
                    const routingResult = promiseResult.value;
                    if (specifiedTimeIndex === index) {
                        routingResultAtTime = routingResult;
                    }
                    return routingResult;
                })
                .filter((result) => result !== undefined) as TrRoutingResultAccessibilityMap[];

            // Cancel further processing if the request was cancelled
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }
            const result = new TransitAccessibilityMapResultByNode(routingResults, durations[0]);

            return {
                result,
                durations,
                nbCalculations: times.length,
                routingResult: routingResultAtTime
            };
        } catch (error) {
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit accessibility map with trRouting: ${error}`,
                'TRRAM0001',
                'TransitAccessibilityMapCannotBeCalculatedBecauseError'
            );
            // TODO extract cancelled to constant
            if (error !== 'Cancelled') {
                console.error(error);
            }
            throw trError;
        }
    }

    private static async getPolygonsDifference(
        polygons: FeatureCollection<MultiPolygon>,
        color: string
    ): Promise<TransitAccessibilityMapWithPolygonResult> {
        const featuresNumber = polygons.features.length;
        if (featuresNumber !== 2) {
            throw `The getPolygonsDifference() function must receive 2 features. Received ${featuresNumber}.`;
        }

        const difference = turfDifference(polygons) as Feature<MultiPolygon> | null;
        if (difference === null) {
            return {
                polygons: turfFeatureCollection([]),
                strokes: turfFeatureCollection([])
            };
        }

        if (difference.properties === null) {
            difference.properties = {};
        }

        difference.properties.color = color;

        const multiLineStroke = this.getPolygonStrokes(difference);

        return {
            polygons: turfFeatureCollection([difference]),
            strokes: turfFeatureCollection([multiLineStroke])
        };
    }

    private static async getPolygonsIntersection(
        polygons: FeatureCollection<MultiPolygon>,
        color: string
    ): Promise<TransitAccessibilityMapWithPolygonResult> {
        const durationMinutes = polygons.features[0].properties!.durationMinutes;
        const intersection = turfIntersect(polygons, {
            properties: { color, durationMinutes }
        }) as Feature<MultiPolygon> | null;

        if (intersection === null) {
            return {
                polygons: turfFeatureCollection([]),
                strokes: turfFeatureCollection([])
            };
        }

        if (intersection.properties === null) {
            intersection.properties = {};
        }

        const area = turfArea(intersection);
        intersection.properties.areaSqM = area;
        intersection.properties.areaSqKm = area / 1000000;
        intersection.properties.areaSqMiles = area / 1000000 / 2.58999;

        const multiLineStroke = this.getPolygonStrokes(intersection);

        return {
            polygons: turfFeatureCollection([intersection]),
            strokes: turfFeatureCollection([multiLineStroke])
        };
    }

    // FIXME: Type the options
    static async calculateWithPolygons(
        routingAttributes: AccessibilityMapAttributes,
        options: TransitMapCalculationOptions = {}
    ): Promise<TransitAccessibilityMapWithPolygonResult> {
        const { result, durations, nbCalculations, routingResult } = await TransitAccessibilityMapCalculator.calculate(
            routingAttributes,
            options
        );
        const attributes = getAttributesOrDefault(routingAttributes);
        const { isCancelled, additionalProperties } = options;

        try {
            //TODO Keep this time measurement for the moment, to monitor trends
            const consoleTimerId = `Accessibility generatePolygons ${randomUUID().substring(0, 8)}`;
            console.time(consoleTimerId);

            const polygons = await this.generatePolygonsWithPostGIS(attributes, result, durations, nbCalculations, {
                isCancelled,
                additionalProperties
            });
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }
            console.timeEnd(consoleTimerId);

            return {
                polygons: turfFeatureCollection(polygons.polygons),
                strokes: turfFeatureCollection(polygons.strokes),
                resultByNode: routingResult
            };
        } catch (error) {
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit accessibility map with trRouting: ${error}`,
                'TRRAM0001',
                'TransitAccessibilityMapCannotBeCalculatedBecauseError'
            );
            // TODO extract cancelled to constant
            if (error !== 'Cancelled') {
                console.error(error);
            }
            throw trError;
        }
    }

    //TODO: Remove numberOfPolygons and colors
    static async getMapComparison(
        result1: FeatureCollection<MultiPolygon>,
        result2: FeatureCollection<MultiPolygon>,
        numberOfPolygons: number,
        colors: TransitMapColorOptions
    ): Promise<TransitAccessibilityMapComparisonResult[]> {
        const finalMap: TransitAccessibilityMapComparisonResult[] = [];

        for (let i = 0; i < numberOfPolygons; i++) {
            const polygons1 = result1.features[i];
            const polygons2 = result2.features[i];

            const combinedPolygons = turfFeatureCollection([polygons1, polygons2]);
            const combinedPolygonsReverseOrder = turfFeatureCollection([polygons2, polygons1]);

            const intersection = await this.getPolygonsIntersection(combinedPolygons, colors.intersectionColor);

            const scenario1Minus2 = await this.getPolygonsDifference(combinedPolygons, colors.scenario1Minus2Color);

            const scenario2Minus1 = await this.getPolygonsDifference(
                combinedPolygonsReverseOrder,
                colors.scenario2Minus1Color
            );

            finalMap.push({
                polygons: {
                    intersection: intersection.polygons.features,
                    scenario1Minus2: scenario1Minus2.polygons.features,
                    scenario2Minus1: scenario2Minus1.polygons.features
                },
                strokes: {
                    intersection: intersection.strokes.features,
                    scenario1Minus2: scenario1Minus2.strokes.features,
                    scenario2Minus1: scenario2Minus1.strokes.features
                }
            });
        }

        return finalMap;
    }

    // TODO: Move to result class?
    /**
     * Generate accessibility polygons using PostGIS
     */
    private static async generatePolygonsWithPostGIS(
        attributes: {
            walkingSpeedMps: number;
            maxAccessEgressTravelTimeSeconds: number;
            locationGeojson: Feature<Point>;
            locationColor?: string;
            color?: string;
            calculatePois?: boolean;
            [key: string]: any;
        },
        result: TransitAccessibilityMapResultByNode,
        durations: number[],
        deltaCount = 1,
        options: TransitMapCalculationOptions = {}
    ) {
        const isCancelled = options.isCancelled || (() => false);

        durations.sort((a, b) => b - a); // durations must be in descending order so it appears correctly in qgis

        const polygons: Feature<MultiPolygon>[] = [];
        const polygonStrokes: Feature<MultiLineString>[] = [];

        const walkingSpeedMps = attributes.walkingSpeedMps;
        const maxDistanceMeters = Math.floor(attributes.maxAccessEgressTravelTimeSeconds * walkingSpeedMps);

        let stepI = 1;
        const stepsCount = durations.length * 2;

        const defaultGeojsonPolygon = getDefaultGeojsonPolygon(attributes.locationColor);

        // Get the accessible node collection
        const accessibleNodeIds = Object.keys(result.getTraveTimesByNodeId());
        const nodeCollection = new NodeCollection([], {});
        const nodeGeojson = await nodeDbQueries.geojsonCollection({ nodeIds: accessibleNodeIds });
        nodeCollection.loadFromCollection(nodeGeojson.features);

        // TODO We could probably let all this node filtering operation be done by postgis and generate the polygon at the same time
        for (let d = 0, size = durations.length; d < size; d++) {
            const duration = durations[d];
            if (isCancelled()) {
                throw 'Cancelled';
            }

            const durationMaxDistanceMeters = Math.min(maxDistanceMeters, Math.floor(duration * walkingSpeedMps));

            // Build array of circles
            const circles: Array<{ center: [number, number]; radiusKm: number }> = [];

            // Add origin circle
            const locationCoords = attributes.locationGeojson.geometry.coordinates;
            circles.push({
                center: [locationCoords[0], locationCoords[1]],
                radiusKm: durationMaxDistanceMeters / 1000
            });

            // Add node circles
            const travelTimesByNodeId = result.getTraveTimesByNodeId();

            for (const nodeId in travelTimesByNodeId) {
                const nodeFeature = nodeCollection.getById(nodeId);
                if (nodeFeature === undefined) {
                    console.error('Node not found in collection: %s', nodeId);
                    continue;
                }

                const remainingTimesSeconds = travelTimesByNodeId[nodeId].map((travelTimeSeconds) => {
                    return travelTimeSeconds < duration ? duration - travelTimeSeconds : 0;
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
                const avgRemainingTimeSeconds = _sum(remainingTimesSeconds) / deltaCount;
                let nodeRemainingDistanceMeters = Math.floor(avgRemainingTimeSeconds * walkingSpeedMps);
                nodeRemainingDistanceMeters = Math.min(maxDistanceMeters, nodeRemainingDistanceMeters);

                if (nodeRemainingDistanceMeters > 0) {
                    const nodeCoords = nodeFeature.geometry.coordinates;
                    circles.push({
                        center: [nodeCoords[0], nodeCoords[1]],
                        radiusKm: nodeRemainingDistanceMeters / 1000
                    });
                }
            }

            // Emit progress before processing
            if (serviceLocator.eventManager) {
                serviceLocator.eventManager.emit('progress', {
                    name: 'AccessibilityMapPolygonGeneration',
                    progress: stepI++ / stepsCount
                });
            }

            // Generate and union circles using PostGIS (auto-selects single query or batching)
            const polygonCoordinates = await clipPolygonWithPostGIS(circles);

            const polygon = _cloneDeep(defaultGeojsonPolygon);
            polygon.geometry.coordinates = polygonCoordinates;

            const area = turfArea(polygon);

            let accessiblePlacesCountByCategory;
            let accessiblePlacesCountByDetailedCategory;

            if (attributes.calculatePois) {
                ({ accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } =
                    await placesDbQueries.getPOIsCategoriesCountInPolygon(polygon.geometry));
            }

            polygon.properties = {
                durationSeconds: Math.round(duration),
                durationMinutes: Math.round(duration / 60),
                areaSqM: area,
                areaSqKm: area / 1000000,
                areaSqMiles: area / 1000000 / 2.58999,
                color: attributes.color,
                accessiblePlacesCountByCategory,
                accessiblePlacesCountByDetailedCategory,
                ...attributes,
                ...(options.additionalProperties || {})
            };

            for (const category in accessiblePlacesCountByCategory) {
                polygon.properties[`cat_${category}`] = accessiblePlacesCountByCategory[category];
            }
            for (const detailedCategory in accessiblePlacesCountByDetailedCategory) {
                polygon.properties[`catDet_${detailedCategory}`] =
                    accessiblePlacesCountByDetailedCategory[detailedCategory];
            }

            polygons.push(polygon);
            polygonStrokes.push(this.getPolygonStrokes(polygon));

            // Emit progress after processing
            if (serviceLocator.eventManager) {
                serviceLocator.eventManager.emitProgress('AccessibilityMapPolygonGeneration', stepI++ / stepsCount);
            }
        }

        if (isCancelled()) {
            throw 'Cancelled';
        }

        return { polygons: polygons, strokes: polygonStrokes };
    }

    // From a polygon, generate the strokes that surround it.
    private static getPolygonStrokes(
        polygon: Feature<MultiPolygon, GeoJsonProperties>
    ): Feature<MultiLineString, GeoJsonProperties> {
        let polygonStroke = turfPolygonToLine(polygon);
        if (polygonStroke.type === 'Feature') {
            polygonStroke = turfFeatureCollection([polygonStroke]);
        }
        const polygonStrokesWithHoles: FeatureCollection<LineString> = turfFeatureCollection([]);

        for (let i = 0, countI = polygonStroke.features.length; i < countI; i++) {
            const feature = polygonStroke.features[i];
            if (feature.geometry.type === 'MultiLineString') {
                // this is a polygon with hole, we need to separate into two LineStrings.
                for (let j = 1, countJ = feature.geometry.coordinates.length; j < countJ; j++) {
                    polygonStrokesWithHoles.features.push(turfLineString(feature.geometry.coordinates[j]));
                }
                polygonStrokesWithHoles.features.push(turfLineString(feature.geometry.coordinates[0])); // keep the first one as is, but convert to LineString
            } else {
                polygonStrokesWithHoles.features.push(feature as Feature<LineString>);
            }
        }

        return turfMultiLineString(
            polygonStrokesWithHoles.features.map((lineString) => {
                return lineString.geometry.coordinates;
            })
        );
    }
}
