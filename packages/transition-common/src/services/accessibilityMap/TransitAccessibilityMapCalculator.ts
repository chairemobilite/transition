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
    circle as turfCircle,
    area as turfArea,
    polygonToLine as turfPolygonToLine
    //multiPolygon as turfMultiPolygon
} from '@turf/turf';
import { Feature, FeatureCollection, Point, MultiPolygon, MultiLineString } from 'geojson';
import polygonClipping from 'polygon-clipping';
import _cloneDeep from 'lodash/cloneDeep';
import _sum from 'lodash/sum';

import TransitAccessibilityMapRouting from './TransitAccessibilityMapRouting';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { routingServiceManager as trRoutingServiceManager } from 'chaire-lib-common/lib/services/trRouting/TrRoutingServiceManager';
import { TrRoutingResultAccessibilityMap } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { AccessibilityMapQueryOptions } from 'chaire-lib-common/lib/api/TrRouting';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _toInteger, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import {
    TransitAccessibilityMapResultByNode,
    TransitAccessibilityMapWithPolygonResult,
    TransitAccessibilityMapResult
} from './TransitAccessibilityMapResult';

export interface TransitMapCalculationOptions {
    isCancelled?: (() => boolean) | false;
    port?: number;
    /**
     * Additional properties to add to each accessibility polygon calculated
     *
     * @type {{ [key: string]: any }}
     * @memberof TransitMapCalculationOptions
     */
    additionalProperties?: { [key: string]: any };
    accessibleNodes?: { ids: string[]; durations: number[] };
    [key: string]: any;
}

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

