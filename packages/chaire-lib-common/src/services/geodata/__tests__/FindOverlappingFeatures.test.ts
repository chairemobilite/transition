/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { findOverlappingFeatures, splitOverlappingFeatures } from '../FindOverlappingFeatures';
import GeoJSON from 'geojson';
import { transformTranslate as turfTranslate, polygonToLine as turfPolygonToLine } from '@turf/turf';


const mainFeature: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: {
    type: "Polygon",
    coordinates: [[
            [ -74, 45 ],
            [ -74, 46 ],
            [ -73, 46 ],
            [ -73, 45 ],
            [ -74, 45 ]
        ]]
    }
};

const concavePolygon: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: {
    type: "Polygon",
    coordinates: [[
            [ -74, 45 ],
            [ -74, 46 ],
            [ -73, 46 ],
            [ -73, 45.5],
            [ -73.5, 45.5],
            [ -73.5, 45 ],
            [ -74, 45 ]
        ]]
    }
};

const polygonWithHole = { type: "Feature" as const, properties: {}, geometry: {
    type: "Polygon" as const,
    coordinates: [
        [
            [ -74, 45 ],
            [ -74, 46 ],
            [ -73, 46 ],
            [ -73, 45.5],
            [ -73.5, 45.5],
            [ -73.5, 45 ],
            [ -74, 45 ],
        ], [
            [ -73.7, 45.6 ],
            [ -73.3, 45.7 ],
            [ -73.7, 45.7 ],
            [ -73.7, 45.6 ]
        ]
    ]}
};

test('Test overlapping features', () => {
    const nonOverlappingPoints: GeoJSON.Feature[] = [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-87, 25]}},
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [45, 30]}}
    ];
    expect(findOverlappingFeatures(mainFeature, nonOverlappingPoints).length).toEqual(0);
    expect(findOverlappingFeatures(mainFeature, nonOverlappingPoints, {not : false}).length).toEqual(0);
    expect(findOverlappingFeatures(mainFeature, nonOverlappingPoints, {not : true}).length).toEqual(2);
    const someOverlappingPoints: GeoJSON.Feature[] = [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-73.23, 45.4]}},
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-73, 45]}},
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [45, 30]}}
    ];
    expect(findOverlappingFeatures(mainFeature, someOverlappingPoints).length).toEqual(2);
    expect(findOverlappingFeatures(mainFeature, someOverlappingPoints, {not : false}).length).toEqual(2);
    expect(findOverlappingFeatures(mainFeature, someOverlappingPoints, {not : true}).length).toEqual(1);

});

test('Test split overlapping features', () => {
    // Test on the main feature, with points that really overlap
    const farAwayPoint = { type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [45, 30]}};
    const nonOverlappingPoints: GeoJSON.Feature[] = [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-87, 25]}},
        farAwayPoint];
    const {overlapping, notOverlapping} = splitOverlappingFeatures(mainFeature, nonOverlappingPoints);
    expect(overlapping.length).toEqual(0);
    expect(notOverlapping.length).toEqual(2);

    // Add a point 10 meters within the shape, and another one 5 meters outside, so they are picked up by some buffer
    const northEastPoint = { type: "Feature" as const, properties: { worth: 2 }, geometry: { type: "Point" as const, coordinates: [-73, 46]}};
    // Add a point far from the shape, with another point really close to that faraway point.
    const someOverlappingPoints: GeoJSON.Feature[] = [
        { type: "Feature", properties: { worth: 1 }, geometry: { type: "Point", coordinates: [-73.4, 45.4]}},
        turfTranslate(northEastPoint, 0.015, 210),
        turfTranslate(northEastPoint, 0.005, 0),
        farAwayPoint,
        turfTranslate(farAwayPoint, 0.002, 0)];
    let splitFeatures = splitOverlappingFeatures(mainFeature, someOverlappingPoints);
    expect(splitFeatures.overlapping.length).toEqual(2);
    expect(splitFeatures.notOverlapping.length).toEqual(someOverlappingPoints.length - 2);

    // Test point outside a concave shape, but inside its convex hull
    splitFeatures = splitOverlappingFeatures(concavePolygon, someOverlappingPoints, { expectedApproximateCount: 2, allowConvex: false, allowBuffer: false });
    expect(splitFeatures.overlapping.length).toEqual(1);

    splitFeatures = splitOverlappingFeatures(concavePolygon, someOverlappingPoints, { expectedApproximateCount: 2, allowConvex: true, allowBuffer: false });
    expect(splitFeatures.overlapping.length).toEqual(2);
    // Test with higher count with convex
    splitFeatures = splitOverlappingFeatures(concavePolygon, someOverlappingPoints, { expectedApproximateCount: 3, allowConvex: true, allowBuffer: false });
    expect(splitFeatures.overlapping.length).toEqual(2);

    // Test points outside shape, but within a buffer
    splitFeatures = splitOverlappingFeatures(mainFeature, someOverlappingPoints,  { expectedApproximateCount: 3, allowBuffer: true });
    expect(splitFeatures.overlapping.length).toEqual(3);
    // Add more points outside the zone within some buffer
    const featuresWithBuffer = [...someOverlappingPoints];
    // New point is at same distance as the other outsider, they would be above the count of 3, but under the count of 5
    featuresWithBuffer.push(turfTranslate(turfTranslate(northEastPoint, 0.005, 0), 0.03, 270));
    splitFeatures = splitOverlappingFeatures(mainFeature, featuresWithBuffer,  { expectedApproximateCount: 3, allowBuffer: true });
    expect(splitFeatures.overlapping.length).toEqual(2);
    splitFeatures = splitOverlappingFeatures(mainFeature, featuresWithBuffer,  { expectedApproximateCount: 5, allowBuffer: true });
    expect(splitFeatures.overlapping.length).toEqual(4);
    // Add points closer to the feature and let it be picked up by a lower count
    featuresWithBuffer.push(turfTranslate(turfTranslate(northEastPoint, 0.0045, 0), 0.08, 270));
    splitFeatures = splitOverlappingFeatures(mainFeature, featuresWithBuffer,  { expectedApproximateCount: 3, allowBuffer: true });
    expect(splitFeatures.overlapping.length).toEqual(3);
    splitFeatures = splitOverlappingFeatures(mainFeature, featuresWithBuffer,  { expectedApproximateCount: 5, allowBuffer: true });
    expect(splitFeatures.overlapping.length).toEqual(5);

    // Test buffer and convex points on concave polygon
    splitFeatures = splitOverlappingFeatures(concavePolygon, someOverlappingPoints, { expectedApproximateCount: 3, allowConvex: true, allowBuffer: true });
    expect(splitFeatures.overlapping.length).toEqual(3);

    // Test with expected count and counting method option
    const countWorth = (feature: GeoJSON.Feature) => feature.properties?.worth;
    splitFeatures = splitOverlappingFeatures(mainFeature, someOverlappingPoints,  { expectedApproximateCount: 3, featureCount: countWorth });
    expect(splitFeatures.overlapping.length).toEqual(2);
    splitFeatures = splitOverlappingFeatures(mainFeature, someOverlappingPoints,  { expectedApproximateCount: 6, featureCount: countWorth });
    expect(splitFeatures.overlapping.length).toEqual(3);
});

