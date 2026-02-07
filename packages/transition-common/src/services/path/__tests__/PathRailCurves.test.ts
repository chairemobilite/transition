/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { LineString, Position } from 'geojson';
import {
    calculateCircumradius,
    calculateTurningAngle,
    estimateMaxSpeedFromRadius,
    calculateRadiiAtVertices
} from '../railCurves/geometry';
import { segmentPathByCurvature, analyzeCurveRadius, analyzePathRailCurveRadius } from '../railCurves/curvatureAnalysis';
import { calculateSpeedProfile } from '../railCurves/speedProfile';
import type { CurveRadiusOptions } from '../railCurves/types';

describe('PathRailCurveRadiusUtils', () => {
    describe('calculateCircumradius', () => {
        test.each([
            {
                name: 'perfect right angle (90°)',
                // Right angle at origin: forms a quarter circle
                p1: [0, 0] as Position,
                p2: [0.001, 0] as Position, // ~111m east
                p3: [0.001, 0.001] as Position, // ~111m north of p2
                expectedRadiusApprox: 78, // ~half diagonal of square
                tolerance: 15
            },
            {
                name: 'wide curve (nearly straight)',
                p1: [0, 0] as Position,
                p2: [0.01, 0.0001] as Position, // slight deviation
                p3: [0.02, 0] as Position,
                expectedRadiusApprox: 55000, // very large radius for nearly straight
                tolerance: 10000
            },
            {
                name: 'tight curve',
                // Tight 90° turn
                p1: [6.1, 46.2] as Position, // Geneva area
                p2: [6.1005, 46.2] as Position, // ~40m east
                p3: [6.1005, 46.2004] as Position, // ~44m north
                expectedRadiusApprox: 30, // tight curve
                tolerance: 20
            }
        ])('should calculate radius for $name', ({ p1, p2, p3, expectedRadiusApprox, tolerance }) => {
            const radius = calculateCircumradius(p1, p2, p3);
            expect(radius).not.toBeNull();
            expect(radius).toBeGreaterThan(expectedRadiusApprox - tolerance);
            expect(radius).toBeLessThan(expectedRadiusApprox + tolerance);
        });

        test('should return null for collinear points', () => {
            const p1: Position = [0, 0];
            const p2: Position = [0.001, 0];
            const p3: Position = [0.002, 0];

            const radius = calculateCircumradius(p1, p2, p3);
            expect(radius).toBeNull();
        });

        test('should return null for coincident points', () => {
            const p1: Position = [0, 0];
            const p2: Position = [0, 0];
            const p3: Position = [0.001, 0];

            const radius = calculateCircumradius(p1, p2, p3);
            expect(radius).toBeNull();
        });
    });

    describe('calculateTurningAngle', () => {
        test('should return 0 for straight line', () => {
            const p1: Position = [0, 0];
            const p2: Position = [0.001, 0];
            const p3: Position = [0.002, 0];

            const angle = calculateTurningAngle(p1, p2, p3);
            expect(angle).toBeCloseTo(0, 5);
        });

        test('should return ~PI/2 for 90° turn', () => {
            const p1: Position = [0, 0];
            const p2: Position = [0.001, 0];
            const p3: Position = [0.001, 0.001];

            const angle = calculateTurningAngle(p1, p2, p3);
            expect(angle).toBeCloseTo(Math.PI / 2, 1);
        });
    });

    describe('estimateMaxSpeedFromRadius', () => {
        test.each([
            // rail mode: coefficient 3.8
            { mode: 'rail' as const, radius: 100, expected: 38 },
            { mode: 'rail' as const, radius: 400, expected: 76 },
            { mode: 'rail' as const, radius: 1000, expected: 120 },
            // tram mode: coefficient 2.9
            { mode: 'tram' as const, radius: 100, expected: 29 },
            { mode: 'tram' as const, radius: 400, expected: 58 },
            // highSpeedRail mode: coefficient 4.2
            { mode: 'highSpeedRail' as const, radius: 1000, expected: 133 },
            { mode: 'highSpeedRail' as const, radius: 2500, expected: 210 },
            // metro mode: coefficient 3.8 (same as rail)
            { mode: 'metro' as const, radius: 400, expected: 76 },
            // tramTrain mode: coefficient 3.35
            { mode: 'tramTrain' as const, radius: 100, expected: 34 }
        ])('should estimate $expected km/h for $mode with radius $radius m', ({ mode, radius, expected }) => {
            const speed = estimateMaxSpeedFromRadius(mode, radius);
            expect(speed).toBe(expected);
        });

        test('should return 0 for invalid radius', () => {
            expect(estimateMaxSpeedFromRadius('rail', 0)).toBe(0);
            expect(estimateMaxSpeedFromRadius('rail', -100)).toBe(0);
        });
    });

    describe('calculateRadiiAtVertices', () => {
        test('should return nulls for path with less than 3 points', () => {
            const coords: Position[] = [
                [0, 0],
                [0.001, 0]
            ];
            const radii = calculateRadiiAtVertices(coords);
            expect(radii).toEqual([null, null]);
        });

        test('should return null for endpoints', () => {
            const coords: Position[] = [
                [0, 0],
                [0.001, 0],
                [0.002, 0.001],
                [0.003, 0.001]
            ];
            const radii = calculateRadiiAtVertices(coords);
            expect(radii[0]).toBeNull();
            expect(radii[radii.length - 1]).toBeNull();
        });

        test('should calculate radii for middle vertices', () => {
            // Create a gentle curve
            const coords: Position[] = [
                [6.1, 46.2],
                [6.102, 46.201],
                [6.104, 46.201],
                [6.106, 46.202],
                [6.108, 46.202]
            ];
            const radii = calculateRadiiAtVertices(coords);

            // Should have values for middle points
            expect(radii[1]).not.toBeNull();
            expect(radii[2]).not.toBeNull();
            expect(radii[3]).not.toBeNull();

            // Radii should be positive
            radii.filter((r) => r !== null).forEach((r) => {
                expect(r).toBeGreaterThan(0);
            });
        });

        test('should clamp radii to min/max thresholds', () => {
            const coords: Position[] = [
                [6.1, 46.2],
                [6.1001, 46.2], // very tight curve
                [6.1001, 46.2001],
                [6.1, 46.2001]
            ];

            const options: CurveRadiusOptions = {
                minPlausibleRadiusMeters: 100,
                maxRadiusMeters: 5000
            };

            const radii = calculateRadiiAtVertices(coords, options);

            radii.filter((r) => r !== null).forEach((r) => {
                expect(r).toBeGreaterThanOrEqual(100);
                expect(r).toBeLessThanOrEqual(5000);
            });
        });

        test('should use stride option for noisy data', () => {
            // Create a path with some "noise"
            const coords: Position[] = [
                [6.1, 46.2],
                [6.101, 46.2005], // noise
                [6.102, 46.201],
                [6.103, 46.2015], // noise
                [6.104, 46.202],
                [6.105, 46.2025], // noise
                [6.106, 46.203]
            ];

            // With stride=2, should skip the noisy intermediate points
            const radiiStride2 = calculateRadiiAtVertices(coords, { stride: 2 });

            // Middle points should have values
            expect(radiiStride2[2]).not.toBeNull();
            expect(radiiStride2[3]).not.toBeNull();
            expect(radiiStride2[4]).not.toBeNull();
        });
    });

    describe('segmentPathByCurvature', () => {
        test('should identify curve and straight segments', () => {
            // Create a path: straight -> curve -> straight
            const coords: Position[] = [
                // Straight section
                [6.1, 46.2],
                [6.11, 46.2],
                [6.12, 46.2],
                // Curve section (90° turn)
                [6.13, 46.2],
                [6.135, 46.201],
                [6.14, 46.205],
                [6.14, 46.21],
                // Straight section
                [6.14, 46.22],
                [6.14, 46.23]
            ];

            const radii = calculateRadiiAtVertices(coords);
            const segments = segmentPathByCurvature(coords, radii, {
                straightThresholdMeters: 2000,
                minCurvePoints: 1
            });

            expect(segments.length).toBeGreaterThan(0);

            // Each segment should have valid properties
            segments.forEach((segment) => {
                expect(segment.startIndex).toBeGreaterThanOrEqual(0);
                expect(segment.endIndex).toBeGreaterThanOrEqual(segment.startIndex);
                expect(segment.lengthMeters).toBeGreaterThanOrEqual(0);
                expect(segment.type).toMatch(/^(curve|straight)$/);
            });
        });

        test('should return empty array for single point', () => {
            const coords: Position[] = [[6.1, 46.2]];
            const radii: (number | null)[] = [null];
            const segments = segmentPathByCurvature(coords, radii);
            expect(segments).toEqual([]);
        });
    });

    describe('analyzeCurveRadius', () => {
        // Realistic rail path geometry (Geneva area from the image)
        const railPathGeometry: LineString = {
            type: 'LineString',
            coordinates: [
                [6.1261, 46.1915], // Lancy-Bachet
                [6.1259, 46.1925],
                [6.1257, 46.1940],
                [6.1255, 46.1955], // Start of curve
                [6.1250, 46.1970],
                [6.1243, 46.1985],
                [6.1235, 46.2000], // Mid curve
                [6.1228, 46.2012],
                [6.1222, 46.2025],
                [6.1220, 46.2040], // End of curve
                [6.1220, 46.2055],
                [6.1220, 46.2070],
                [6.1220, 46.2085] // Straight section
            ]
        };

        test('should return complete analysis for valid geometry', () => {
            const analysis = analyzeCurveRadius(railPathGeometry);

            expect(analysis).toBeDefined();
            expect(analysis.radiiAtVertices).toHaveLength(railPathGeometry.coordinates.length);
            expect(analysis.segments.length).toBeGreaterThan(0);
            expect(analysis.statistics).toBeDefined();
            expect(analysis.statistics.minRadiusMeters).not.toBeNull();
            expect(analysis.statistics.suggestedMaxSpeedKmH).not.toBeNull();
        });

        test('should identify curve sections with realistic radii', () => {
            const analysis = analyzeCurveRadius(railPathGeometry, {
                straightThresholdMeters: 2000
            });

            const curveSegments = analysis.segments.filter((s) => s.type === 'curve');

            // Should find at least one curve
            expect(curveSegments.length).toBeGreaterThanOrEqual(1);
            // If curves found, radii should be realistic for rail
            curveSegments.forEach((curve) => {
                expect(curve.minRadiusMeters).toBeGreaterThan(0);
            });
        });

        test('should calculate meaningful statistics', () => {
            const analysis = analyzeCurveRadius(railPathGeometry);

            // Total length should be sum of segment lengths
            const totalSegmentLength = analysis.segments.reduce((sum, s) => sum + s.lengthMeters, 0);
            const statsTotal =
                analysis.statistics.totalCurveLengthMeters + analysis.statistics.totalStraightLengthMeters;

            expect(Math.abs(totalSegmentLength - statsTotal)).toBeLessThan(1); // within 1m
        });

        test('should handle custom options with different modes', () => {
            // Use a generous straight threshold so the coarse test geometry
            // produces at least one curve segment for both modes.
            const sharedOptions = {
                straightThresholdMeters: 2000,
                minPlausibleRadiusMeters: 50
            };

            const tramAnalysis = analyzeCurveRadius(railPathGeometry, {
                ...sharedOptions,
                mode: 'tram'
            });
            const railAnalysis = analyzeCurveRadius(railPathGeometry, {
                ...sharedOptions,
                mode: 'rail'
            });

            // Tram coefficient (2.9) vs rail coefficient (3.8) = ~76% of rail speed
            expect(tramAnalysis.statistics.suggestedMaxSpeedKmH).not.toBeNull();
            expect(railAnalysis.statistics.suggestedMaxSpeedKmH).not.toBeNull();
            expect(tramAnalysis.statistics.suggestedMaxSpeedKmH!).toBeLessThan(
                railAnalysis.statistics.suggestedMaxSpeedKmH!
            );
        });
    });

    describe('analyzePathRailCurveRadius', () => {
        test('should return null for path without geography', () => {
            const path = { attributes: {} };
            const result = analyzePathRailCurveRadius(path);
            expect(result).toBeNull();
        });

        test('should return null for path with too few coordinates', () => {
            const path = {
                attributes: {
                    geography: {
                        type: 'LineString' as const,
                        coordinates: [
                            [6.1, 46.2],
                            [6.2, 46.2]
                        ]
                    }
                }
            };
            const result = analyzePathRailCurveRadius(path);
            expect(result).toBeNull();
        });

        test('should analyze path with valid geography', () => {
            const path = {
                attributes: {
                    geography: {
                        type: 'LineString' as const,
                        coordinates: [
                            [6.1, 46.2],
                            [6.11, 46.21],
                            [6.12, 46.21],
                            [6.13, 46.22]
                        ]
                    }
                }
            };

            const result = analyzePathRailCurveRadius(path);
            expect(result).not.toBeNull();
            expect(result?.radiiAtVertices).toHaveLength(4);
            expect(result?.segments.length).toBeGreaterThan(0);
        });
    });

    describe('calculateSpeedProfile', () => {
        test('should handle acceleration and deceleration at curve transitions', () => {
            // Create a path with: straight -> tight curve -> straight
            const geometry: LineString = {
                type: 'LineString',
                coordinates: [
                    [6.1, 46.2], // Start
                    [6.11, 46.2], // Straight section
                    [6.12, 46.2], // Approaching curve
                    [6.125, 46.201], // Start of tight curve
                    [6.13, 46.205], // Mid curve (tightest point)
                    [6.135, 46.21], // Exit curve
                    [6.14, 46.21], // Straight after curve
                    [6.15, 46.21] // End
                ]
            };

            const result = calculateSpeedProfile(geometry, {
                mode: 'rail',
                maxSpeedKmH: 100,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0,
                accelerationMps2: 0.5,
                decelerationMps2: 0.8
            });

            expect(result.speedPoints.length).toBe(8);

            // Speed should start at 0
            expect(result.speedPoints[0].achievableSpeedKmH).toBe(0);

            // Speed should end at 0
            expect(result.speedPoints[7].achievableSpeedKmH).toBe(0);

            // Should have braking zones detected
            expect(result.brakingZones.length).toBeGreaterThan(0);

            // Speed profile should show acceleration then deceleration pattern
            // Middle points should have positive speeds
            const middleSpeeds = result.speedPoints.slice(1, -1).map((p) => p.achievableSpeedKmH);
            expect(middleSpeeds.some((s) => s > 0)).toBe(true);
        });

        test('should respect curve speed limits during transitions', () => {
            // Simple path with a known tight curve in the middle
            const geometry: LineString = {
                type: 'LineString',
                coordinates: [
                    [6.1, 46.2],
                    [6.105, 46.2],
                    [6.1055, 46.2005], // Tight 90° turn
                    [6.106, 46.201],
                    [6.106, 46.206]
                ]
            };

            const result = calculateSpeedProfile(geometry, {
                mode: 'rail',
                maxSpeedKmH: 100,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0
            });

            // The achievable speed should always be <= maxSpeedByRadius at each point
            for (const point of result.speedPoints) {
                expect(point.achievableSpeedKmH).toBeLessThanOrEqual(point.maxSpeedByRadiusKmH + 1); // +1 for rounding
            }
        });

        test('should track braking and acceleration states', () => {
            const geometry: LineString = {
                type: 'LineString',
                coordinates: [
                    [6.1, 46.2],
                    [6.12, 46.2],
                    [6.14, 46.2],
                    [6.16, 46.2]
                ]
            };

            const result = calculateSpeedProfile(geometry, {
                mode: 'rail',
                maxSpeedKmH: 80,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0
            });

            // First point: not accelerating (starting)
            expect(result.speedPoints[0].isAccelerating).toBe(false);
            expect(result.speedPoints[0].isBraking).toBe(false);

            // Should have some accelerating points after start
            const hasAccelerating = result.speedPoints.some((p) => p.isAccelerating);
            expect(hasAccelerating).toBe(true);

            // Should have some braking points before end
            const hasBraking = result.speedPoints.some((p) => p.isBraking);
            expect(hasBraking).toBe(true);
        });

        test('should use minFallbackSpeedMps when both segment endpoint speeds are zero', () => {
            // maxSpeedKmH: 0 forces all achievable speeds to 0, triggering the fallback branch
            const geometry: LineString = {
                type: 'LineString',
                coordinates: [
                    [6.1, 46.2],
                    [6.11, 46.2], // ~1.1 km
                    [6.12, 46.2] // ~1.1 km more
                ]
            };

            const result = calculateSpeedProfile(geometry, {
                mode: 'rail',
                maxSpeedKmH: 0,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0
            });

            expect(result.speedPoints.every((p) => p.achievableSpeedKmH === 0)).toBe(true);

            const totalDistanceMeters = result.speedPoints[result.speedPoints.length - 1].distanceMeters;
            // Default minFallbackSpeedMps is 1.0; totalTime = totalDistance / 1.0
            const expectedTotalTime = totalDistanceMeters / 1.0;
            expect(result.totalTimeSeconds).toBeCloseTo(expectedTotalTime, 0);
        });

        test('should respect custom minFallbackSpeedMps when zero-speed fallback is used', () => {
            const geometry: LineString = {
                type: 'LineString',
                coordinates: [
                    [6.1, 46.2],
                    [6.11, 46.2],
                    [6.12, 46.2]
                ]
            };

            const result = calculateSpeedProfile(geometry, {
                mode: 'rail',
                maxSpeedKmH: 0,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0,
                minFallbackSpeedMps: 2.0
            });

            const totalDistanceMeters = result.speedPoints[result.speedPoints.length - 1].distanceMeters;
            const expectedTotalTime = totalDistanceMeters / 2.0;
            expect(result.totalTimeSeconds).toBeCloseTo(expectedTotalTime, 0);
        });

        test('should warn when zero-speed fallback branch is hit', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const geometry: LineString = {
                type: 'LineString',
                coordinates: [
                    [6.1, 46.2],
                    [6.11, 46.2],
                    [6.12, 46.2]
                ]
            };

            calculateSpeedProfile(geometry, {
                mode: 'rail',
                maxSpeedKmH: 0,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0
            });

            expect(warnSpy).toHaveBeenCalled();
            expect(warnSpy.mock.calls[0][0]).toContain('[speedProfile] Zero-speed fallback');
            expect(warnSpy.mock.calls[0][0]).toContain('distance=');
            expect(warnSpy.mock.calls[0][0]).toContain('totalTimeSeconds=');

            warnSpy.mockRestore();
        });
    });
});
