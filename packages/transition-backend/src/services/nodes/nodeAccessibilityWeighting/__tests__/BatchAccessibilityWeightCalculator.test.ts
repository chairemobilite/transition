/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import {
    calculateBatchAccessibilityWeights,
    DEFAULT_BATCH_SIZE,
    getBirdDistanceRadiusMeters,
    getIntrinsicWeight
} from '../BatchAccessibilityWeightCalculator';
import {
    DEFAULT_MAX_WALKING_TIME_SECONDS,
    DEFAULT_DECAY_PARAMETERS,
    DEFAULT_INTRINSIC_WEIGHT,
    DEFAULT_WALKING_SPEED_MPS
} from '../types';
import { NodeWeightingParameters, NodeFeatureForWeighting, NodeAccessibilityWeightCalculatorDependencies } from '../types';
import { IntrinsicWeightedPoint } from 'chaire-lib-common/lib/services/types';

const makeNodeFeature = (id: string, lon: number, lat: number): NodeFeatureForWeighting => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id }
});

const makePoint = (
    lon: number,
    lat: number,
    intrinsicWeight?: number
): IntrinsicWeightedPoint => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { intrinsicWeight }
});

const nodeFeatures: NodeFeatureForWeighting[] = [
    makeNodeFeature('node-a', -73.501, 45.501),
    makeNodeFeature('node-b', -73.502, 45.502),
    makeNodeFeature('node-c', -73.510, 45.510)
];

const defaultParameters: NodeWeightingParameters = {
    maxWalkingTimeSeconds: DEFAULT_MAX_WALKING_TIME_SECONDS,
    decayFunctionParameters: DEFAULT_DECAY_PARAMETERS
};

function makeMockDeps(overrides?: {
    candidateNodesFn?: (point: GeoJSON.Point) => { id: string; distance: number }[];
    manyToManyResult?: {
        durations: (number | null)[][];
        distances: (number | null)[][];
    };
    tableFromResult?: { durations: number[]; distances: number[] };
}): NodeAccessibilityWeightCalculatorDependencies {
    const defaultCandidates = [
        { id: 'node-a', distance: 150 },
        { id: 'node-b', distance: 300 }
    ];

    return {
        routingService: {
            tableManyToMany: jest.fn().mockResolvedValue({
                query: '',
                durations: overrides?.manyToManyResult?.durations ?? [[180, 420], [200, 350]],
                distances: overrides?.manyToManyResult?.distances ?? [[200, 500], [250, 400]]
            }),
            tableFrom: jest.fn().mockResolvedValue({
                query: '',
                durations: overrides?.tableFromResult?.durations ?? [180, 420],
                distances: overrides?.tableFromResult?.distances ?? [200, 500]
            }),
            tableTo: jest.fn(),
            mapMatch: jest.fn(),
            route: jest.fn()
        } as any,
        getNodesInBirdDistanceFromPoint: jest.fn().mockImplementation(
            (_point: GeoJSON.Point) =>
                Promise.resolve(
                    overrides?.candidateNodesFn
                        ? overrides.candidateNodesFn(_point)
                        : defaultCandidates
                )
        )
    };
}

