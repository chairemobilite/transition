/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type * as GtfsTypes from 'gtfs-types';
import Path from 'transition-common/lib/services/path/Path';
import { StopTime } from '../../gtfsImport/GtfsImportTypes';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { TranslatableMessageWithParams } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import {
    generateGeographyAndSegmentsFromGtfs,
    generateGeographyAndSegmentsFromStopTimes
} from '../PathGtfsGeographyGenerator';

jest.spyOn(console, 'log').mockImplementation(() => { /* noop */ });

// access untyped fields on path.attributes.data
const getData = (path: Path, key: string): any => path.attributes.data[key];

// a ~400m NE-trending shape with 4 stops snapped near it
const simpleShapeCoordinates: GtfsTypes.Shapes[] = [
    { shape_id: 'shape1', shape_pt_lat: 45.53817, shape_pt_lon: -73.61449, shape_pt_sequence: 0 },
    { shape_id: 'shape1', shape_pt_lat: 45.53901, shape_pt_lon: -73.61389, shape_pt_sequence: 1 },
    { shape_id: 'shape1', shape_pt_lat: 45.53936, shape_pt_lon: -73.61368, shape_pt_sequence: 2 },
    { shape_id: 'shape1', shape_pt_lat: 45.53959, shape_pt_lon: -73.61359, shape_pt_sequence: 3 },
    { shape_id: 'shape1', shape_pt_lat: 45.53977, shape_pt_lon: -73.61353, shape_pt_sequence: 4 },
    { shape_id: 'shape1', shape_pt_lat: 45.54040, shape_pt_lon: -73.61320, shape_pt_sequence: 5 },
    { shape_id: 'shape1', shape_pt_lat: 45.54056, shape_pt_lon: -73.61316, shape_pt_sequence: 6 },
    { shape_id: 'shape1', shape_pt_lat: 45.54165, shape_pt_lon: -73.61265, shape_pt_sequence: 7 }
];

const simpleStopCoordinates: { [key: string]: [number, number] } = {
    stop1: [-73.61436, 45.53814],
    stop2: [-73.61351, 45.53933],
    stop3: [-73.61327, 45.54062],
    stop4: [-73.61248, 45.54153]
};

// shape that doubles back on itself to test stop-to-shape matching on loops
const loopShapeCoordinates: GtfsTypes.Shapes[] = [
    { shape_id: 'loopShape', shape_pt_lat: 45.54080, shape_pt_lon: -73.62293, shape_pt_sequence: 0 },
    { shape_id: 'loopShape', shape_pt_lat: 45.54003, shape_pt_lon: -73.62029, shape_pt_sequence: 1 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53919, shape_pt_lon: -73.61741, shape_pt_sequence: 2 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53910, shape_pt_lon: -73.61730, shape_pt_sequence: 3 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53900, shape_pt_lon: -73.61741, shape_pt_sequence: 4 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53845, shape_pt_lon: -73.61775, shape_pt_sequence: 5 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53931, shape_pt_lon: -73.62066, shape_pt_sequence: 6 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53995, shape_pt_lon: -73.62029, shape_pt_sequence: 7 },
    { shape_id: 'loopShape', shape_pt_lat: 45.54000, shape_pt_lon: -73.62015, shape_pt_sequence: 8 },
    { shape_id: 'loopShape', shape_pt_lat: 45.53897, shape_pt_lon: -73.61670, shape_pt_sequence: 9 }
];

const loopStopCoordinates: { [key: string]: [number, number] } = {
    stop1: [-73.62291, 45.54075],
    stop2: [-73.62039, 45.53998],
    stop3: [-73.61746, 45.53910],
    stop4: [-73.61920, 45.53892],
    stop5: [-73.62035, 45.54009],
    stop6: [-73.61680, 45.53890]
};

const makeStopTimes = (
    tripId: string,
    stopIds: string[],
    times: [number, number][],
    options?: { withShapeDistTraveled?: number[] }
): StopTime[] =>
    stopIds.map((stopId, i) => ({
        trip_id: tripId,
        stop_id: stopId,
        stop_sequence: i,
        arrivalTimeSeconds: times[i][0],
        departureTimeSeconds: times[i][1],
        ...(options?.withShapeDistTraveled ? { shape_dist_traveled: options.withShapeDistTraveled[i] } : {})
    }));

