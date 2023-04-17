/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { lineString, nearestPointOnLine, Feature, Polygon, booleanPointInPolygon, Position } from '@turf/turf';
import { LineString, Point } from 'geojson';

export const getNodesInView = (
    bounds: Feature<Polygon>,
    layer: GeoJSON.FeatureCollection<Point>
): GeoJSON.FeatureCollection<Point> => {
    const features = layer.features;
    const nodesInView: GeoJSON.FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
    for (let i = 0; i < features.length; i++) {
        if (isInBounds(bounds, features[i].geometry.coordinates)) {
            nodesInView.features.push(features[i]);
        }
    }
    return nodesInView;
};

const isInBounds = (bounds: Feature<Polygon>, coord: number[]) : boolean => {
    return booleanPointInPolygon(coord, bounds);
};

/**
Relocates nodes to the middle point of their crossing paths, if they intersect more than one path.
@param nodeFeatures - a FeatureCollection of nodes. (will be modified)
@param nodeMap - a Map of node IDs to arrays of path IDs that intersect the node.
@param pathFeatures - a FeatureCollection of paths.
*/
const relocateNodes = async (
    nodeFeatures: GeoJSON.FeatureCollection<Point>, 
    nodeMap: Map<String, Number[]>, 
    pathFeatures: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        if (isCancelled && isCancelled()) {
            reject('Cancelled');
            return;
        }

        // Loop through each node feature in the input of the transit nodes array
        //nodeFeatures.features.forEach((nodeFeature, i) => {
        for (let i = 0; i < nodeFeatures.features.length; i++) {
            if (i % 20 === 0) {
                if (isCancelled && isCancelled()) {
                    reject('Cancelled');
                    return;
                }
            }

            // Get the ID of the current node.
            const nodeId = nodeFeatures.features[i].properties?.id;

            // Get an array of the path IDs that intersect the current node.
            const paths = nodeMap.get(nodeId);

            // If the node intersects more than one path, find the middle point of the intersecting paths and relocate the node to that point.
            if (paths && paths.length > 1) {
                // Get an array of the coordinates of each path that intersects the node.
                const pathCoords = paths.map((pathId) => {
                    const pathFeature = pathFeatures.features.find((feature) => feature.id === pathId);
                    return pathFeature?.geometry.coordinates;
                });

                // Get the coordinates of the current node.
                const nodeCoords = nodeFeatures.features[i].geometry.coordinates;

                // Find the closest point on each path to the current node.
                const closestPoints = findClosestPoints(nodeCoords, pathCoords);

                // Find the middle point of the closest point
                const middlePoint = findMiddlePoint(closestPoints);
                nodeFeatures.features[i].geometry.coordinates = middlePoint;
            }
        }
        resolve();
    });
};

/**
 * Finds the point on each path that is closest to the given node.
 * @param nodeCoords - an array of two coordinates in the format [longitude, latitude] representing the coordinates of a node.
 * @param pathCoords - an array of arrays, where each inner array represents the coordinates of a path in the format [[longitude1, latitude1], [longitude2, latitude2], ...].
 * @returns an array of arrays, where each inner array represents the coordinates of the point on the corresponding path that is closest to the node.
 */
function findClosestPoints(nodeCoords, pathCoords) : Position[]{
    const closestPoints = pathCoords.map((path) => {
        const line = lineString(path);
        const nearestPoint = nearestPointOnLine(line, nodeCoords);
        return nearestPoint.geometry.coordinates;
    });
    return closestPoints;
}

/**
 * Finds the middle point of an array of points.
 * @param points - an array of arrays, where each inner array represents a point in the format [longitude, latitude].
 * @returns an array representing the coordinates of the middle point of the input points.
 */
function findMiddlePoint(points) : Position {
    const numPoints = points.length;
    const xCoords = points.map((point) => point[0]);
    const yCoords = points.map((point) => point[1]);
    const xSum = xCoords.reduce((sum, coord) => sum + coord, 0);
    const ySum = yCoords.reduce((sum, coord) => sum + coord, 0);
    const xMiddle = xSum / numPoints;
    const yMiddle = ySum / numPoints;
    return [xMiddle, yMiddle];
}

/**
 * Generates a Map object with the node IDs as keys and arrays of path IDs that intersect each node as values.
 * @param featureCollection - a GeoJSON FeatureCollection representing the transit paths.
 * @returns a Map object with the node IDs as keys and arrays of path IDs that intersect each node as values.
 */
function getCrossingPaths(featureCollection) : Map<String, Number[]> {
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

/**
 * Orchestrates the relocation of nodes by calling the relocateNodes function with the necessary parameters.
 * @param transitNodes - a Points feature collection giving a reference to the correct nodes layer (will be modified)
 * @param transitPath - a LineString feature collection giving a reference to the correct paths layer
 */
export const manageRelocatingNodes = async (
    transitNodes: GeoJSON.FeatureCollection<Point>,
    transitPaths: GeoJSON.FeatureCollection<LineString>,
    isCancelled: (() => boolean) | false = false
): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        try {
            const nodeMap = getCrossingPaths(transitPaths);
            await relocateNodes(transitNodes, nodeMap, transitPaths, isCancelled);
            resolve();
        } catch(e) {
            reject(e);
        }
    });
};
