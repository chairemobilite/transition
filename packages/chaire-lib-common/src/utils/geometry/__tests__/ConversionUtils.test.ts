/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as ConversionUtils from '../ConversionUtils';

const geojsonPolygon = {
    type: "Polygon" as const,
    coordinates: [
        [
            [
                -73.60878467559814,
                45.507595056660186
            ],
            [
                -73.61337661743164,
                45.50257218991778
            ],
            [
                -73.61286163330078,
                45.50118856706011
            ],
            [
                -73.6088490486145,
                45.50013578775924
            ],
            [
                -73.60419273376465,
                45.501459278555686
            ],
            [
                -73.60236883163452,
                45.50518894887345
            ],
            [
                -73.60367774963379,
                45.50672285447096
            ],
            [
                -73.60878467559814,
                45.507595056660186
            ]
        ]
    ]
};

const geojsonFeatureCollection = {
    type: "FeatureCollection" as const,
    features: [{
        type: "Feature" as const,
        properties: {},
        geometry: {
            type: "Polygon" as const,
            coordinates: [
                [
                    [
                        -73.60878467559814,
                        45.507595056660186
                    ],
                    [
                        -73.61337661743164,
                        45.50257218991778
                    ],
                    [
                        -73.61286163330078,
                        45.50118856706011
                    ],
                    [
                        -73.6088490486145,
                        45.50013578775924
                    ],
                    [
                        -73.60419273376465,
                        45.501459278555686
                    ],
                    [
                        -73.60236883163452,
                        45.50518894887345
                    ],
                    [
                        -73.60367774963379,
                        45.50672285447096
                    ],
                    [
                        -73.60878467559814,
                        45.507595056660186
                    ]
                ]
            ]
        }
    }]
};

const expectedPolyBoundary = "45.507595056660186 -73.60878467559814 45.50257218991778 -73.61337661743164 45.50118856706011 -73.61286163330078 45.50013578775924 -73.6088490486145 45.501459278555686 -73.60419273376465 45.50518894887345 -73.60236883163452 45.50672285447096 -73.60367774963379 45.507595056660186 -73.60878467559814";

test('should convert geojson polygon to poly boundary', function() {

    expect(ConversionUtils.geojsonToPolyBoundary(geojsonPolygon)).toBe(expectedPolyBoundary);
    expect(ConversionUtils.geojsonToPolyBoundary(geojsonFeatureCollection)).toBe(expectedPolyBoundary);
    expect(ConversionUtils.geojsonToPolyBoundary(geojsonFeatureCollection.features[0])).toBe(expectedPolyBoundary);

});

test('metersToPixels', function() {

    expect(ConversionUtils.metersToPixels(10, 0, 15)).toBe(2.093226311045607);
    expect(ConversionUtils.metersToPixels(100, 45, 15)).toBeGreaterThanOrEqual(0);

    // Make sure it accepts negative latitudes
    expect(ConversionUtils.metersToPixels(100, 45, 15)).toBeGreaterThanOrEqual(ConversionUtils.metersToPixels(100, -45, 15));
    expect(ConversionUtils.metersToPixels(10, 200, 3)).toBe(Number.NaN);
   
    // Higher latitudes should cover more pixels than lower ones
    expect(ConversionUtils.metersToPixels(10, 45, 3)).toBeGreaterThan(ConversionUtils.metersToPixels(10, 15, 3));

});