describe('BatchAccessibilityWeightCalculator', () => {
    describe('calculateBatchAccessibilityWeights', () => {
        test('returns empty map when no points are provided', async () => {
            const deps = makeMockDeps();
            const result = await calculateBatchAccessibilityWeights(
                [],
                nodeFeatures,
                defaultParameters,
                deps
            );
            expect(result.size).toBe(0);
            expect(deps.routingService.tableManyToMany).not.toHaveBeenCalled();
        });

        test('returns empty map when no candidates found', async () => {
            const deps = makeMockDeps({ candidateNodesFn: () => [] });
            const points = [makePoint(-73.5, 45.5)];

            const result = await calculateBatchAccessibilityWeights(
                points,
                nodeFeatures,
                defaultParameters,
                deps
            );
            expect(result.size).toBe(0);
        });

        test('accumulates weights from multiple points for same nodes', async () => {
            const points = [makePoint(-73.5, 45.5), makePoint(-73.501, 45.501)];
            const deps = makeMockDeps({
                manyToManyResult: {
                    durations: [[180, 420], [120, 300]],
                    distances: [[200, 500], [150, 350]]
                }
            });

            const result = await calculateBatchAccessibilityWeights(
                points,
                nodeFeatures,
                defaultParameters,
                deps,
                { batchSize: 100 }
            );

            expect(result.size).toBeGreaterThan(0);
            expect(result.has('node-a')).toBe(true);
            const weightA = result.get('node-a')!;
            expect(weightA).toBeGreaterThan(0);
        });

        test('respects intrinsic weight from point properties', async () => {
            const point1 = makePoint(-73.5, 45.5, 1.0);
            const point2 = makePoint(-73.5, 45.5, 3.0);

            const manyToMany = {
                durations: [[300]],
                distances: [[400]]
            };
            const deps1 = makeMockDeps({
                candidateNodesFn: () => [{ id: 'node-a', distance: 100 }],
                manyToManyResult: manyToMany
            });
            const deps2 = makeMockDeps({
                candidateNodesFn: () => [{ id: 'node-a', distance: 100 }],
                manyToManyResult: manyToMany
            });

            const result1 = await calculateBatchAccessibilityWeights(
                [point1], nodeFeatures, defaultParameters, deps1
            );
            const result2 = await calculateBatchAccessibilityWeights(
                [point2], nodeFeatures, defaultParameters, deps2
            );

            const w1 = result1.get('node-a') ?? 0;
            const w2 = result2.get('node-a') ?? 0;
            expect(w2).toBeCloseTo(w1 * 3.0, 10);
        });

        test('calls onProgress callback per batch', async () => {
            const points = Array.from({ length: 5 }, (_, i) =>
                makePoint(-73.5 + i * 0.001, 45.5)
            );
            const deps = makeMockDeps({
                manyToManyResult: {
                    durations: points.map(() => [300, 600]),
                    distances: points.map(() => [400, 700])
                }
            });

            const progressCalls: [number, number][] = [];
            await calculateBatchAccessibilityWeights(
                points,
                nodeFeatures,
                defaultParameters,
                deps,
                {
                    batchSize: 3,
                    onProgress: (done, total) => progressCalls.push([done, total])
                }
            );

            expect(progressCalls).toEqual([
                [3, 5],
                [5, 5]
            ]);
        });

        test('chunks OSRM calls when pairs exceed maxOsrmTablePairs', async () => {
            const points = [makePoint(-73.5, 45.5)];
            const deps = makeMockDeps({
                candidateNodesFn: () => [
                    { id: 'node-a', distance: 100 },
                    { id: 'node-b', distance: 200 }
                ],
                manyToManyResult: {
                    durations: [[300]],
                    distances: [[400]]
                }
            });

            await calculateBatchAccessibilityWeights(
                points,
                nodeFeatures,
                defaultParameters,
                deps,
                { maxOsrmTablePairs: 1 }
            );

            expect(deps.routingService.tableManyToMany).toHaveBeenCalledTimes(2);
        });

        test('excludes nodes beyond maxWalkingTimeSeconds', async () => {
            const points = [makePoint(-73.5, 45.5)];
            const deps = makeMockDeps({
                candidateNodesFn: () => [
                    { id: 'node-a', distance: 100 },
                    { id: 'node-b', distance: 200 }
                ],
                manyToManyResult: {
                    durations: [[300, 9999]],
                    distances: [[400, 15000]]
                }
            });

            const result = await calculateBatchAccessibilityWeights(
                points, nodeFeatures, defaultParameters, deps
            );

            expect(result.has('node-a')).toBe(true);
            expect(result.has('node-b')).toBe(false);
        });

        test('handles null durations/distances from OSRM', async () => {
            const points = [makePoint(-73.5, 45.5)];
            const deps = makeMockDeps({
                candidateNodesFn: () => [
                    { id: 'node-a', distance: 100 },
                    { id: 'node-b', distance: 200 }
                ],
                manyToManyResult: {
                    durations: [[300, null]],
                    distances: [[400, null]]
                }
            });

            const result = await calculateBatchAccessibilityWeights(
                points, nodeFeatures, defaultParameters, deps
            );

            expect(result.has('node-a')).toBe(true);
            expect(result.has('node-b')).toBe(false);
        });

    });

    describe('validation', () => {
        test.each([
            { maxWalkingTimeSeconds: 0, desc: 'zero walking time' },
            { maxWalkingTimeSeconds: -100, desc: 'negative walking time' },
            { maxWalkingTimeSeconds: NaN, desc: 'NaN walking time' }
        ])('throws on invalid parameters: $desc', async ({ maxWalkingTimeSeconds }) => {
            const deps = makeMockDeps();
            const params = { ...defaultParameters, maxWalkingTimeSeconds };
            await expect(
                calculateBatchAccessibilityWeights([makePoint(-73.5, 45.5)], nodeFeatures, params, deps)
            ).rejects.toThrow();
        });

        test('throws on invalid walkingSpeedMps', async () => {
            const deps = makeMockDeps();
            const params = { ...defaultParameters, walkingSpeedMps: -1 };
            await expect(
                calculateBatchAccessibilityWeights([makePoint(-73.5, 45.5)], nodeFeatures, params, deps)
            ).rejects.toThrow();
        });
    });

    test('DEFAULT_BATCH_SIZE is exported and reasonable', () => {
        expect(DEFAULT_BATCH_SIZE).toBeGreaterThan(0);
        expect(DEFAULT_BATCH_SIZE).toBeLessThanOrEqual(1000);
    });
});