test('Test overlapping features not points', () => {
    // Have polygons and lines, that crosses, is fully contained and is outside or fully contains
    const overlappingFeatures: GeoJSON.Feature[] = [
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-73.5, 45.1], [-73.5, 44.5]]}},
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-73.5, 45.1], [-73.5, 45.6]]}},
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[45, 30], [46, 31]]}},
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-73.5, 45.5], [-73.5, 46.5], [-72.5, 46.5], [-72.5, 45.5], [-73.5, 45.5]]]}},
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-73.5, 45.1], [-73.5, 45.6], [-73.1, 45.6], [-73.1, 45.1], [-73.5, 45.1]]]}},
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-75, 40], [-75, 47], [-70, 47], [-70, 40], [-75, 40]]]}},
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[45, 30], [46, 31], [47, 31], [46, 30], [45, 30]]]}}];
    let result = findOverlappingFeatures(mainFeature, overlappingFeatures);
    expect(result.length).toEqual(5);
    expect(result).toEqual([overlappingFeatures[0], overlappingFeatures[1], overlappingFeatures[3], overlappingFeatures[4], overlappingFeatures[5]]);
    expect(findOverlappingFeatures(mainFeature, overlappingFeatures, {not : false}).length).toEqual(5);
    result = findOverlappingFeatures(mainFeature, overlappingFeatures, {not : true});
    expect(result.length).toEqual(2);
    expect(result).toEqual([overlappingFeatures[2], overlappingFeatures[6]]);
});

test('Test overlapping features on polygons with holes', () => {
    // Have polygons and lines, that crosses, is fully contained and is outside or fully contains
    const overlappingFeatures: GeoJSON.Feature[] = [
        // Point in polygon
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-73.9, 45.5]}},
        // Point in hole
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-73.6, 45.68]}},
        // Line entirely in hole
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-73.6, 45.68], [-73.6, 45.69]]}},
        // Line passing through hole
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-73.6, 45.3], [-73.6, 45.8]]}}];
    let result = findOverlappingFeatures(polygonWithHole, overlappingFeatures);
    expect(result.length).toEqual(2);
    expect(result).toEqual([overlappingFeatures[0], overlappingFeatures[3]]);
    expect(findOverlappingFeatures(polygonWithHole, overlappingFeatures, {not : false}).length).toEqual(2);
    result = findOverlappingFeatures(polygonWithHole, overlappingFeatures, {not : true});
    expect(result.length).toEqual(2);
    expect(result).toEqual([overlappingFeatures[1], overlappingFeatures[2]]);
});

test('Test overlapping features on multi line strings', () => {
    // Turn the polygon with hole to a multilinestring feature
    const zoneBoundaryLineStrings = turfPolygonToLine(polygonWithHole) as GeoJSON.Feature<GeoJSON.MultiLineString>;
    // Get some points that are not on the boundaries
    const overlappingFeatures: GeoJSON.Feature[] = [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-73.9, 45.5]}},
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-73.6, 45.68]}}
    ];
    let result = findOverlappingFeatures(zoneBoundaryLineStrings, overlappingFeatures);
    expect(result.length).toEqual(0);

    // Add a point on the boundary of the line string
    overlappingFeatures.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: polygonWithHole.geometry.coordinates[0][1] } });
    result = findOverlappingFeatures(zoneBoundaryLineStrings, overlappingFeatures);
    expect(result.length).toEqual(1);
    expect(result).toEqual([overlappingFeatures[2]]);
});