// times are [arrival, departure] in seconds since midnight (36000 = 10:00:00)
// total trip: 300s with 30s of dwell time at intermediate stops
const simpleStopTimes = makeStopTimes(
    'trip1',
    ['stop1', 'stop2', 'stop3', 'stop4'],
    [[36000, 36000], [36090, 36100], [36180, 36200], [36300, 36300]]
);

const loopStopTimes = makeStopTimes(
    'loopTrip',
    ['stop1', 'stop2', 'stop3', 'stop4', 'stop5', 'stop6'],
    [[36000, 36000], [36090, 36100], [36180, 36200], [36300, 36320], [36400, 36420], [36520, 36520]]
);

const lineId = 'test-line-id';

const mockLine = {
    attributes: { mode: 'bus' },
    get: (key: string) => {
        if (key === 'shortname') return 'L1';
        if (key === 'longname') return 'Test Line';
        return undefined;
    }
};

const createMockCollectionManager = (nodeCoordinates: { [nodeId: string]: [number, number] }) => {
    const nodesCollection = {
        getById: (id: string) => ({
            geometry: { coordinates: nodeCoordinates[id] || [0, 0] }
        })
    };
    const linesCollection = {
        getById: () => mockLine
    };
    return {
        get: (name: string) => {
            if (name === 'nodes') return nodesCollection;
            if (name === 'lines') return linesCollection;
            return undefined;
        }
    };
};

// maps stopN coordinates to nodeN so nodes are co-located with stops
const nodeCoordinatesFromStops = (stopCoords: { [key: string]: [number, number] }): { [key: string]: [number, number] } => {
    const result: { [key: string]: [number, number] } = {};
    const stopIds = Object.keys(stopCoords);
    for (let i = 0; i < stopIds.length; i++) {
        result[`node${i + 1}`] = stopCoords[stopIds[i]];
    }
    return result;
};

const createPath = (nodeCoordinates: { [nodeId: string]: [number, number] } = nodeCoordinatesFromStops(simpleStopCoordinates)) => {
    const collectionManager = createMockCollectionManager(nodeCoordinates);
    return new Path(
        {
            line_id: lineId,
            direction: 'outbound' as const,
            nodes: [],
            segments: [],
            data: {}
        },
        true,
        collectionManager
    );
};

const simpleNodeIds = ['node1', 'node2', 'node3', 'node4'];

const runSimpleGtfs = (path: Path, nodeIds = simpleNodeIds) =>
    generateGeographyAndSegmentsFromGtfs(
        path, simpleShapeCoordinates, nodeIds, simpleStopTimes, 'shape1', simpleStopCoordinates
    );