const getAttributesOrDefault = (routing: TransitAccessibilityMapRouting) => {
    const attributes = routing.getAttributes();
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
        placeName: attributes.placeName
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
    } as Feature<MultiPolygon>);

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
            accessibleNodes?: { ids: string[]; durations: number[] };
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

    private static async clipPolygon(
        nodeCircles,
        isCancelled: (() => boolean) | false = false
    ): Promise<polygonClipping.MultiPolygon> {
        // return f.union(nodeCircles);
        // TODO This is a much slower version of the simple above line, dividing the work, but allowing the user to cancel the request...
        return new Promise((resolve, reject) => {
            const pieces = 20;
            const splitSize = Math.ceil(nodeCircles.length / pieces);
            let clipped: polygonClipping.MultiPolygon = [];
            const clipFunc = (previous, i) => {
                const toClip = previous.concat(nodeCircles.slice(i * pieces, (i + 1) * pieces));
                clipped = polygonClipping.union(toClip);
                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
                }
                if (i < splitSize - 1) {
                    setTimeout(() => {
                        try {
                            // The function will concat with previous, nothing to do for this case
                            clipFunc(clipped, i + 1);
                        } catch (error) {
                            // Error clipping this data, reject the promise
                            reject(error);
                        }
                    }, 0);
                } else {
                    resolve(clipped);
                }
            };
            clipFunc(clipped, 0);
        });
    }

    // FIXME: Type the options
    static async calculate(
        routing: TransitAccessibilityMapRouting,
        updatePreferences = false,
        options: TransitMapCalculationOptions = {}
    ): Promise<TransitAccessibilityMapResult> {
        if (updatePreferences) {
            routing.updateRoutingPrefs();
        }

        const attributes = getAttributesOrDefault(routing);
        const durations = getDurations(attributes.maxTotalTravelTimeSeconds, attributes.numberOfPolygons);
        const departureTime = attributes.departureTimeSecondsSinceMidnight;
        const arrivalTime = attributes.arrivalTimeSecondsSinceMidnight;
        const specifiedTime = !_isBlank(departureTime) ? (departureTime as number) : (arrivalTime as number);
        const times = getTimes(specifiedTime, attributes.deltaSeconds, attributes.deltaIntervalSeconds);

        const { isCancelled, additionalProperties, accessibleNodes, ...queryOptions } = options;
        const promises: Promise<TrRoutingResultAccessibilityMap>[] = [];
        let specifiedTimeIndex = 0;
        const trRoutingService = trRoutingServiceManager.getService();

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
                timeOfTripType: !_isBlank(departureTime) ? 'departure' : 'arrival',
                accessibleNodes
            });

            //accessibleMap expect the port number to be in an HostPort struct
            //TODO This should be refactored, but this is a quick fix for #861
            queryOptions.hostPort = { port: queryOptions.port };
            promises.push(trRoutingService.accessibleMap(query, queryOptions));
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

    // FIXME: Type the options
    static async calculateWithPolygons(
        routing: TransitAccessibilityMapRouting,
        updatePreferences = false,
        options: TransitMapCalculationOptions = {}
    ): Promise<TransitAccessibilityMapWithPolygonResult> {
        const { result, durations, nbCalculations, routingResult } = await TransitAccessibilityMapCalculator.calculate(
            routing,
            updatePreferences,
            options
        );
        const attributes = getAttributesOrDefault(routing);
        const { isCancelled, additionalProperties } = options;

        try {
            const polygons = await this.generatePolygons(attributes, result, durations, nbCalculations, {
                isCancelled,
                additionalProperties
            });
            if (isCancelled && isCancelled()) {
                throw 'Cancelled';
            }

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

    // TODO: Move to result class?
    private static async generatePolygons(
        attributes: {
            walkingSpeedMps: number;
            maxAccessEgressTravelTimeSeconds: number;
            locationGeojson: Feature<Point>;
            locationColor?: string;
            color?: string;
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

        // when a node is fully accessible in the previous duration (maxDistanceMeters === nodeRemainingDistanceMeters),
        // we don't need to calculate remaining distance for the next duration,
        // and the previous polygon can be used for the next duration because it is 100% contained
        // TODO: implement this optimization also in updateNodesTravelTimes
        let stepI = 1;
        const stepsCount = durations.length * 2;
        let nodeCircles = [
            turfCircle(attributes.locationGeojson, maxDistanceMeters / 1000, { units: 'kilometers', steps: 64 })
                .geometry.coordinates
        ];
        const defaultGeojsonPolygon = getDefaultGeojsonPolygon(attributes.locationColor);
        const nodeCollection = serviceLocator.collectionManager.get('nodes');

        for (let d = 0, size = durations.length; d < size; d++) {
            const duration = durations[d];
            if (isCancelled()) {
                throw 'Cancelled';
            }
            const durationMaxDistanceMeters = Math.min(maxDistanceMeters, Math.floor(duration * walkingSpeedMps));
            nodeCircles = [
                turfCircle(attributes.locationGeojson, durationMaxDistanceMeters / 1000, {
                    units: 'kilometers',
                    steps: 64
                }).geometry.coordinates
            ];

            const { accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory } =
                result.getAccessibilityStatsForDuration(duration, nodeCollection);

            // include starting/ending location circle:
            const travelTimesByNodeId = result.getTraveTimesByNodeId();

            for (const nodeId in travelTimesByNodeId) {
                const node = nodeCollection.getById(nodeId);
                // TODO node collection manager is in legacy code and is a geojson attribute, but unit test use Node objects, which need to be converted to geojson
                const nodeGeometry = node.geometry ? node : node.toGeojson();
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
                nodeCircles.push(
                    turfCircle(nodeGeometry, nodeRemainingDistanceMeters / 1000, { units: 'kilometers', steps: 64 })
                        .geometry.coordinates
                );
            }

            // The backend does not have this event manager, so we only want to use it when it exists
            if (serviceLocator.eventManager) {
                serviceLocator.eventManager.emit('progress', {
                    name: 'AccessibilityMapPolygonGeneration',
                    progress: stepI++ / stepsCount
                });
            }

            // TODO This is the veryyy sloooooow operation.
            const polygonCoordinates = await this.clipPolygon(nodeCircles, isCancelled);
            const polygon = _cloneDeep(defaultGeojsonPolygon);
            polygon.geometry.coordinates = polygonCoordinates;

            const area = turfArea(polygon);
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
            // TODO Can this be other than a feature collection? If so, we need to handle the various cases
            const polygonStroke = turfPolygonToLine(polygon) as FeatureCollection<GeoJSON.LineString | MultiLineString>;
            const polygonStroke2 = turfFeatureCollection([]) as FeatureCollection<GeoJSON.LineString>;
            for (let i = 0, countI = polygonStroke.features.length; i < countI; i++) {
                const feature = polygonStroke.features[i];
                if (feature.geometry.type === 'MultiLineString') {
                    // this is a polygon with hole, we need to separate into two LineStrings.
                    for (let j = 1, countJ = feature.geometry.coordinates.length; j < countJ; j++) {
                        polygonStroke2.features.push(turfLineString(feature.geometry.coordinates[j]));
                    }
                    // TODO Copied from original code, but should it be .push instead of features[i] ?
                    polygonStroke2.features[i] = turfLineString(feature.geometry.coordinates[0]); // keep the first one as is, but convert to LineString
                } else {
                    polygonStroke2.features.push(feature as Feature<GeoJSON.LineString>);
                }
            }

            polygonStrokes.push(
                turfMultiLineString(
                    polygonStroke2.features.map((lineString) => {
                        return lineString.geometry.coordinates;
                    })
                )
            );

            // The backend does not have this event manager, so we only want to use it when it exists
            if (serviceLocator.eventManager) {
                serviceLocator.eventManager.emitProgress('AccessibilityMapPolygonGeneration', stepI++ / stepsCount);
            }
        }

        if (isCancelled()) {
            throw 'Cancelled';
        }

        return { polygons: polygons, strokes: polygonStrokes };
    }
}
