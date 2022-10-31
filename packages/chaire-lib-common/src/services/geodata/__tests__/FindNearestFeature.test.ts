/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { findNearest } from '../FindNearestFeature';
import TestUtils from '../../../test/TestUtils';

test('Find nearest, including self', () => {
    const refPoint = TestUtils.makePoint([-73, 45]);

    const features = [
        TestUtils.makePoint([-73.1, 45.1]),
        refPoint,
        TestUtils.makePoint([-73.2, 45])
    ];

    const nearest = findNearest(refPoint, features) as any;
    expect(nearest.feature).toEqual(refPoint);
    expect(nearest.dist).toEqual(0);
});

test('Find nearest, empty features', () => {
    const refPoint = TestUtils.makePoint([-73, 45]);

    const nearest = findNearest(refPoint, []);
    expect(nearest).toBeUndefined();
});

test('Find nearest, not including self', () => {
    const refPoint = TestUtils.makePoint([-73, 45]);

    // First feature is nearest
    const features = [
        TestUtils.makePoint([-73.1, 45.1]),
        TestUtils.makePoint([-73.15, 45.15]),
        TestUtils.makePoint([-73.16, 45.16]),
    ];

    const nearest = findNearest(refPoint, features) as any;
    expect(nearest.feature).toEqual(features[0]);
    expect(nearest.dist).toBeGreaterThan(0);

    // Last feature is nearest
    const reverseFeatures = features.reverse();
    const nearest2 = findNearest(refPoint, reverseFeatures) as any;
    expect(nearest2.feature).toEqual(reverseFeatures[2]);
    expect(nearest2.dist).toEqual(nearest.dist);
});

test('Find nearest, with max distance > distance', () => {
    const refPoint = TestUtils.makePoint([-73, 45]);

    // First feature is nearest
    const features = [
        TestUtils.makePoint([-73.1, 45.1]),
        TestUtils.makePoint([-73.15, 45.15]),
        TestUtils.makePoint([-73.16, 45.16]),
    ];

    const nearest = findNearest(refPoint, features, { maxDistance: 100000 }) as any;
    expect(nearest.feature).toEqual(features[0]);

});

test('Find nearest, with max distance < distance', () => {
    const refPoint = TestUtils.makePoint([-73, 45]);

    // First feature is nearest
    const features = [
        TestUtils.makePoint([-73.1, 45.1]),
        TestUtils.makePoint([-73.15, 45.15]),
        TestUtils.makePoint([-73.16, 45.16]),
    ];

    const nearest = findNearest(refPoint, features, { maxDistance: 20 });
    expect(nearest).toBeUndefined();

});

test('Find nearest, feature is line', () => {
    const refLine = {
        type: 'Feature' as const,
        geometry: {
            type: 'LineString' as const,
            coordinates: [ [-73, 45], [-74, 45] ]
        },
        properties: {}
    }

    // First feature is nearest
    const features = [
        TestUtils.makePoint([-73.1, 45.1]),
        TestUtils.makePoint([-73.15, 45.15]),
        TestUtils.makePoint([-73.16, 45.16]),
    ];

    const nearest = findNearest(refLine, features) as any;
    expect(nearest.feature).toEqual(features[0]);
    expect(nearest.dist).toBeGreaterThan(0);

    const nearestWithMax = findNearest(refLine, features, { maxDistance: 20 });
    expect(nearestWithMax).toBeUndefined();

    const featureOnLine = [TestUtils.makePoint(refLine.geometry.coordinates[0] as [number, number])]
    const nearestWithFeatureOnLine = findNearest(refLine, featureOnLine, { maxDistance: 20 }) as any;
    expect(nearestWithFeatureOnLine.feature).toEqual(featureOnLine[0]);
    expect(nearestWithFeatureOnLine.dist).toEqual(0);

});

test('Find nearest, feature is polygon', () => {
    const refPolygon = {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [ [ [-73, 45], [-74, 45], [-74, 46], [-73, 46], [-73, 45] ] ]
        },
        properties: {}
    }

    // First feature is nearest
    const features = [
        TestUtils.makePoint([-73.1, 45.1]),
        TestUtils.makePoint([-73.15, 45.15]),
        TestUtils.makePoint([-73.16, 45.16]),
    ];

    const { feature: nearest, dist } = findNearest(refPolygon, features) as any;
    expect(nearest).toEqual(features[0]);
    expect(dist).toBeGreaterThan(0);

    const nearestWithMax = findNearest(refPolygon, features, { maxDistance: 20 });
    expect(nearestWithMax).toBeUndefined();

    const featureOnPolygon = [TestUtils.makePoint(refPolygon.geometry.coordinates[0][0] as [number, number])]
    const { feature: nearestWithFeatureOnPolygon, dist: distOnPolygon } = findNearest(refPolygon, featureOnPolygon, { maxDistance: 20 }) as any;
    expect(nearestWithFeatureOnPolygon).toEqual(featureOnPolygon[0]);
    expect(distOnPolygon).toEqual(0);
});
