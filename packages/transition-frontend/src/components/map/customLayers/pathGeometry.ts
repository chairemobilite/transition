/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Feature, LineString, Position } from 'geojson';
import { MercatorCoordinate } from 'maplibre-gl';
import {
    bbox as turfBbox,
    lineString as turfLineString,
    multiPoint as turfMultiPoint,
    simplify as turfSimplify
} from '@turf/turf';
import { hexToRgbArray } from 'chaire-lib-common/lib/utils/ColorUtils';

/** MapLibre tile size: one Mercator unit is 512 pixels at zoom 0 */
const TILE_SIZE = 512;
/** Consecutive points closer than this, in Mercator units (about 4 cm at the equator), are merged */
const MIN_SEGMENT_LENGTH = 1e-9;
/** Fallback color for paths without a valid `color` property */
const DEFAULT_COLOR_HEX = '#808080';
/**
 * Floats per segment in `PathInstances.segments`: previous point x, y, start x, y, end x, y,
 * next point x, y, distances of the start and end from the path start
 */
export const SEGMENT_FLOATS = 10;

/** Per-segment instance data for the GPU, ready to upload in vertex buffers */
export type PathInstances = {
    /**
     * Mercator origin of the coordinates, kept in float64. Float32 Mercator coordinates have a
     * resolution of about 2 m, so coordinates are stored relative to this origin.
     */
    origin: [number, number];
    /**
     * `SEGMENT_FLOATS` values per segment: Mercator previous point, start, end and next point,
     * relative to `origin`, then the distances from the start of its path to the segment start and
     * end, along the path before simplification, in pixels at zoom 0. The previous point of the first segment is its start, and the next point
     * of the last segment is its end: there is no join at the ends of the path.
     */
    segments: Float32Array;
    /** [r, g, b, a] of each segment, 0-255 */
    colors: Uint8Array;
    /** Number of segments */
    count: number;
};

const isLineStringFeature = (feature: Feature): feature is Feature<LineString> =>
    feature?.geometry?.type === 'LineString' && Array.isArray(feature.geometry.coordinates);

/**
 * Convert to Mercator and drop points too close to the previous one, which have no direction.
 * @returns Points as [x, y, distance from the first point], in Mercator units
 */
const toDistinctMercatorPoints = (coordinates: Position[]): Position[] => {
    const points: Position[] = [];
    for (const [lng, lat] of coordinates) {
        const { x, y } = MercatorCoordinate.fromLngLat([lng, lat]);
        const previous = points[points.length - 1];
        if (previous === undefined) {
            points.push([x, y, 0]);
            continue;
        }
        const length = Math.hypot(x - previous[0], y - previous[1]);
        if (length >= MIN_SEGMENT_LENGTH) {
            points.push([x, y, previous[2] + length]);
        }
    }
    return points;
};

/**
 * Remove the details smaller than the tolerance (Douglas-Peucker). The kept points are the input
 * arrays, so they keep their distance along the original path.
 */
const simplifyPoints = (points: Position[], toleranceMercator: number): Position[] =>
    toleranceMercator > 0 && points.length > 2
        ? turfSimplify(turfLineString(points), { tolerance: toleranceMercator, mutate: true }).geometry.coordinates
        : points;

/**
 * Build the instance buffers of the animated arrow path layer, one instance per segment.
 * Each path restarts its distance at 0. Features that are not line strings, or have fewer than
 * 2 distinct points, are skipped.
 *
 * @param features GeoJSON features, LineStrings with an optional `color` property (hex or rgb(a) string)
 * @param simplifyTolerance Details smaller than this distance, in pixels at zoom 0, are removed.
 * Distances along the paths stay those of the original geometry. Defaults to 0, no simplification.
 * @returns The instance data, with the origin at the center of the bounding box of all paths
 */
export const buildPathInstances = (features: Feature[], simplifyTolerance = 0): PathInstances => {
    const paths = features
        .filter(isLineStringFeature)
        .map((feature) => ({
            points: simplifyPoints(
                toDistinctMercatorPoints(feature.geometry.coordinates),
                simplifyTolerance / TILE_SIZE
            ),
            color: hexToRgbArray(feature.properties?.color, DEFAULT_COLOR_HEX)
        }))
        .filter((path) => path.points.length >= 2);
    const count = paths.reduce((total, path) => total + path.points.length - 1, 0);
    const segments = new Float32Array(count * SEGMENT_FLOATS);
    const colors = new Uint8Array(count * 4);
    if (count === 0) {
        return { origin: [0, 0], segments, colors, count };
    }

    const [minX, minY, maxX, maxY] = turfBbox(turfMultiPoint(paths.flatMap((path) => path.points)));
    const origin: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];

    let segmentIndex = 0;
    for (const path of paths) {
        const lastIndex = path.points.length - 1;
        for (let i = 1; i <= lastIndex; i++) {
            const start = path.points[i - 1];
            const end = path.points[i];
            const previous = path.points[Math.max(i - 2, 0)];
            const next = path.points[Math.min(i + 1, lastIndex)];
            const relativePoints = [previous, start, end, next].flatMap((point) => [
                point[0] - origin[0],
                point[1] - origin[1]
            ]);
            segments.set([...relativePoints, start[2] * TILE_SIZE, end[2] * TILE_SIZE], segmentIndex * SEGMENT_FLOATS);
            colors.set(path.color, segmentIndex * 4);
            segmentIndex++;
        }
    }
    return { origin, segments, colors, count };
};
