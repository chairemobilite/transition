import MapboxGL from 'mapbox-gl';
import serviceLocator from '../../utils/ServiceLocator';
import { lineOffset, lineOverlap, Lines, lineString, LineString, nearestPointOnLine } from '@turf/turf';

const zoomLimit = 14; //Zoom levels smaller than this will not apply line separation
let originalLayer; //Necessary so that offsets aren't applied to already offset lines after zoom
// let currentLayer; //Is the usual layer when in prod, and a smaller custom layer when doing tests

interface OverlappingSegments {
    geoData: GeoJSON.Feature<LineString>;
    crossingLines: number[];
    directions: boolean[];
}

export const manageZoom = (bounds: MapboxGL.LngLatBounds, zoom: number): void => {
    if (!originalLayer) {
        //Site does not load if original layer is initialized as a constant
        //Deep copy of original layer, necessary so that repeated zooms don't apply offsets to the same points
        originalLayer = (serviceLocator.layerManager._layersByName['transitPaths'].source.data
        );
    }

    if (zoom <= zoomLimit) {
        return;
    }

    const linesInView = getLinesInView(bounds, originalLayer);

    manageOverlappingLines(linesInView); //ServiceLocator necessary to have reference to layer used by transition
    manageRelocatingNodes();

    serviceLocator.eventManager.emit(
        'map.updateLayer',
        'transitPaths',
        originalLayer
    );
    serviceLocator.eventManager.emit(
        'map.updateLayers',
        'transitNodes',
        serviceLocator.collectionManager.get('nodes').toGeojson()
    );
};

export const getLinesInView = (
    bounds: MapboxGL.LngLatBounds,
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

const isInBounds = (bounds: MapboxGL.LngLatBounds, coord: number[]): boolean => {
    return bounds.contains(new MapboxGL.LngLat(coord[0], coord[1]));
};

export const manageOverlappingLines = (
    layerData: GeoJSON.FeatureCollection<LineString>,
): GeoJSON.FeatureCollection<LineString> => {
    const overlapMap = findOverlapingLines(layerData);
    const overlapArray = manageOverlapingSegmentsData(overlapMap, layerData);
    applyOffset(overlapArray, layerData);
    return cleanLines(layerData);
};

const cleanLines = (layerData: GeoJSON.FeatureCollection<LineString>): GeoJSON.FeatureCollection<LineString> => {
    layerData.features.forEach((feature) => {
        feature.geometry.coordinates = feature.geometry.coordinates.filter((value) => {
            return !Number.isNaN(value[0]) && !Number.isNaN(value[1]);
        });
    });
    return layerData;
};

const applyOffset = (overlapArray: OverlappingSegments[], layerData: GeoJSON.FeatureCollection<LineString>): void => {
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
};

const replaceCoordinate = (
    lineToReplace: GeoJSON.Feature<LineString>,
    offsetLine: GeoJSON.Feature<LineString>,
    lineId: number,
    layerData: GeoJSON.FeatureCollection<LineString>
): void => {
    const line = layerData.features[lineId];
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
};

const findOverlapingLines = (layerData: GeoJSON.FeatureCollection<LineString>): Map<string, Set<number>> => {
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
                overlapMap.get(overlapStr)?.add(i).add(j);
            }
        }
    }
    return overlapMap;
};

const manageOverlapingSegmentsData = (overlapMap: Map<string, Set<number>>, layerData: GeoJSON.FeatureCollection<LineString>): OverlappingSegments[] => {
    const overlapArray: OverlappingSegments[] = [];
    overlapMap.forEach((value: any, key: any) => {
        const segmentDirections: Array<boolean> = [];
        const keyGeojson = JSON.parse(key);
        value.forEach((id: number) => {
            const data = layerData.features[id];
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

export const relocateNodes = (nodeFeatures: any, nodeMap: Map<any, any>, pathFeatures: any) => {
    const relocatedNodes: any[] = [];
    nodeFeatures.features.forEach((nodeFeature) => {
        const nodeId = nodeFeature.properties.id;
        const paths = nodeMap.get(nodeId);
        if (paths && paths.length > 1) {
            const pathCoords = paths.map((pathId) => {
                const pathFeature = pathFeatures.features.find((feature) => feature.id === pathId);
                return pathFeature.geometry.coordinates;
            });
            const nodeCoords = nodeFeature.geometry.coordinates;
            const closestPoints = findClosestPoints(nodeCoords, pathCoords);
            const middlePoint = findMiddlePoint(closestPoints);
            const modifiedNode = {
                type: 'Feature',
                id: nodeFeature.id,
                geometry: {
                    type: 'Point',
                    coordinates: middlePoint
                },
                properties: {
                    id: nodeId,
                    color: '#ff0000'
                }
            };
            if (!areCoordinatesEqual(modifiedNode.geometry.coordinates, nodeFeature.geometry.coordinates)) {
                for (let i = 0; i < nodeFeatures.features.length; i++) {
                    if (nodeFeatures.features[i].properties.id == nodeId) {
                        serviceLocator.layerManager._layersByName['transitNodes'].source.data.features[i] =
                            modifiedNode;
                    }
                }
                relocatedNodes.push(modifiedNode);
            }
        }
    });

    return {
        type: 'FeatureCollection',
        features: relocatedNodes
    };
};

function areCoordinatesEqual(coords1: number[], coords2: number[]): boolean {
    return coords1[0] === coords2[0] && coords1[1] === coords2[1];
}

function findClosestPoints(nodeCoords, pathCoords) {
    const closestPoints = pathCoords.map((path) => {
        const line = lineString(path);
        const nearestPoint = nearestPointOnLine(line, nodeCoords);
        return nearestPoint.geometry.coordinates;
    });
    return closestPoints;
}

function findMiddlePoint(points) {
    const numPoints = points.length;
    const xCoords = points.map((point) => point[0]);
    const yCoords = points.map((point) => point[1]);
    const xSum = xCoords.reduce((sum, coord) => sum + coord, 0);
    const ySum = yCoords.reduce((sum, coord) => sum + coord, 0);
    const xMiddle = xSum / numPoints;
    const yMiddle = ySum / numPoints;
    return [xMiddle, yMiddle];
}

function getCrossingPaths(featureCollection) {
    const nodeMap = new Map();

    featureCollection.features.forEach((feature) => {
        const nodes = feature.properties.nodes;
        nodes.forEach((node) => {
            if (!nodeMap.has(node)) {
                nodeMap.set(node, [feature.id]);
            } else {
                const paths = nodeMap.get(node);
                paths.push(feature.id);
                nodeMap.set(node, paths);
            }
        });
    });

    return nodeMap;
}

export const manageRelocatingNodes = () => {
    const transitPaths = serviceLocator.layerManager._layersByName['transitPaths'].source.data;
    const transitNodes = serviceLocator.layerManager._layersByName['transitNodes'].source.data;
    const nodeMap = getCrossingPaths(transitPaths);
    const results = relocateNodes(transitNodes, nodeMap, transitPaths);
};
