
import serviceLocator from '../../utils/ServiceLocator';
import { lineString, nearestPointOnLine } from '@turf/turf';
import { LineString, Point } from 'geojson';

/** 
Relocates nodes to the middle point of their crossing paths, if they intersect more than one path.
@param nodeFeatures - a FeatureCollection of nodes.
@param nodeMap - a Map of node IDs to arrays of path IDs that intersect the node.
@param pathFeatures - a FeatureCollection of paths.
@returns a FeatureCollection of relocated nodes.
*/
export const relocateNodes = (nodeFeatures: any, nodeMap: Map<any, any>, pathFeatures: any) => {
    // Initialize an array for the relocated nodes
    const relocatedNodes: any[] = [];

    // Loop through each node feature in the input of the transit nodes array
    nodeFeatures.features.forEach(nodeFeature => {
        // Get the ID of the current node.
        const nodeId = nodeFeature.properties.id;

        // Get an array of the path IDs that intersect the current node.
        const paths = nodeMap.get(nodeId);

        // If the node intersects more than one path, find the middle point of the intersecting paths and relocate the node to that point. 
        if (paths && paths.length > 1) {
            // Get an array of the coordinates of each path that intersects the node. 
            const pathCoords = paths.map(pathId => {
                const pathFeature = pathFeatures.features.find(feature => feature.id === pathId);
                return pathFeature.geometry.coordinates;
            });

            // Get the coordinates of the current node. 
            const nodeCoords = nodeFeature.geometry.coordinates;

            // Find the closest point on each path to the current node.
            const closestPoints = findClosestPoints(nodeCoords, pathCoords);
            
            // Find the middle point of the closest point
            const middlePoint = findMiddlePoint(closestPoints);

            // Create a modified node feature with the new coordinates and update the nodeFeatures array.
            const modifiedNode = {
                type: "Feature",
                id: nodeFeature.id,
                geometry: {
                    type: "Point",
                    coordinates: middlePoint
                },
                properties: {
                    id: nodeId,
                    color: "#ff0000"
                }
            };

            // Only add the modified node to the relocatedNodes array and update the nodeFeatures array if the coordinates are different from the old coordinates.
            if (!areCoordinatesEqual(modifiedNode.geometry.coordinates, nodeFeature.geometry.coordinates)) {
                for(let i = 0 ; i < nodeFeatures.features.length ; i++){
                    if(nodeFeatures.features[i].properties.id == nodeId){
                        // serviceLocator.layerManager._layersByName['transitNodes'].source.data.features[i] = modifiedNode;
                        nodeFeatures.features[i] = modifiedNode;
                    }
                }            
                relocatedNodes.push(modifiedNode);
            }
        }
    });
    return {
        type: "FeatureCollection",
        features: relocatedNodes
    };
}

  
/**
 * Checks if two sets of coordinates are equal.
 * @param coords1 - an array of two coordinates in the format [longitude, latitude].
 * @param coords2 - an array of two coordinates in the format [longitude, latitude].
 * @returns true if the coordinates are equal, false otherwise.
 */
function areCoordinatesEqual(coords1: number[], coords2: number[]): boolean {
    return coords1[0] === coords2[0] && coords1[1] === coords2[1];
}
  
/**
 * Finds the point on each path that is closest to the given node.
 * @param nodeCoords - an array of two coordinates in the format [longitude, latitude] representing the coordinates of a node.
 * @param pathCoords - an array of arrays, where each inner array represents the coordinates of a path in the format [[longitude1, latitude1], [longitude2, latitude2], ...].
 * @returns an array of arrays, where each inner array represents the coordinates of the point on the corresponding path that is closest to the node.
 */
function findClosestPoints(nodeCoords, pathCoords) {
    const closestPoints = pathCoords.map(path => {
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
function findMiddlePoint(points) {
    const numPoints = points.length;
    const xCoords = points.map(point => point[0]);
    const yCoords = points.map(point => point[1]);
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
function getCrossingPaths(featureCollection) {
    const nodeMap = new Map();
    
    featureCollection.features.forEach(feature => {
        const nodes = feature.properties.nodes;
        nodes.forEach(node => {
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
 * @param transitPath - a LineString feature collection giving a reference to the correct paths layer
 * @param transitNodes - a Points feature collection giving a reference to the correct nodes layer
 */
export const manageRelocatingNodes = (transitPaths: GeoJSON.FeatureCollection<LineString>, transitNodes: GeoJSON.FeatureCollection<Point> ) => {
    const nodeMap = getCrossingPaths(transitPaths);
    relocateNodes(transitNodes, nodeMap, transitPaths);
}