/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { lineOffset, lineOverlap, lineString, booleanPointInPolygon } from '@turf/turf';
import { LineString, Feature, Polygon } from 'geojson';

export const OFFSET_WIDTH = 3; // Offset of each line in meters

interface OverlappingSegments {
    /**
     * GeoJSON data containing the overlapping coordinates
     */
    geoData: GeoJSON.Feature<LineString>;
    /**
     * Index of each line in conflict with the specified overlap
     */
    crossingLines: number[];
    /**
     * Directions of each line in conflict.
     * True means the line has the overlap in the same coordinates order as geodata.
     * False means the line has the overlap is in the opposite direction.
     */
    directions: boolean[];
}

/**
 * Obtains the lines from a paths layer that have at least one coordinate inside the viewport.
 * @param bounds - a bounding box Polygon that represents the viewport's coordinates
 * @param layer - the paths layer that we want to get the visible lines from
 * @return A collection of the lines that are in the viewport
 */
export const getLinesInView = (
    bounds: Feature<Polygon>,
    layer: GeoJSON.FeatureCollection<LineString>
): GeoJSON.FeatureCollection<LineString> => {
    const features = layer.features;
    const linesInView: GeoJSON.FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] };
    for (let i = 0; i < features.length; i++) {
        for (let j = 0; j < features[i].geometry.coordinates.length; j++) {
            if (isInBounds(bounds, features[i].geometry.coordinates[j])) {
                linesInView.features.push(features[i]);
                break;
            }
        }
    }
    return linesInView;
};

const isInBounds = (bounds: Feature<Polygon>, coord: number[]): boolean => {
    return booleanPointInPolygon(coord, bounds);
};

/**
 * Offset overlapping lines when multiple lines use the same road or segment.
 * This is to be able to visually follow where each line goes.
 * @param layerData GeoJSON data containing the lines to offset (will be modified)
 */
