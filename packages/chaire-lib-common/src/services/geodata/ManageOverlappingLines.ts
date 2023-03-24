import { cleanCoords, lineOffset, lineOverlap, lineString } from '@turf/turf';

interface OverlappingSegments {
    geoData: GeoJSON.Feature<GeoJSON.LineString>;
    crossingLines: number[];
    directions: boolean[];
}

export const manageOverlappingLines = (layerData: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection => {
    const overlapMap = findOverlapingLines(layerData);
    const overlapArray = manageOverlapingSegmentsData(overlapMap, layerData);
    return applyOffset(overlapArray, layerData);
};

const applyOffset = (
    overlapArray: OverlappingSegments[],
    layerData: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection => {
    for (let i = 0; i < overlapArray.length; i++) {
        const nbOverlapped = overlapArray[i].directions.length;
        let oppositeDirectionOffset = 0;
        let sameDirectionOffset = 0;
        for (let j = 0; j < nbOverlapped; j++) {
            const segment = overlapArray[i].geoData;
            if (overlapArray[i].directions[j]) {
                const offsetLine = lineOffset(segment, 3 * sameDirectionOffset, { units: 'meters' });
                replaceCoordinate(segment, offsetLine, overlapArray[i].crossingLines[j], layerData);
                sameDirectionOffset++;
            } else {
                const reverseCoordinates = segment.geometry.coordinates.slice().reverse();
                const reverseLine = segment;
                reverseLine.geometry.coordinates = reverseCoordinates;
                const offsetLine = lineOffset(reverseLine, 3 * oppositeDirectionOffset, { units: 'meters' });
                replaceCoordinate(reverseLine, offsetLine, overlapArray[i].crossingLines[j], layerData);
                oppositeDirectionOffset++;
            }
        }
    }
    return layerData;
};

const findOverlapingLines = (
    layerData: GeoJSON.FeatureCollection
): Map<GeoJSON.Feature<GeoJSON.LineString>, Set<number>> => {
    const features = layerData.features as any;
    // The map contains the feature and a set of numbers
    // The feature is the segment concerned by the overlap
    // The set of numbers is a set that contains the IDs of every single line concerned by the overlap on that segment
    const overlapMap: Map<GeoJSON.Feature<GeoJSON.LineString>, Set<number>> = new Map();
    for (let i = 0; i < features.length - 1; i++) {
        for (let j = i + 1; j < features.length; j++) {
            const overlap = lineOverlap(
                lineString(features[i].geometry.coordinates),
                lineString(features[j].geometry.coordinates)
            );
            if (overlap.features.length === 0) continue;
            for (const segment of overlap.features) {
                if (segment.geometry.coordinates.length <= 2) continue;
                const overlap = segment;
                if (!overlapMap.has(overlap)) overlapMap.set(overlap, new Set());
                overlapMap.get(overlap)?.add(features[i].id).add(features[j].id);
            }
        }
    }
    return overlapMap;
};

const manageOverlapingSegmentsData = (
    overlapMap: Map<GeoJSON.Feature<GeoJSON.LineString>, Set<number>>,
    layerData: GeoJSON.FeatureCollection
): OverlappingSegments[] => {
    const overlapArray: OverlappingSegments[] = [];
    overlapMap.forEach((value: any, key: any) => {
        const segmentDirections: Array<boolean> = [];
        value.forEach((id: number) => {
            const data = getLineById(id, layerData);
            const coordinates = key.geometry.coordinates;
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
            geoData: key,
            crossingLines: Array.from(value),
            directions: segmentDirections
        };
        overlapArray.push(overlap);
    });
    return overlapArray;
};

const replaceCoordinate = (
    lineToReplace: GeoJSON.Feature<GeoJSON.LineString>,
    offsetLine: GeoJSON.Feature<GeoJSON.LineString>,
    lineId: number,
    layerData: GeoJSON.FeatureCollection
): void => {
    const line = getLineById(lineId, layerData);
    const oldCoordinates = lineToReplace.geometry.coordinates;
    const length = oldCoordinates.length;
    // We go through the coordinates of every single LineString until we reach the starting point of the segment we want to replace
    for (let i = 0; i < line.geometry.coordinates.length; i++) {
        let match = true;
        oldCoordinates.forEach((oldCoord, index) => {
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
            for (let j = 0; j < length; j++) {
                line.geometry.coordinates[i + j] = offsetLine.geometry.coordinates[j];
            }
            break;
        }
    }
    const lineIndex = getLineIndexById(lineId, layerData);
    const geoData = layerData as any;
    geoData.features[lineIndex].geometry.coordinates = line.geometry.coordinates;
};

const getLineById = (lineId: number, layerData: GeoJSON.FeatureCollection): GeoJSON.Feature<GeoJSON.LineString> => {
    const features = layerData.features as any;
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

const getLineIndexById = (lineId: number, layerData: GeoJSON.FeatureCollection): number => {
    const features = layerData.features;
    for (let i = 0; i < features.length; i++) {
        if (features[i].id === lineId) {
            return i;
        }
    }
    return -1;
};
