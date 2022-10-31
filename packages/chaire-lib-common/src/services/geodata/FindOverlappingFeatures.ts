/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';
import * as turf from '@turf/turf';

import { SingleGeometry } from './GeoJSONUtils';
import pointInPolygon from './pointInPolygon';

// TODO Can we type this?
const getComparisonMethod = (feature: GeoJSON.Feature): ((a: any, b: any) => boolean) => {
    if (feature.geometry.type === 'LineString') {
        return (a, b) => turf.booleanPointOnLine(a, b, {});
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        return (a, b) => pointInPolygon(a, b, false);
    }
    if (feature.geometry.type === 'MultiLineString') {
        return (point: any, multiLineStringFeature: any) => {
            const singleLineStringsFeatureCollection = turf.flatten(
                multiLineStringFeature as GeoJSON.LineString | GeoJSON.MultiLineString
            );
            for (let i = 0, count = singleLineStringsFeatureCollection.features.length; i < count; i++) {
                if (turf.booleanPointOnLine(point as GeoJSON.Point, singleLineStringsFeatureCollection.features[i])) {
                    return true;
                }
            }
            return false;
        };
    }
    return (_a, _b) => false;
};

export const findOverlappingFeatures = <G extends GeoJSON.Geometry, P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature,
    features: GeoJSON.Feature<G, P>[],
    options: { not: boolean } = { not: false }
): GeoJSON.Feature<G, P>[] => {
    if (feature.geometry.type === 'GeometryCollection') {
        console.log('findOverlappingFeature does not process geometries of type GeometryCollection');
        return [];
    }
    const indices = getOverlappingIndices(feature as GeoJSON.Feature<SingleGeometry>, features);
    return features.filter((f, index) => {
        const overlaps = indices.includes(index);
        return options.not ? !overlaps : overlaps;
    });
};

export interface SplitOverlappingFeatureOptions {
    /**
     * The number of results that are expected to be returned. A value <= 0 will
     * return the overlapping results without trying to find more. Otherwise, if
     * the actual results count is too low, then the method may try with a
     * buffer on the feature, or change the geometry of concave shapes.
     */
    expectedApproximateCount?: number;
    /**
     * Function to calculate the count of a feature. Default will be 1 per
     * feature. Default: each feature is worth 1 count.
     */
    featureCount?: (feature: GeoJSON.Feature) => number;
    /**
     * If true, and the expected count does not match, a polygon shape will be
     * converted to a convex shape to get additional results in case of
     * mismatch. Defaults to true if expectedApproximateCount is > 0.
     */
    allowConvex?: boolean;
    /**
     * If true and the expected count does not match, it will add a buffer
     * around the feature and try to find overlapping feature of that size.
     * Defaults to true if expectedApproximateCount is > 0.
     */
    allowBuffer?: boolean;
    /**
     * Maximum buffer size, in meters, to add to the shape to get extra
     * features. If left blank, the max buffer size will be calculated as the
     * smallest distance between features - 1, in meters.
     */
    maxBufferSize?: number;
}

export const getOverlappingIndices = (
    feature: GeoJSON.Feature<SingleGeometry>,
    featureToSplit: GeoJSON.Feature[]
): number[] => {
    // TODO: Start by splitting the feature in the bounding box, to avoid
    // lengthy calculation for far away features
    const comparisonMethod = getComparisonMethod(feature);
    if (!comparisonMethod) {
        console.warn('Cannot find overlapping geometries for feature type ', feature.geometry);
        return [];
    }
    const overlappingIndices: number[] = [];

    featureToSplit.forEach((toCompare, index) => {
        if (
            toCompare.geometry.type !== 'Point' &&
            toCompare.geometry.type !== 'MultiPoint' &&
            toCompare.geometry.type !== 'GeometryCollection'
        ) {
            try {
                if (
                    toCompare.geometry.type === feature.geometry.type &&
                    turf.booleanOverlap(toCompare.geometry, feature.geometry)
                ) {
                    overlappingIndices.push(index);
                } else if (
                    // The booleanDisjoint call supports more geometries than other turf functions, especially multi* features
                    !turf.booleanDisjoint(toCompare.geometry, feature.geometry)
                ) {
                    overlappingIndices.push(index);
                }
            } catch (e) {
                // Unsupported geometry in overlap or within, just ignore instead of checking all types
            }
        } else if (comparisonMethod(toCompare.geometry, feature.geometry)) {
            overlappingIndices.push(index);
        }
    });
    return overlappingIndices;
};

