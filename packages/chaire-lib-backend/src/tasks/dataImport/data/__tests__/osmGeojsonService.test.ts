/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import osmGeojsonService from '../osmGeojsonService';
import { DataGeojson } from '../dataGeojson';
import TestUtils from 'chaire-lib-common/lib/test/TestUtils';

test('isRetirementHome', () => {
    expect(osmGeojsonService.isRetirementHome({})).toBe(false);
    expect(osmGeojsonService.isRetirementHome({'amenity': 'parking'})).toBe(false);
    expect(osmGeojsonService.isRetirementHome({'amenity': 'retirement_home'})).toBe(true);
    expect(osmGeojsonService.isRetirementHome({'amenity': 'parking;retirement_home'})).toBe(true);
    expect(osmGeojsonService.isRetirementHome({'amenity': 'parking;social_facility'})).toBe(false);
    expect(osmGeojsonService.isRetirementHome({'amenity': 'social_facility', 'social_facility:for': 'children'})).toBe(false);
    expect(osmGeojsonService.isRetirementHome({'amenity': 'social_facility', 'social_facility:for': 'senior'})).toBe(true);
});

describe('getGeojsonsFromRawData', () => {
    const geojson = {
        type: 'FeatureCollection' as const,
        features: [
            {
                id: 'way/1234',
                type: 'Feature' as const,
                geometry: TestUtils.makePoint([-73, 45]),
                properties: { id: 'way/1234' }
            },
            {
                id: 'way/2345',
                type: 'Feature' as const,
                geometry: TestUtils.makePoint([-73.1, 45.1]),
                properties: { id: 'way/2345' }
            },
            {
                id: 'way/3456',
                type: 'Feature' as const,
                geometry: TestUtils.makePoint([-73.2, 45.2]),
                properties: { id: 'way/3456' }
            }
        ]
    };
    const geojsonData = new DataGeojson(geojson as any);

    test('one existing feature', () => {
        const rawData = [
            { type: 'way' as const, id: '1234' },
        ]
        expect(osmGeojsonService.getGeojsonsFromRawData(geojsonData, rawData)).toEqual([
            { geojson: geojson.features[0], raw: rawData[0] }
        ]);
    });

    test('2 features', () => {
        const rawData = [
            { type: 'way' as const, id: '1234' },
            { type: 'way' as const, id: '2345' },
        ]
        expect(osmGeojsonService.getGeojsonsFromRawData(geojsonData, rawData)).toEqual([
            { geojson: geojson.features[0], raw: rawData[0] },
            { geojson: geojson.features[1], raw: rawData[1] }
        ]);
    });

    test('unexisting feature', () => {
        const rawData = [
            { type: 'way' as const, id: '1234' },
            { type: 'way' as const, id: '1111' },
        ]
        let exception: any = undefined;
        try {
            osmGeojsonService.getGeojsonsFromRawData(geojsonData, rawData)
        } catch(error) {
            exception = error;
        }
        expect(exception).toBeDefined();
    });

    test('unexisting node feature, but requesting generation', () => {
        const rawData = [
            { type: 'node' as const, id: '1234', lon: -73, lat: 45 },
            { type: 'node' as const, id: '2345', lon: -73.1, lat: 45.1, tags: { test: ['foo'], abc: ['foo', 'bar'] } }
        ]
        expect(osmGeojsonService.getGeojsonsFromRawData(geojsonData, rawData, { generateNodesIfNotFound: true, continueOnMissingGeojson: false })).toEqual([
            {
                geojson:
                {
                    type: 'Feature' as const,
                    properties: {},
                    id: `${rawData[0].type}/${rawData[0].id}`,
                    geometry: { type: 'Point' as const, coordinates: [ rawData[0].lon, rawData[0].lat ]}
                },
                raw: rawData[0]
            },
            {
                geojson:
                {
                    type: 'Feature' as const,
                    properties: {
                        test: 'foo',
                        abc: 'foo;bar'
                    },
                    id: `${rawData[1].type}/${rawData[1].id}`,
                    geometry: { type: 'Point' as const, coordinates: [ rawData[1].lon, rawData[1].lat ]}
                },
                raw: rawData[1]
            }
        ]);
    });

});