describe('generateGeographyAndSegmentsFromGtfs', () => {
    describe('with valid shape and stops near shape', () => {
        let path: Path;
        let errors: ReturnType<typeof generateGeographyAndSegmentsFromGtfs>;

        beforeEach(() => {
            path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
            errors = runSimpleGtfs(path);
        });

        test('should set path geography and metadata', () => {
            expect(errors).toHaveLength(0);
            expect(path.attributes.nodes).toEqual(simpleNodeIds);
            expect(path.attributes.geography).toBeDefined();
            expect(path.attributes.geography!.type).toEqual('LineString');
            expect(path.attributes.geography!.coordinates.length).toBeGreaterThanOrEqual(4);
            expect(path.attributes.data.gtfs).toEqual({ shape_id: 'shape1' });
            expect(getData(path, 'from_gtfs')).toBe(true);
        });

        test('should set segments and timing data', () => {
            expect(path.attributes.segments).toHaveLength(simpleNodeIds.length - 1);
            expect(path.attributes.segments[0]).toEqual(0);
            expect(path.attributes.data.segments).toHaveLength(simpleStopTimes.length - 1);
            for (const segment of path.attributes.data.segments!) {
                expect(segment.distanceMeters).toBeGreaterThan(0);
            }
            expect(path.attributes.data.dwellTimeSeconds).toHaveLength(simpleStopTimes.length);
            expect(path.attributes.data.dwellTimeSeconds![path.attributes.data.dwellTimeSeconds!.length - 1]).toEqual(0);
        });

        test('should compute path-level metrics', () => {
            expect(path.attributes.data.totalDistanceMeters).toBeGreaterThan(0);
            expect(path.attributes.data.birdDistanceBetweenTerminals).toBeGreaterThan(0);
            expect(path.attributes.data.totalTravelTimeWithReturnBackSeconds).toBeNull();
            expect(getData(path, 'returnBackGeography')).toBeNull();
        });
    });

    test('should set geography to null for empty or undefined shape', () => {
        const path1 = createPath();
        const errors1 = generateGeographyAndSegmentsFromGtfs(
            path1, [], ['node1', 'node2'], simpleStopTimes, 'emptyShape', simpleStopCoordinates
        );
        expect(errors1).toHaveLength(0);
        expect(path1.attributes.geography).toBeNull();
        expect(path1.attributes.data.gtfs).toEqual({ shape_id: 'emptyShape' });

        const path2 = createPath();
        const errors2 = generateGeographyAndSegmentsFromGtfs(
            path2, undefined as any, ['node1'], simpleStopTimes, 'noShape', simpleStopCoordinates
        );
        expect(errors2).toHaveLength(0);
        expect(path2.attributes.geography).toBeNull();
    });

    test('should return error with timing data but null distances when stops too far from shape', () => {
        // stop3 is moved 170m away from the shape exceeding the max snap
        // distance so shape-based geography fails and distances are null
        const stopCoordinatesWithFarStop: { [key: string]: [number, number] } = {
            stop1: simpleStopCoordinates.stop1,
            stop2: simpleStopCoordinates.stop2,
            stop3: [-73.61524, 45.54158],
            stop4: simpleStopCoordinates.stop4
        };
        const path = createPath(nodeCoordinatesFromStops(stopCoordinatesWithFarStop));
        const errors = generateGeographyAndSegmentsFromGtfs(
            path, simpleShapeCoordinates, simpleNodeIds, simpleStopTimes, 'shape1', stopCoordinatesWithFarStop
        );

        expect(errors).toHaveLength(1);
        const error = errors[0] as TranslatableMessageWithParams;
        expect(error.text).toEqual(GtfsMessages.CannotGenerateFromGtfsShape);
        expect(error.params).toEqual({ shapeGtfsId: 'shape1', lineShortName: 'L1', lineName: 'Test Line' });
        expect(path.attributes.segments).toEqual([]);
        expect(path.attributes.geography).toBeDefined();
        expect(path.attributes.data.gtfs).toEqual({ shape_id: 'shape1' });
        expect(getData(path, 'from_gtfs')).toBe(true);
        expect(path.attributes.data.travelTimeWithoutDwellTimesSeconds).toBeGreaterThan(0);
        expect(path.attributes.data.dwellTimeSeconds).toHaveLength(simpleStopTimes.length);
        expect(path.attributes.data.dwellTimeSeconds![simpleStopTimes.length - 1]).toEqual(0);
        for (const segment of path.attributes.data.segments!) {
            expect(segment.distanceMeters).toBeNull();
        }
    });

    test('should handle loop shape without errors', () => {
        const path = createPath(nodeCoordinatesFromStops(loopStopCoordinates));
        const nodeIds = ['node1', 'node2', 'node3', 'node4', 'node5', 'node6'];
        const errors = generateGeographyAndSegmentsFromGtfs(
            path, loopShapeCoordinates, nodeIds, loopStopTimes, 'loopShape', loopStopCoordinates
        );

        expect(errors).toHaveLength(0);
        expect(path.attributes.geography).toBeDefined();
        expect(path.attributes.segments).toHaveLength(nodeIds.length - 1);
        for (const segment of path.attributes.data.segments!) {
            expect(segment.distanceMeters).toBeGreaterThan(0);
        }
    });

    // when shape_dist_traveled is provided segment distances are proportional
    // to the distance ratios along the shape not actual geographic distances
    test('should normalize GTFS-provided shape_dist_traveled distances', () => {
        const stopTimesWithDist = makeStopTimes(
            'trip1',
            ['stop1', 'stop2', 'stop3', 'stop4'],
            [[36000, 36000], [36090, 36100], [36180, 36200], [36300, 36300]],
            { withShapeDistTraveled: [0, 100, 250, 400] }
        );
        const shapesWithDist = simpleShapeCoordinates.map((s, i) => ({
            ...s,
            shape_dist_traveled: i * 60
        }));

        const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
        const errors = generateGeographyAndSegmentsFromGtfs(
            path, shapesWithDist, simpleNodeIds, stopTimesWithDist, 'shape1', simpleStopCoordinates
        );

        expect(errors).toHaveLength(0);
        expect(path.attributes.segments).toHaveLength(3);
        const totalDist = path.attributes.data.totalDistanceMeters!;
        const segmentData = path.attributes.data.segments!;
        expect(segmentData[0].distanceMeters! / totalDist).toBeCloseTo(0.25, 1);
        expect(segmentData[1].distanceMeters! / totalDist).toBeCloseTo(0.375, 1);
        expect(segmentData[2].distanceMeters! / totalDist).toBeCloseTo(0.375, 1);
    });

    describe('layover calculation', () => {
        test('should use customLayoverMinutes when set', () => {
            const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
            path.attributes.data.customLayoverMinutes = 5;
            runSimpleGtfs(path);
            expect(getData(path, 'layoverTimeSeconds')).toEqual(300);
        });

        test('should use ratio-based default layover when ratio exceeds minimum', () => {
            const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
            // use longer travel times so 0.1 * totalTravelTime > 180s minimum
            const longStopTimes = makeStopTimes(
                'trip1',
                ['stop1', 'stop2', 'stop3', 'stop4'],
                [[36000, 36000], [36700, 36710], [37400, 37420], [38100, 38100]]
            );
            generateGeographyAndSegmentsFromGtfs(
                path, simpleShapeCoordinates, simpleNodeIds, longStopTimes, 'shape1', simpleStopCoordinates
            );
            // totalTravelTimeWithDwellTimes = (0+700) + (10+690) + (20+680) = 2100s
            // layover = ceil(max(0.1 * 2100, 180)) = 210
            expect(getData(path, 'layoverTimeSeconds')).toEqual(210);
        });

        test('should respect custom ratio and minimum parameters', () => {
            const path1 = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
            generateGeographyAndSegmentsFromGtfs(
                path1, simpleShapeCoordinates, simpleNodeIds,
                simpleStopTimes, 'shape1', simpleStopCoordinates, 0.5, 60
            );
            // totalTravelTimeWithDwellTimes = 300s; layover = ceil(max(0.5 * 300, 60)) = 150
            expect(getData(path1, 'layoverTimeSeconds')).toEqual(150);

            const path2 = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
            generateGeographyAndSegmentsFromGtfs(
                path2, simpleShapeCoordinates, simpleNodeIds,
                simpleStopTimes, 'shape1', simpleStopCoordinates, 0.01, 120
            );
            // layover = ceil(max(0.01 * 300, 120)) = 120 (minimum wins)
            expect(getData(path2, 'layoverTimeSeconds')).toEqual(120);
        });
    });

    test('timing consistency: layover equation and speed ordering', () => {
        const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
        runSimpleGtfs(path);

        expect(path.attributes.data.operatingTimeWithLayoverTimeSeconds).toEqual(
            path.attributes.data.operatingTimeWithoutLayoverTimeSeconds! +
                getData(path, 'layoverTimeSeconds')!
        );
        expect(path.attributes.data.averageSpeedWithoutDwellTimesMetersPerSecond).toBeGreaterThan(
            path.attributes.data.operatingSpeedMetersPerSecond!
        );
        expect(path.attributes.data.operatingSpeedMetersPerSecond).toBeGreaterThan(
            getData(path, 'operatingSpeedWithLayoverMetersPerSecond')!
        );
    });

    test('should produce a single segment for 2-stop path', () => {
        const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
        const twoStopTimes = makeStopTimes('trip1', ['stop1', 'stop4'], [[36000, 36000], [36300, 36300]]);
        const errors = generateGeographyAndSegmentsFromGtfs(
            path, simpleShapeCoordinates, ['node1', 'node4'], twoStopTimes, 'shape1', simpleStopCoordinates
        );

        expect(errors).toHaveLength(0);
        expect(path.attributes.segments).toHaveLength(1);
        expect(path.attributes.data.segments).toHaveLength(1);
    });
});