const splitOverlapping = <G extends GeoJSON.Geometry, P extends GeoJSON.GeoJsonProperties>(
    featuresToSplit: GeoJSON.Feature<G, P>[],
    overlappingIndices: number[]
): { overlapping: GeoJSON.Feature<G, P>[]; notOverlapping: GeoJSON.Feature<G, P>[] } => {
    const overlapping: GeoJSON.Feature<G, P>[] = [];
    const notOverlapping: GeoJSON.Feature<G, P>[] = [];

    featuresToSplit.forEach((feature, index) => {
        overlappingIndices.includes(index) ? overlapping.push(feature) : notOverlapping.push(feature);
    });
    return { overlapping, notOverlapping };
};

const getFeatureCount = (
    features: GeoJSON.Feature[],
    indices: number[],
    featureCount: (feature: GeoJSON.Feature) => number
): number => {
    let count = 0;
    indices.forEach((index) => (count += featureCount(features[index])));
    return count;
};

const getOverlappingOnConvex = (feature: GeoJSON.Feature, featuresToSplit: GeoJSON.Feature[]): number[] => {
    const convexFeature = turf.convex(turf.explode(feature as turf.AllGeoJSON));
    if (convexFeature === feature) {
        console.log('Convex feature equivalent to feature');
    } else if (convexFeature === null) {
        return [];
    }
    return getOverlappingIndices(convexFeature, featuresToSplit);
};

const getOverlappingOnBuffer = (
    originalFeature: GeoJSON.Feature,
    options: {
        expectedApproximateCount: number;
        featureCount: (feature: GeoJSON.Feature) => number;
        maxBufferSize: number;
        overlappingIndices: number[];
        bestCount: number;
    },
    featuresToSplit: GeoJSON.Feature[]
): number[] => {
    // Do 4 buffer iterations to find the best count
    let diff = options.maxBufferSize;
    let buffer = 0;
    let i = 0;
    let bestApproximation: number[] = options.overlappingIndices;
    let bestCount = options.bestCount;
    let lastCount = bestCount;
    let lastIndices: number[] = bestApproximation;
    while (i < 7 && bestCount !== options.expectedApproximateCount) {
        diff = diff / 2;
        buffer = lastCount < options.expectedApproximateCount ? buffer + diff : buffer - diff;
        const bufferedFeature = turf.buffer(originalFeature, buffer / 1000);
        if (bufferedFeature.geometry === null) {
            break;
        }
        lastIndices = getOverlappingIndices(bufferedFeature, featuresToSplit);
        lastCount =
            lastIndices.length > bestApproximation.length
                ? getFeatureCount(featuresToSplit, lastIndices, options.featureCount)
                : bestCount;
        if (lastCount <= options.expectedApproximateCount && lastCount > bestCount) {
            bestCount = lastCount;
            bestApproximation = lastIndices;
        }
        i++;
    }
    return bestApproximation;
};

/** Max buffer size is the minimal distance between features - 1 in meters */
const getMaxBufferSize = (feature: GeoJSON.Feature, featuresToSplit: GeoJSON.Feature[]): number => {
    // First, to get a max buffer size, do a square root of the area of the
    // feature, that should give a good enough first approximation, even if the
    // shape is not a square.
    const area = turf.area(feature);
    const defaultBufferSizeInMeters = Math.sqrt(area);
    if (featuresToSplit.length <= 1) {
        return defaultBufferSizeInMeters;
    }
    // Then to avoid having too large buffers for large shape, we filter the
    // feature on a buffer of the size of the shape, then calculate the smallest
    // distance between features in that area as the buffer size.
    const bufferedShape = turf.buffer(feature, defaultBufferSizeInMeters / 1000);
    if (bufferedShape.geometry === null) {
        return defaultBufferSizeInMeters;
    }
    const splitSubset = getOverlappingIndices(bufferedShape, featuresToSplit);
    let minDistance = defaultBufferSizeInMeters; // in meters
    for (let i = 0, len = splitSubset.length; i < len - 1; i++) {
        for (let j = i + 1; j < len; j++) {
            minDistance = Math.min(
                minDistance,
                turf.distance(
                    turf.pointOnFeature(featuresToSplit[splitSubset[i]] as turf.AllGeoJSON) as GeoJSON.Feature<
                        GeoJSON.Point
                    >,
                    turf.pointOnFeature(featuresToSplit[splitSubset[j]] as turf.AllGeoJSON) as GeoJSON.Feature<
                        GeoJSON.Point
                    >
                ) * 1000
            );
        }
    }
    return Math.max(1, Math.floor(minDistance));
};

