/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { offsetOverlappingLines, OFFSET_WIDTH } from '../ManageOverlappingLines';
import { lineOffset, inside, circle, union } from '@turf/turf';
import GeoJSON, { LineString } from 'geojson';
import _cloneDeep from 'lodash.clonedeep';

const featureSkeleton: GeoJSON.Feature = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: []
    },
    id: 0,
    properties: {
        description: ''
    }
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
            properties: {
                description: 'Vertical line'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[1,0], [1,1], [1,2], [1,3], [1,4], [1,5]]
            },
            id: 2,
            properties: {
                description: 'Vertical line'
            }
        }]
};


test('Test offset with no overlaps', async () => {
    const offsetCollection = _cloneDeep(basicCollection);
    await offsetOverlappingLines(offsetCollection);
    expect(offsetCollection).toEqual(basicCollection);
});


test('Test offset with basic opposite direction overlap', async () => {
    const collection = _cloneDeep(basicCollection);
    collection.features[1].geometry.coordinates =
        collection.features[1].geometry.coordinates.map((_, index) => [0, index]).reverse();

    const offsetCollection = _cloneDeep(collection);
    await offsetOverlappingLines(offsetCollection);
    expect(offsetCollection).toEqual(collection);
});


test('Test offset with multiple same length overlaps', async () => {
    const collection : GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
    };

    // Populate the collection with identical lines
    for(let i = 0; i < 4; i++) {
        const feature = _cloneDeep(featureSkeleton) as GeoJSON.Feature<LineString>;
        feature.id = i;
        feature.properties!.description = 'Vertical line of same length';
        for(let j = 0; j < 5; j++) {
            feature.geometry.coordinates.push([0, j]);
        }
        collection.features.push(feature);
    }

    const offsetCollection = _cloneDeep(collection);
    await offsetOverlappingLines(offsetCollection);

    const expectedOffset: GeoJSON.Feature[] = [];
    collection.features.forEach((feature, index) => {
        expectedOffset.push(lineOffset(feature as GeoJSON.Feature<LineString>, OFFSET_WIDTH * index, { units: 'meters' }));
    });

    offsetCollection.features.forEach((feature, i) => {
        expect(feature.geometry).toEqual(expectedOffset[i].geometry);
    });
});


test('Test offset with multiple different lengths overlap', async () => {
    const collection : GeoJSON.FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
    };

    // The lines created have the same origin (0,0) and are all vertical (thus having overlaps).
    // The only difference is their length. Every line created has 4 more coordinates at its end than the previous one.
    for(let i = 0; i < 4; i++) {
        const feature = _cloneDeep(featureSkeleton) as GeoJSON.Feature<LineString>;
        feature.id = i;
        feature.properties!.description = 'Vertical line of different length';
        for(let j = 0; j < 4 * i + 3; j++) {
            feature.geometry.coordinates.push([0, j]);
        }
        collection.features.push(feature);
    }

    const offsetCollection = _cloneDeep(collection);
    await offsetOverlappingLines(offsetCollection);
    // TODO: Add a more specific expect once the expected behaviour is specified
    expect(offsetCollection).not.toEqual(collection);
});


test('Test overlaps between multiple segments of the same line with another line', async () => {
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

    const offsetCollection = _cloneDeep(collection);
    // Expect not to have an infinite loop in these calls
    await offsetOverlappingLines(offsetCollection);
    await offsetOverlappingLines(offsetCollection);

    // Verify line lengths
    collection.features.forEach((feature, i) => {
        expect(offsetCollection.features[i].geometry.coordinates.length).toBe(feature.geometry.coordinates.length);
    });

    // Verify that offsetted coords are within the offset distance
    let polygon = _cloneDeep(featureSkeleton) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    polygon.geometry.type = 'Polygon';
    collection.features[0].geometry.coordinates.forEach((coord) => {
        polygon = union(polygon, (circle(coord, OFFSET_WIDTH + 1, { units: 'meters' })));
    });
    offsetCollection.features[1].geometry.coordinates.forEach((coord) => {
        expect(inside(coord, polygon)).toBeTruthy();
    });
});


test('Test overlaps with duplicate coordinates', async () => {
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

    await offsetOverlappingLines(collection);
    collection.features.forEach((feature) => {
        feature.geometry.coordinates.forEach((coord) => {
            expect(coord[0]).not.toBeNaN();
            expect(coord[1]).not.toBeNaN();
        });
    });
});