describe('generateGeographyAndSegmentsFromStopTimes', () => {
    describe('with valid stop coordinates', () => {
        let path: Path;
        let errors: ReturnType<typeof generateGeographyAndSegmentsFromStopTimes>;

        beforeEach(() => {
            path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
            errors = generateGeographyAndSegmentsFromStopTimes(
                path, simpleNodeIds, simpleStopTimes, simpleStopCoordinates
            );
        });

        test('should set path geography and metadata', () => {
            expect(errors).toHaveLength(0);
            expect(path.attributes.nodes).toEqual(simpleNodeIds);
            expect(path.attributes.geography).toBeDefined();
            expect(path.attributes.geography!.type).toEqual('LineString');
            expect(path.attributes.data.gtfs).toEqual({ shape_id: undefined });
            expect(getData(path, 'from_gtfs')).toBe(true);
        });

        test('should set segments with sequential indices and null distances', () => {
            expect(path.attributes.segments).toHaveLength(simpleNodeIds.length - 1);
            for (let i = 0; i < simpleNodeIds.length - 1; i++) {
                expect(path.attributes.segments[i]).toEqual(i);
            }
            for (const segment of path.attributes.data.segments!) {
                expect(segment.distanceMeters).toBeNull();
            }
            expect(path.attributes.data.totalDistanceMeters).toBeGreaterThan(0);
        });

        test('should compute travel and dwell times from stop times', () => {
            expect(path.attributes.data.segments![0].travelTimeSeconds).toEqual(90);  // 36090 - 36000
            expect(path.attributes.data.segments![1].travelTimeSeconds).toEqual(80);  // 36180 - 36100
            expect(path.attributes.data.segments![2].travelTimeSeconds).toEqual(100); // 36300 - 36200
            expect(path.attributes.data.dwellTimeSeconds).toHaveLength(simpleStopTimes.length);
            expect(path.attributes.data.dwellTimeSeconds![0]).toEqual(0);   // 36000 - 36000
            expect(path.attributes.data.dwellTimeSeconds![1]).toEqual(10);  // 36100 - 36090
            expect(path.attributes.data.dwellTimeSeconds![2]).toEqual(20);  // 36200 - 36180
            expect(path.attributes.data.dwellTimeSeconds![3]).toEqual(0);   // terminal
        });

        test('should compute speed metrics and set null fields', () => {
            expect(path.attributes.data.averageSpeedWithoutDwellTimesMetersPerSecond).toBeGreaterThan(0);
            expect(path.attributes.data.operatingSpeedMetersPerSecond).toBeGreaterThan(0);
            expect(getData(path, 'operatingSpeedWithLayoverMetersPerSecond')).toBeGreaterThan(0);
            expect(path.attributes.data.totalTravelTimeWithReturnBackSeconds).toBeNull();
            expect(getData(path, 'returnBackGeography')).toBeNull();
        });
    });

    test('should return error and null geography on missing stop coordinates', () => {
        const path = createPath();
        const errors = generateGeographyAndSegmentsFromStopTimes(
            path, simpleNodeIds, simpleStopTimes, {
                stop1: simpleStopCoordinates.stop1,
                stop2: simpleStopCoordinates.stop2,
                // stop3 is missing
                stop4: simpleStopCoordinates.stop4
            }
        );

        expect(errors).toHaveLength(1);
        const error = errors[0] as TranslatableMessageWithParams;
        expect(error.text).toEqual(GtfsMessages.CannotGenerateFromStopTimes);
        expect(error.params).toEqual({ lineShortName: 'L1', lineName: 'Test Line' });
        expect(path.attributes.geography).toBeNull();
        expect(path.attributes.data.gtfs).toEqual({ shape_id: undefined });
    });

    test('should use customLayoverMinutes when set', () => {
        const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
        path.attributes.data.customLayoverMinutes = 3;
        generateGeographyAndSegmentsFromStopTimes(path, simpleNodeIds, simpleStopTimes, simpleStopCoordinates);
        expect(getData(path, 'layoverTimeSeconds')).toEqual(180);
    });

    test('should produce a single segment for 2-stop path', () => {
        const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
        const twoStopTimes = makeStopTimes('trip1', ['stop1', 'stop4'], [[36000, 36000], [36300, 36300]]);
        const errors = generateGeographyAndSegmentsFromStopTimes(
            path, ['node1', 'node4'], twoStopTimes, simpleStopCoordinates
        );

        expect(errors).toHaveLength(0);
        expect(path.attributes.segments).toEqual([0]);
        expect(path.attributes.data.segments).toHaveLength(1);
        expect(path.attributes.data.dwellTimeSeconds).toHaveLength(2);
    });

    test('timing consistency: layover equation and dwell time sum', () => {
        const path = createPath(nodeCoordinatesFromStops(simpleStopCoordinates));
        generateGeographyAndSegmentsFromStopTimes(path, simpleNodeIds, simpleStopTimes, simpleStopCoordinates);

        expect(path.attributes.data.operatingTimeWithLayoverTimeSeconds).toEqual(
            path.attributes.data.operatingTimeWithoutLayoverTimeSeconds! +
                getData(path, 'layoverTimeSeconds')!
        );
        const sumDwell = path.attributes.data.dwellTimeSeconds!.reduce((a, b) => a + b, 0);
        expect(getData(path, 'totalDwellTimeSeconds')).toEqual(sumDwell);
    });
});