/**
 * Split the features between those that overlap and those that do not. Each
 * element in the original array is in one the returned arrays.
 * @param feature The feature to overlap
 * @param featureToSplit The feature array to split
 */
export const splitOverlappingFeatures = <G extends GeoJSON.Geometry, P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature,
    featuresToSplit: GeoJSON.Feature<G, P>[],
    options: SplitOverlappingFeatureOptions = {
        expectedApproximateCount: 0,
        featureCount: (_feature: GeoJSON.Feature) => 1,
        allowConvex: true,
        allowBuffer: true,
        maxBufferSize: undefined
    }
): { overlapping: GeoJSON.Feature<G, P>[]; notOverlapping: GeoJSON.Feature<G, P>[] } => {
    const filteredFeatures = featuresToSplit.filter((f) => f.geometry.type !== 'GeometryCollection') as GeoJSON.Feature<
        G,
        P
    >[];
    if (feature.geometry.type === 'GeometryCollection') {
        console.log('splitOverlappingFeatures does not process geometries of type GeometryCollection');
        return { overlapping: [], notOverlapping: filteredFeatures };
    }
    const geometryFeature = feature as GeoJSON.Feature<SingleGeometry>;

    const expectedApproximateCount = options.expectedApproximateCount || 0;
    const featureCount = options.featureCount || (() => 1);
    const allowConvex = options.allowConvex === undefined ? true : options.allowConvex;
    const allowBuffer = options.allowBuffer === undefined ? true : options.allowBuffer;

    const overlappingIndices = getOverlappingIndices(geometryFeature, filteredFeatures);
    // No count check, fast return
    if (expectedApproximateCount <= 0) {
        return splitOverlapping(filteredFeatures, overlappingIndices);
    }
    const countOverlapping = getFeatureCount(filteredFeatures, overlappingIndices, featureCount);
    if (countOverlapping < expectedApproximateCount && (allowConvex || allowBuffer)) {
        // Try splitting on the convex hull
        let overlappingConvexIndices = allowConvex
            ? getOverlappingOnConvex(geometryFeature, filteredFeatures)
            : overlappingIndices;
        if (allowConvex) {
            const countOverlappingConvex =
                overlappingConvexIndices.length > overlappingIndices.length
                    ? getFeatureCount(filteredFeatures, overlappingConvexIndices, featureCount)
                    : countOverlapping;
            if (countOverlappingConvex === expectedApproximateCount) {
                return splitOverlapping(filteredFeatures, overlappingConvexIndices);
            } else if (countOverlappingConvex > expectedApproximateCount) {
                overlappingConvexIndices = overlappingIndices;
            }
        }

        // Try splitting with a buffer
        if (allowBuffer) {
            const realMaxBufferSize = options.maxBufferSize
                ? options.maxBufferSize
                : getMaxBufferSize(geometryFeature, filteredFeatures);
            const overlappingOnBufferIndices = getOverlappingOnBuffer(
                geometryFeature,
                {
                    expectedApproximateCount,
                    featureCount,
                    maxBufferSize: realMaxBufferSize,
                    overlappingIndices,
                    bestCount: countOverlapping
                },
                filteredFeatures
            );
            const countOverlappingBuffer =
                overlappingOnBufferIndices.length > overlappingIndices.length
                    ? getFeatureCount(filteredFeatures, overlappingOnBufferIndices, featureCount)
                    : countOverlapping;
            if (countOverlappingBuffer === expectedApproximateCount) {
                return splitOverlapping(filteredFeatures, overlappingOnBufferIndices);
            }
            // See if convex + buffer has better result
            const overlappingBufferConvexIndices = Object.assign([], overlappingOnBufferIndices);
            overlappingConvexIndices.forEach((i) => {
                if (!overlappingBufferConvexIndices.includes(i)) {
                    overlappingBufferConvexIndices.push(i);
                }
            });
            const countOverlappingBufferConvex =
                overlappingBufferConvexIndices.length > overlappingIndices.length
                    ? getFeatureCount(filteredFeatures, overlappingBufferConvexIndices, featureCount)
                    : countOverlapping;
            return splitOverlapping(
                filteredFeatures,
                countOverlappingBufferConvex <= expectedApproximateCount
                    ? overlappingBufferConvexIndices
                    : overlappingOnBufferIndices
            );
        }
        return splitOverlapping(filteredFeatures, overlappingConvexIndices);
    }
    return splitOverlapping(filteredFeatures, overlappingIndices);
};
