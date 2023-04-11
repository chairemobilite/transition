
import serviceLocator from '../../utils/ServiceLocator';
import { lineString, nearestPointOnLine } from '@turf/turf';

export const relocateNodes = (nodeFeatures: any, nodeMap: Map<any, any>, pathFeatures: any) => {
    console.log("Transit Nodes:");
    console.log(nodeFeatures);
    console.log("Transit Paths");
    console.log(pathFeatures);
    console.log("Node Map:");
    console.log(nodeMap);

    const relocatedNodes: any[] = [];
    nodeFeatures.features.forEach(nodeFeature => {
        const nodeId = nodeFeature.properties.id;
        const paths = nodeMap.get(nodeId);
        if (paths && paths.length > 1) {
            const pathCoords = paths.map(pathId => {
                const pathFeature = pathFeatures.features.find(feature => feature.id === pathId);
                return pathFeature.geometry.coordinates;
            });
            const nodeCoords = nodeFeature.geometry.coordinates;
            const closestPoints = findClosestPoints(nodeCoords, pathCoords);
            const middlePoint = findMiddlePoint(closestPoints);
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
    console.log("Relocated Nodes :");
    console.log(relocatedNodes);
    return {
        type: "FeatureCollection",
        features: relocatedNodes
    };
}

  
function areCoordinatesEqual(coords1: number[], coords2: number[]): boolean {
    return coords1[0] === coords2[0] && coords1[1] === coords2[1];
}
  

function findClosestPoints(nodeCoords, pathCoords) {
    const closestPoints = pathCoords.map(path => {
        const line = lineString(path);
        const nearestPoint = nearestPointOnLine(line, nodeCoords);
        return nearestPoint.geometry.coordinates;
    });
    return closestPoints;
}

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

export const manageRelocatingNodes = () => {
    const transitPaths = serviceLocator.layerManager._layersByName['transitPaths'].source.data;
    const transitNodes = serviceLocator.layerManager._layersByName['transitNodes'].source.data; 
    const nodeMap = getCrossingPaths(transitPaths);
    relocateNodes(transitNodes, nodeMap, transitPaths);
}