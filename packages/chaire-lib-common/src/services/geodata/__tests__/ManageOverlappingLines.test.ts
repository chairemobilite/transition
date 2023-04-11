/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { manageOverlappingLines, getLinesInView } from '../ManageOverlappingLines';
import GeoJSON from 'geojson';
import { lineOffset, LineString } from "@turf/turf";
import MapboxGL from 'mapbox-gl';

const featureSkeleton: GeoJSON.Feature<LineString> = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: []
    },
    id: 0,
    properties: {}
};

const basicCollection : GeoJSON.FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[0,0], [0,1], [0,2], [0,3], [0,4], [0,5]] 
            },
            id: 1,
            properties: {}
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[1,0], [1,1], [1,2], [1,3], [1,4], [1,5]]
            },
            id: 2,
            properties: {}
        }]
};


test('Test offset with no overlaps', () => {
    const initial = JSON.stringify(basicCollection);
    const offsetCollection = manageOverlappingLines(JSON.parse(initial));
    expect(JSON.stringify(offsetCollection)).toEqual(initial);
});


test('Test offset with basic opposite direction overlap', () => {
    const collection = JSON.parse(JSON.stringify(basicCollection));
    collection.features[1].geometry.coordinates =
        collection.features[1].geometry.coordinates.map((_, index) => [0, index]).reverse();

    const initial = JSON.stringify(collection);
    const offsetCollection = manageOverlappingLines(collection);
    expect(JSON.stringify(offsetCollection)).toEqual(initial);
});


test('Test offset with multiple same length overlaps', () => {
    const collection : GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
    };

    for(let i = 0; i < 4; i++) {
        const feature = JSON.parse(JSON.stringify(featureSkeleton));
        feature.id = i;
        for(let j = 0; j < 5; j++) {
            feature.geometry.coordinates.push([0, j]);
        }
        collection.features.push(feature);
    }

    const expectedOffset: GeoJSON.Feature[] = []
    collection.features.forEach((feature, index) => {
        expectedOffset.push(lineOffset(feature as GeoJSON.Feature<LineString>, 3 * index, { units: 'meters' }))
    })

    const offsetCollection = manageOverlappingLines(collection);

    offsetCollection.features.forEach((feature, i) => {
        expect(JSON.stringify(feature.geometry)).toEqual(JSON.stringify(expectedOffset[i].geometry));
    })
});


test('Test offset with multiple different lengths overlap', () => {
    const collection : GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
    };

    for(let i = 0; i < 4; i++) {
        const feature = JSON.parse(JSON.stringify(featureSkeleton));
        feature.id = i;
        for(let j = 0; j < 4 * i + 3; j++) {
            feature.geometry.coordinates.push([0, j]);
        }
        collection.features.push(feature);
    }

    const initial = JSON.stringify(collection);
    const offsetCollection = manageOverlappingLines(collection);
    // TODO: Add a more specific expect once the expected behaviour is specified
    expect(JSON.stringify(offsetCollection)).not.toEqual(initial);
});


test('Test overlaps between multiple segments of the same line with another line', () => {
    const collection: GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [1, 1], [2, 2], [3, 3]]
                },
                id: 1,
                properties: {}
            },
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[3, 3], [2, 2], [1, 1], [0, 0], [1, 1], [2, 2], [3, 3]]
                },
                id: 2,
                properties: {}
            }
        ]
    };

    const initial = JSON.stringify(collection);
    let offsetCollection = manageOverlappingLines(collection);
    offsetCollection = manageOverlappingLines(collection);
    // Expect not to have an infinite loop in the above calls
    expect(JSON.stringify(offsetCollection)).not.toEqual(initial);
});


test('Test overlaps with duplicate coordinates', () => {
    const collection: GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [0, 1], [0, 1], [0, 2]]
                },
                id: 1,
                properties: {}
            },
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[1, 1],[0, 1],[0, 0]]
                },
                id: 2,
                properties: {}
            }
        ]
    };

    const offsetCollection = manageOverlappingLines(collection);
    offsetCollection.features.forEach((feature) => {
        feature.geometry.coordinates.forEach((coord) => {
            expect(coord[0]).not.toBeNaN();
            expect(coord[1]).not.toBeNaN();
        })
    })
});

test('Test getting lines within the view bounds', () => {
    const collection: GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[0, 0], [0, 1], [0, 1], [2, 2]]
                },
                id: 1,
                properties: {}
            },
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[10, 10],[20, 20],[30, 30]]
                },
                id: 2,
                properties: {}
            },
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[1, 1],[20, 20],[30, 30]]
                },
                id: 3,
                properties: {}
            }
        ]
    };
    const sw = new MapboxGL.LngLat(0, 0);
    const ne = new MapboxGL.LngLat(5, 5);
    const bounds = new MapboxGL.LngLatBounds(sw, ne);

    const linesInView = getLinesInView(bounds, collection);

    expect(linesInView.features.length).toEqual(2);
    expect(linesInView.features[0].id).toEqual(1);
    expect(linesInView.features[1].id).toEqual(3);
});

