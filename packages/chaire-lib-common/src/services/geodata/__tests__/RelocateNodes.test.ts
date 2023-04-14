/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { relocateNodes } from '../RelocateNodes';
import GeoJSON, { GeoJsonGeometryTypes } from 'geojson';
import { lineOffset, LineString, Point} from "@turf/turf";
import _cloneDeep from 'lodash.clonedeep';

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
                nodes: ['0,1,2']
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
                nodes: ['0,1,2']
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
                nodes: ['0,1,2']
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
                nodes: ['0,1,2']
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,4], [1,4], [2,4], [3,4], [4,4]]
            },
            id: 5,
            properties: {
                nodes: ['0,1,2']
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
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [1,3]
            },
            id: 1,
            properties: {
                color:'',
                id:'1'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [4,2]
            },
            id: 2,
            properties: {
                color:'',
                id:'2'
            }
        }
    ]
};

const nodeMap: Map<string, number[]>[] = [
    new Map([
      ['0', [1, 2, 3, 4, 5]],
      ['1', [1, 2, 3, 4, 5]],
      ['2', [1, 2, 3]]
    ])
  ];

test('Test basic relocation of nodes #1', () => {
    const nodeIndex = 0; 

    const map = _cloneDeep(nodeMap);
    const relocatedNode = relocateNodes(_cloneDeep(transitNodes), map[0], _cloneDeep(transitPaths)).features[nodeIndex].geometry.coordinates;
    
    expect(relocatedNode).toEqual([2,2]);
});

test('Test basic relocation of nodes #2', () => {
    const nodeIndex = 1; 
    const map = _cloneDeep(nodeMap);
    const relocatedNode = relocateNodes(_cloneDeep(transitNodes), map[0], _cloneDeep(transitPaths)).features[nodeIndex].geometry.coordinates;
    
    expect(relocatedNode).toEqual([1,2]);
});

test('Test basic relocation of nodes #3', () => {
    const nodeIndex = 2; 

    const map = _cloneDeep(nodeMap);
    const relocatedNode = relocateNodes(_cloneDeep(transitNodes), map[0], _cloneDeep(transitPaths)).features[nodeIndex].geometry.coordinates;
    
    expect(relocatedNode).toEqual([4,1]);
});