export const offsetOverlappingLines = async (
    layerData: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<void> => {
    try {
        const overlapMap = await findOverlappingLines(layerData, isCancelled);
        const overlapArray = manageOverlappingSegmentsData(overlapMap, layerData);
        await applyOffset(overlapArray, layerData, isCancelled);
        cleanLines(layerData);
        return;
    } catch (e) {
        return Promise.reject(e);
    }
};

const findOverlappingLines = async (
    layerData: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<Map<string, Set<number>>> => {
    if (isCancelled && isCancelled()) {
        return Promise.reject('Cancelled');
    }

    const features = layerData.features;
    // The map contains the feature and a set of numbers
    // The feature is the segment concerned by the overlap
    // The set of numbers is a set that contains the IDs of every single line concerned by the overlap on that segment
    let overlapMap: Map<string, Set<number>> = new Map();
    for (let i = 0; i < features.length - 1; i++) {
        if (i % 20 === 0) {
            if (isCancelled && isCancelled()) {
                return Promise.reject('Cancelled');
            }
        }
        for (let j = i + 1; j < features.length; j++) {
            const overlap = lineOverlap(
                lineString(features[i].geometry.coordinates),
                lineString(features[j].geometry.coordinates)
            );
            if (overlap.features.length === 0) continue;
            if (j % 20 === 0) {
                await new Promise<void>((resolve) =>
                    setTimeout(() => {
                        overlapMap = fillOverlapMap(overlap, overlapMap, i, j);
                        resolve();
                    }, 0)
                );
            } else {
                overlapMap = fillOverlapMap(overlap, overlapMap, i, j);
            }
        }
    }
    return Promise.resolve(overlapMap);
};

const fillOverlapMap = (
    overlap: GeoJSON.FeatureCollection<LineString>,
    overlapMap: Map<string, Set<number>>,
    indexI: number,
    indexJ: number
): Map<string, Set<number>> => {
    for (const segment of overlap.features) {
        const overlapStr = JSON.stringify(segment);
        if (!overlapMap.has(overlapStr)) overlapMap.set(overlapStr, new Set());
        overlapMap.get(overlapStr)?.add(indexI).add(indexJ);
    }
    return overlapMap;
};

const manageOverlappingSegmentsData = (
    overlapMap: Map<string, Set<number>>,
    layerData: GeoJSON.FeatureCollection<LineString>
): OverlappingSegments[] => {
    const overlapArray: OverlappingSegments[] = [];
    overlapMap.forEach((value: Set<number>, key: string) => {
        const segmentDirections: Array<boolean> = [];
        const keyGeojson = JSON.parse(key);
        // For each line, add the direction of the overlap segment
        value.forEach((index: number) => {
            const data = layerData.features[index];
            const coordinates = keyGeojson.geometry.coordinates;
            const firstPoint = coordinates[0];
            const lastPoint = coordinates[coordinates.length - 1];
            for (let i = 0; i < data.geometry.coordinates.length; i++) {
                const actualPoint = data.geometry.coordinates[i];
                if (actualPoint[0] === firstPoint[0] && actualPoint[1] === firstPoint[1]) {
                    segmentDirections.push(true);
                    break;
                } else if (actualPoint[0] === lastPoint[0] && actualPoint[1] === lastPoint[1]) {
                    segmentDirections.push(false);
                    break;
                }
            }
        });
        const overlap: OverlappingSegments = {
            geoData: keyGeojson,
            crossingLines: Array.from(value),
            directions: segmentDirections
        };
        overlapArray.push(overlap);
    });
    return overlapArray;
};

const applyOffset = async (
    overlapArray: OverlappingSegments[],
    layerData: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<void> => {
    for (let i = 0; i < overlapArray.length; i++) {
        if (i % 20 === 0) {
            if (isCancelled && isCancelled()) {
                return Promise.reject('Cancelled');
            }
        }
        await new Promise<void>((resolve) =>
            setTimeout(() => {
                const nbOverlapped = overlapArray[i].directions.length;
                let oppositeDirectionOffset = 0;
                let sameDirectionOffset = 0;
                for (let j = 0; j < nbOverlapped; j++) {
                    const segment = overlapArray[i].geoData;
                    if (overlapArray[i].directions[j]) {
                        const line = layerData.features[overlapArray[i].crossingLines[j]];
                        replaceLineCoordinates(segment, sameDirectionOffset, line);
                        sameDirectionOffset++;
                    } else {
                        // No deep copy made before the reverse as there was already one previously
                        segment.geometry.coordinates.reverse();
                        const line = layerData.features[overlapArray[i].crossingLines[j]];
                        replaceLineCoordinates(segment, oppositeDirectionOffset, line);
                        oppositeDirectionOffset++;
                    }
                }
                resolve();
            }, 0)
        );
    }
    return;
};

/**
 * Replace coordinates of a segment of line with the offsetted coordinates
 * @param originalSegment The unmodified coordinates of the segment to offset
 * @param offsetCount Units by which to offset the segment
 * @param line The complete line on which to apply the offset segment (will be modified)
 */
const replaceLineCoordinates = (
    originalSegment: GeoJSON.Feature<LineString>,
    offsetCount: number,
    line: GeoJSON.Feature<LineString>
): void => {
    const offsetSegment = lineOffset(originalSegment, OFFSET_WIDTH * offsetCount, { units: 'meters' });
    // We go through the coordinates of every single LineString until we reach the starting point of the segment we want to replace
    for (let i = 0; i < line.geometry.coordinates.length; i++) {
        let match = true;
        originalSegment.geometry.coordinates.forEach((oldCoord, index) => {
            if (i + index >= line.geometry.coordinates.length) {
                match = false;
            } else {
                const lineCoord = line.geometry.coordinates[i + index];
                if (lineCoord[0] !== oldCoord[0] || lineCoord[1] !== oldCoord[1]) {
                    match = false;
                }
            }
        });

        if (match) {
            for (let j = 0; j < originalSegment.geometry.coordinates.length; j++) {
                line.geometry.coordinates[i + j] = offsetSegment.geometry.coordinates[j];
            }
            break;
        }
    }
};

const cleanLines = (geojson: GeoJSON.FeatureCollection<LineString>): void => {
    geojson.features.forEach((feature) => {
        feature.geometry.coordinates = feature.geometry.coordinates.filter((value) => {
            return !Number.isNaN(value[0]) && !Number.isNaN(value[1]);
        });
    });
};
