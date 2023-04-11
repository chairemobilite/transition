/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { relocateNodes } from '../RelocateNodes';
import GeoJSON, { GeoJsonGeometryTypes } from 'geojson';
import { lineOffset, LineString, Point} from "@turf/turf";

const lineSkeleton: GeoJSON.Feature<LineString> = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: []
    },
    id: 0,
    properties: {
        id: ''
    }
};

const nodeSkeleton: GeoJSON.Feature<Point> = {
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [2,5]
    },
    id: 0,
    properties: {
        nodes: []
    }
}

const transitPaths : GeoJSON.FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,0], [1,0], [2,0], [3,0], [4,0]] 
            },
            id: 1,
            properties: {
                nodes: ['0']
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,1], [1,1], [2,1], [3,1], [4,1]]
            },
            id: 2,
            properties: {
                nodes: ['0']
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,2], [1,2], [2,2], [3,2], [4,2]]
            },
            id: 3,
            properties: {
                nodes: ['0']
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,3], [1,3], [2,3], [3,3], [4,3]]
            },
            id: 4,
            properties: {
                nodes: ['0']
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,4], [1,4], [2,4], [3,4], [4,4]]
            },
            id: 4,
            properties: {
                nodes: ['0']
            }
        }]
};

const transitNodes : GeoJSON.FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [2,5]
            },
            id: 0,
            properties: {
                color:'',
                id:'0'
            }
        }
    ]
};

const nodeMap: Map<string, number[]>[] = [
    new Map([
      ['0', [1, 2, 3, 4]]
    ])
  ];
  
;

test('Test basic relocation of nodes', () => {
    const initialNodes = JSON.stringify(transitNodes);
    const relocatedNode = relocateNodes(transitNodes, nodeMap[0], transitPaths).features[0].geometry.coordinates;
    expect(relocatedNode).toEqual([2,1.5]);
});