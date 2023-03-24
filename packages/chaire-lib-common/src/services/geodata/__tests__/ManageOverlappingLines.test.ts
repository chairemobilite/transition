/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { manageOverlappingLines } from '../ManageOverlappingLines';
import GeoJSON from 'geojson';

const featureSqueletton: GeoJSON.Feature = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: []
    },
    id: 0,
    properties: {}
};

const basicCollection : GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [0,0],
                    [0,1],
                    [0,2],
                    [0,3],
                    [0,4],
                    [0,5]
                ] },
            id: 1,
            properties: {}
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [1,0],
                    [1,1],
                    [1,2],
                    [1,3],
                    [1,4],
                    [1,5]
                ] },
            id: 2,
            properties: {}
        }]
};


test('Test offset with no overlaps', () => {
    const initial = JSON.stringify(basicCollection);
    const offsetCollection = manageOverlappingLines(basicCollection);
    expect(JSON.stringify(offsetCollection)).toEqual(initial);
});


test('Test offset with basic overlap', () => {
    const collection = JSON.parse(JSON.stringify(basicCollection));
    collection.features[1].geometry.coordinates =
    collection.features[1].geometry.coordinates.map((val: Array<number>) => [0, val[1]]);

    const initial = JSON.stringify(collection);
    const offsetCollection = manageOverlappingLines(collection);
    expect(JSON.stringify(offsetCollection)).not.toEqual(initial);
});


test('Test offset with basic opposite direction overlap', () => {
    const collection = JSON.parse(JSON.stringify(basicCollection));
    collection.features[1].geometry.coordinates =
        collection.features[1].geometry.coordinates.map((val: Array<number>) => [0, val[1]]).reverse();

    const initial = JSON.stringify(collection);
    const offsetCollection = manageOverlappingLines(collection);
    expect(JSON.stringify(offsetCollection)).toEqual(initial);
});


test('Test offset with multiple same length overlaps', () => {
    const collection : GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: []
    };

    for(let i = 0; i < 4; i++) {
        const feature = JSON.parse(JSON.stringify(featureSqueletton));
        feature.id = i;
        for(let j = 0; j < 5; j++) {
            (feature.geometry as any).coordinates.push([0, j]);
        }
        collection.features.push(feature);
    }

    const initial = JSON.stringify(collection);
    const offsetCollection = manageOverlappingLines(collection);
    expect(JSON.stringify(offsetCollection)).not.toEqual(initial);
});


test('Test offset with multiple different lengths overlap', () => {
    const collection : GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: []
    };

    for(let i = 0; i < 4; i++) {
        const feature = JSON.parse(JSON.stringify(featureSqueletton));
        feature.id = i;
        for(let j = 0; j < 4 * i + 3; j++) {
            (feature.geometry as any).coordinates.push([0, j]);
        }
        collection.features.push(feature);
    }

    const initial = JSON.stringify(collection);
    const offsetCollection = manageOverlappingLines(collection);
    expect(JSON.stringify(offsetCollection)).not.toEqual(initial);
});


test('Test overlaps between multiple segments of the same line with another line', () => {
    const collection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [0, 0],
                        [1, 1],
                        [2, 2],
                        [3, 3]
                    ]
                },
                id: 1,
                properties: {}
            },
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [3, 3],
                        [2, 2],
                        [1, 1],
                        [0, 0],
                        [1, 1],
                        [2, 2],
                        [3, 3]
                    ]
                },
                id: 2,
                properties: {}
            }
        ]
    };

    const initial = JSON.stringify(collection);
    let offsetCollection = manageOverlappingLines(collection);
    offsetCollection = manageOverlappingLines(collection);
    expect(JSON.stringify(offsetCollection)).not.toEqual(initial);
});


test('Test overlaps with duplicate coordinates', () => {
    const collection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [0, 0],
                        [0, 1],
                        [0, 1],
                        [0, 2]
                    ]
                },
                id: 1,
                properties: {}
            },
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                },
                id: 2,
                properties: {}
            }
        ]
    };

    const offsetCollection = manageOverlappingLines(collection);
    expect((offsetCollection.features[0].geometry as any).coordinates[1][0]).not.toBeNaN();
});
