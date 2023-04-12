/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { lineOffset, lineOverlap, lineString } from '@turf/turf';
import { LineString } from 'geojson';

export const OFFSET_WIDTH = 3; // Offset of each line in meters

interface OverlappingSegments {
    /**
     * GeoJSON data containing the overlapping coordinates
     */
    geoData: GeoJSON.Feature<LineString>;
    /**
     * IDs of each line in conflict with the specified overlap
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
 * Offset overlapping lines when multiple lines use the same road or segment.
 * This is to be able to visually follow where each line goes.
 * @param layerData GeoJSON data containing the lines to offset (will be modified)
 * @returns Same GeoJSON data as entry with the offsetted lines
 */
export const offsetOverlappingLines = (
    layerData: GeoJSON.FeatureCollection<LineString>
): GeoJSON.FeatureCollection<LineString> => {
    const overlapMap = findOverlappingLines(layerData);
    const overlapArray = manageOverlappingSegmentsData(overlapMap, layerData);
    const offsetLayer = applyOffset(overlapArray, layerData);
    return cleanLines(offsetLayer);
};

const findOverlappingLines = (layerData: GeoJSON.FeatureCollection<LineString>): Map<string, Set<number>> => {
    const features = layerData.features;
    // The map contains the feature and a set of numbers
    // The feature is the segment concerned by the overlap
    // The set of numbers is a set that contains the IDs of every single line concerned by the overlap on that segment
    const overlapMap: Map<string, Set<number>> = new Map();
    for (let i = 0; i < features.length - 1; i++) {
        for (let j = i + 1; j < features.length; j++) {
            const overlap = lineOverlap(
                lineString(features[i].geometry.coordinates),
                lineString(features[j].geometry.coordinates)
            );
            if (overlap.features.length === 0) continue;
            for (const segment of overlap.features) {
                const overlapStr = JSON.stringify(segment);
                if (!overlapMap.has(overlapStr)) overlapMap.set(overlapStr, new Set());
                overlapMap.get(overlapStr)?.add(Number(features[i].id)).add(Number(features[j].id));
            }
        }
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
        value.forEach((id: number) => {
            const data = getLineById(id, layerData);
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

const applyOffset = (
    overlapArray: OverlappingSegments[],
    layerData: GeoJSON.FeatureCollection<LineString>
): GeoJSON.FeatureCollection<LineString> => {
    for (let i = 0; i < overlapArray.length; i++) {
        const nbOverlapped = overlapArray[i].directions.length;
        let oppositeDirectionOffset = 0;
        let sameDirectionOffset = 0;
        for (let j = 0; j < nbOverlapped; j++) {
            const segment = overlapArray[i].geoData;
            if (overlapArray[i].directions[j]) {
                const line = getLineById(overlapArray[i].crossingLines[j], layerData);
                replaceLineCoordinates(segment, sameDirectionOffset, line);
                sameDirectionOffset++;
            } else {
                // No deep copy made before the reverse as there was already one previously
                segment.geometry.coordinates.reverse();
                const line = getLineById(overlapArray[i].crossingLines[j], layerData);
                replaceLineCoordinates(segment, oppositeDirectionOffset, line);
                oppositeDirectionOffset++;
            }
        }
    }
    return layerData;
};

/**
 * Replace coordinates of a segment of line with the offsetted coordinates
 * @param originalSegment The unmodified coordinates of the segment to offset
 * @param offsetCount Units by which to offset the segment
 * @param line The complete line on which to apply the offset segment
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

const cleanLines = (geojson: GeoJSON.FeatureCollection<LineString>): GeoJSON.FeatureCollection<LineString> => {
    geojson.features.forEach((feature) => {
        feature.geometry.coordinates = feature.geometry.coordinates.filter((value) => {
            return !Number.isNaN(value[0]) && !Number.isNaN(value[1]);
        });
    });
    return geojson;
};

const getLineById = (lineId: number, layerData: GeoJSON.FeatureCollection<LineString>): GeoJSON.Feature<LineString> => {
    const features = layerData.features;
    for (let i = 0; i < features.length; i++) {
        if (features[i].id === lineId) {
            return features[i];
        }
    }
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: []
        }
    };
};
