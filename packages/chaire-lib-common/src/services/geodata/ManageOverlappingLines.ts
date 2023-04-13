import { lineOffset, lineOverlap, lineString, LineString } from '@turf/turf';

interface OverlappingSegments {
    geoData: GeoJSON.Feature<LineString>;
    crossingLines: number[];
    directions: boolean[];
}

export const manageOverlappingLines = async (
    layerData: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<GeoJSON.FeatureCollection<LineString>> => {
    const overlapMap = await findOverlapingLines(layerData, isCancelled);
    const overlapArray = manageOverlapingSegmentsData(overlapMap, layerData);
    const offsetLayer = await applyOffset(overlapArray, layerData, isCancelled);
    const geojson = cleanLines(offsetLayer);
    return geojson;
};

const findOverlapingLines = async (
    layerData: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<Map<string, Set<number>>> => {
    return new Promise(async (resolve, reject) => {
        if (isCancelled && isCancelled()) {
            reject('Cancelled');
            return;
        }
        const features = layerData.features as any;
        console.log("ICI features :" + JSON.stringify(features));
        // The map contains the feature and a set of numbers
        // The feature is the segment concerned by the overlap
        // The set of numbers is a set that contains the IDs of every single line concerned by the overlap on that segment
        let overlapMap: Map<string, Set<number>> = new Map();
        for (let i = 0; i < features.length - 1; i++) {
            if(i%20 === 0){
                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
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
                            //console.log("ICI features :" + JSON.stringify(features));
                            //console.log(" ICI overlap :" + JSON.stringify(overlap));
                            overlapMap = fillOverlapMap(overlap, features, overlapMap, i, j);
                            resolve();
                        }, 0)
                    );
                } else {
                    overlapMap = fillOverlapMap(overlap, features, overlapMap, i, j);
                }
            }
        }
        resolve(overlapMap);
    });
};

const fillOverlapMap = (
    overlap: GeoJSON.FeatureCollection<LineString>,
    features: GeoJSON.Feature<LineString>,
    overlapMap: Map<string, Set<number>>,
    indexI: number,
    indexJ: number
): Map<string, Set<number>> => {
    for (const segment of overlap.features) {
        const overlapStr = JSON.stringify(segment);
        if (!overlapMap.has(overlapStr)) overlapMap.set(overlapStr, new Set());
        overlapMap.get(overlapStr)?.add(features[indexI].id).add(features[indexJ].id);
    }
    return overlapMap;
};

const manageOverlapingSegmentsData = (
    overlapMap: Map<string, Set<number>>,
    layerData: GeoJSON.FeatureCollection<LineString>
): OverlappingSegments[] => {
    const overlapArray: OverlappingSegments[] = [];
    overlapMap.forEach((value: any, key: any) => {
        const segmentDirections: Array<boolean> = [];
        const keyGeojson = JSON.parse(key);
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

const applyOffset = async (
    overlapArray: OverlappingSegments[],
    layerData: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<GeoJSON.FeatureCollection<LineString>> => {
    return new Promise(async (resolve, reject) => {
        for (let i = 0; i < overlapArray.length; i++) {
            if(i % 20 === 0){
                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
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
                            const offsetLine = lineOffset(segment, 3 * sameDirectionOffset, { units: 'meters' });
                            replaceCoordinate(segment, offsetLine, overlapArray[i].crossingLines[j], layerData);
                            sameDirectionOffset++;
                        } else {
                            const reverseCoordinates = segment.geometry.coordinates.slice().reverse();
                            const reverseLine = segment;
                            reverseLine.geometry.coordinates = reverseCoordinates;
                            const offsetLine = lineOffset(reverseLine, 3 * oppositeDirectionOffset, {
                                units: 'meters'
                            });
                            replaceCoordinate(reverseLine, offsetLine, overlapArray[i].crossingLines[j], layerData);
                            oppositeDirectionOffset++;
                        }
                    }
                    resolve();
                }, 0)
            );
        }
        resolve(layerData);
    });
};

const cleanLines = (geojson: GeoJSON.FeatureCollection<LineString>): GeoJSON.FeatureCollection<LineString> => {
    geojson.features.forEach((feature) => {
        feature.geometry.coordinates = feature.geometry.coordinates.filter((value) => {
            return !Number.isNaN(value[0]) && !Number.isNaN(value[1]);
        });
    });
    return geojson;
};

const replaceCoordinate = (
    lineToReplace: GeoJSON.Feature<LineString>,
    offsetLine: GeoJSON.Feature<LineString>,
    lineId: number,
    layerData: GeoJSON.FeatureCollection<LineString>
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

const getLineById = (lineId: number, layerData: GeoJSON.FeatureCollection<LineString>): GeoJSON.Feature<LineString> => {
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

const getLineIndexById = (lineId: number, layerData: GeoJSON.FeatureCollection<LineString>): number => {
    const features = layerData.features;
    for (let i = 0; i < features.length; i++) {
        if (features[i].id === lineId) {
            return i;
        }
    }
    return -1;
};
