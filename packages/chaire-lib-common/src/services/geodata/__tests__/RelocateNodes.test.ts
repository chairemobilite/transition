/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { manageRelocatingNodes } from '../RelocateNodes';
import { LineString, Point } from '@turf/turf';
import _cloneDeep from 'lodash/cloneDeep';

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
                nodes: [0,1,2]
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
                nodes: [0,1,2]
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
                nodes: [0,1,2]
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
                nodes: [0,1]
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
                nodes: [0,1]
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
                // distance within MAX_NODE_RELOCATION_DISTANCE from expected center
                coordinates: [2,2.0004]
            },
            id: 0,
            properties: {
                color:'',
                id: 0
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                // distance within MAX_NODE_RELOCATION_DISTANCE from expected center
                coordinates: [1,2.0004]
            },
            id: 1,
            properties: {
                color:'',
                id: 1
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Point',
                // distance within MAX_NODE_RELOCATION_DISTANCE from expected center
                coordinates: [4,1.0004]
            },
            id: 2,
            properties: {
                color:'',
                id: 2
            }
        }
    ]
};

test('Check that the offset nodes are at the expected middle point', async () => {
    const nodesTest = _cloneDeep(transitNodes);
    await manageRelocatingNodes(nodesTest, _cloneDeep(transitPaths));

    expect(nodesTest.features[0].geometry.coordinates).toEqual([2,2]);
    expect(nodesTest.features[1].geometry.coordinates).toEqual([1,2]);
    expect(nodesTest.features[2].geometry.coordinates).toEqual([4,1]);

});