describe('getBirdDistanceRadiusMeters', () => {
    it.each([
        [1200, 1.3888888888, 1200 * 1.3888888888],
        [900, 1.0, 900],
        [600, 1.5, 900],
        [DEFAULT_MAX_WALKING_TIME_SECONDS, DEFAULT_WALKING_SPEED_MPS, DEFAULT_MAX_WALKING_TIME_SECONDS * DEFAULT_WALKING_SPEED_MPS]
    ])(
        'for maxWalkingTimeSeconds=%d and walkingSpeedMps=%f, returns %f meters',
        (maxTime, speed, expected) => {
            expect(getBirdDistanceRadiusMeters(maxTime, speed)).toBeCloseTo(expected, 4);
        }
    );
});

describe('getIntrinsicWeight', () => {
    it.each([
        ['valid weight', 2.5, 2.5],
        ['weight of 1', 1.0, 1.0],
        ['large weight', 100, 100]
    ])(
        'returns the property value when %s is provided',
        (_label, weight, expected) => {
            const point = makePoint(-73.5, 45.5, weight);
            expect(getIntrinsicWeight(point)).toBe(expected);
        }
    );

    it.each([
        ['undefined', undefined],
        ['zero', 0],
        ['negative', -1],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['negative Infinity', -Infinity]
    ])(
        'returns DEFAULT_INTRINSIC_WEIGHT when weight is %s',
        (_label, weight) => {
            const point = makePoint(-73.5, 45.5, weight as number | undefined);
            expect(getIntrinsicWeight(point)).toBe(DEFAULT_INTRINSIC_WEIGHT);
        }
    );

    it('extracts intrinsicWeight correctly when extra properties are present', () => {
        const point: IntrinsicWeightedPoint = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-73.5, 45.5] },
            properties: {
                intrinsicWeight: 5.0,
                name: 'Central Hospital',
                category: 'health',
                osmId: 123456
            }
        };
        expect(getIntrinsicWeight(point)).toBe(5.0);
    });

    it('returns DEFAULT_INTRINSIC_WEIGHT when extra properties exist but intrinsicWeight is missing', () => {
        const point: IntrinsicWeightedPoint = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-73.5, 45.5] },
            properties: {
                name: 'Park',
                area_sqm: 5000
            }
        };
        expect(getIntrinsicWeight(point)).toBe(DEFAULT_INTRINSIC_WEIGHT);
    });
});
