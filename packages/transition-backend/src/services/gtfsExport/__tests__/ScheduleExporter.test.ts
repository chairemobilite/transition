/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createWriteStream } from 'fs';
import { v4 as uuidV4 } from 'uuid';

import { exportSchedule } from '../ScheduleExporter';
import Path from 'transition-common/lib/services/path/Path';
import { ScheduleAttributes } from 'transition-common/lib/services/schedules/Schedule';
import schedulesDbQueries from '../../../models/db/transitSchedules.db.queries';

jest.mock('fs', () => {
    // Require the original module to not be mocked...
    const originalModule =
      jest.requireActual<typeof import('fs')>('fs');
  
    return {
      ...originalModule,
      createWriteStream: jest.fn()
    };
});

const quoteFct = (val: unknown) => typeof val === 'string';
const mockWriteTripStream = {
    write: jest.fn().mockImplementation((chunk) => true),
    end: jest.fn()
};
const mockWriteStopTimeStream = {
    write: jest.fn().mockImplementation((chunk) => true),
    end: jest.fn()
};
const mockCreateStream = createWriteStream as jest.MockedFunction<any>
mockCreateStream.mockImplementation((filePath: string) => filePath.includes('trips.txt') ? mockWriteTripStream : mockWriteStopTimeStream);

// Only need one single path for tests, 4 stops, but 5 coordinates
const pathAttributes = {
    id: uuidV4(),
    name: 'PathFull',
    geography: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.0011, 45], [-73.003, 45.001], [-73.003, 45.002], [-73.004, 45.002]] },
    direction: 'outbound',
    line_id: uuidV4(),
    is_enabled: true,
    nodes: [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops: [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    segments: [0, 1, 2, 4],
    mode: 'bus',
    data: {
    },
    is_frozen: false
};

// Second path, new id with new node ids
const pathAttributes2 = {
    ...pathAttributes,
    id: uuidV4(),
    nodes: [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
}

const path = new Path(pathAttributes, false);
const path2 = new Path(pathAttributes2, false);
// Convert distances in km, same coordinates for both patsh
const pathDistances = path.getCoordinatesDistanceTraveledMeters().map(dist => Math.round(dist) / 1000);
const lineId = uuidV4();
const serviceId = uuidV4();
const serviceId2 = uuidV4();
const scheduleIntegerId = 4;

// Schedule with many periods/trips, but one path
const scheduleAttributes1: ScheduleAttributes = {
    allow_seconds_based_schedules: false,
    id: uuidV4(),
    integer_id: scheduleIntegerId,
    line_id: lineId,
    service_id: serviceId,
    is_frozen: false,
    data: {},
    periods: [{
        // Period with start and end hours and multiple trips
        schedule_id: scheduleIntegerId,
        id: uuidV4(),
        integer_id: 1,
        data: {},
        end_at_hour: 12,
        inbound_path_id: undefined,
        interval_seconds: 1800,
        number_of_units: undefined,
        outbound_path_id: pathAttributes.id,
        period_shortname: "all_day_period_shortname",
        start_at_hour: 7,
        trips: [{
            arrival_time_seconds: 27015,
            block_id: uuidV4(),
            departure_time_seconds: 25200,
            id: uuidV4(),
            node_arrival_times_seconds: [25200, 25251, 26250, 27015],
            node_departure_times_seconds: [25200, 25261, 26260, 27015],
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
            path_id: pathAttributes.id,
            seated_capacity: 20,
            total_capacity: 50,
            schedule_period_id: 1,
            data: {}
        }, {
            arrival_time_seconds: 32416,
            departure_time_seconds: 30601,
            id: uuidV4(),
            node_arrival_times_seconds: [30601, 30652, 31650, 32416],
            node_departure_times_seconds: [30601, 30662, 31660, 32416],
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
            path_id: pathAttributes.id,
            seated_capacity: 20,
            total_capacity: 50,
            schedule_period_id: 1,
            data: {}
        }, {
            arrival_time_seconds: 34216,
            departure_time_seconds: 32401,
            id: uuidV4(),
            node_arrival_times_seconds: [32401, 32452, 33450, 34216],
            node_departure_times_seconds: [32401, 32462, 33460, 34216],
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
            path_id: pathAttributes.id,
            seated_capacity: 20,
            total_capacity: 50,
            schedule_period_id: 1,
            data: {}
        }]
    }, {
        schedule_id: scheduleIntegerId,
        id: uuidV4(),
        integer_id: 4,
        data: {},
        custom_start_at_str: "13:15",
        custom_end_at_str: "17:24",
        end_at_hour: 18,
        interval_seconds: 1800,
        outbound_path_id: pathAttributes.id,
        period_shortname: "all_day_custom_period",
        start_at_hour: 13,
        trips: [{
            arrival_time_seconds: 50000,
            departure_time_seconds: 48000,
            id: uuidV4(),
            node_arrival_times_seconds: [48000, 48050, 49450, 50000],
            node_departure_times_seconds: [48000, 48060, 49460, 50000],
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
            path_id: pathAttributes.id,
            seated_capacity: 20,
            total_capacity: 50,
            schedule_period_id: 4,
            data: {}
        }]
    }, {
        // Period with custom start and end, without trips
        schedule_id: scheduleIntegerId,
        id: uuidV4(),
        data: {},
        custom_start_at_str: "18:00",
        custom_end_at_str: "23:00",
        end_at_hour: 23,
        interval_seconds: 1800,
        outbound_path_id: pathAttributes.id,
        period_shortname: "all_day_custom_period",
        start_at_hour: 18,
        trips: []
    }],
    periods_group_shortname: "all_day",
};

// Simple second schedule, one trip in each direction, the actual coordinates and routability are not important
const scheduleIntegerId2 = 5;
const scheduleAttributes2: ScheduleAttributes = {
    allow_seconds_based_schedules: false,
    id: uuidV4(),
    integer_id: scheduleIntegerId2,
    line_id: lineId,
    service_id: serviceId2,
    is_frozen: false,
    data: {},
    periods: [{
        schedule_id: scheduleIntegerId2,
        id: uuidV4(),
        integer_id: 2,
        data: {},
        end_at_hour: 12,
        inbound_path_id: pathAttributes2.id,
        interval_seconds: 1800,
        outbound_path_id: pathAttributes.id,
        period_shortname: "all_day_period_shortname",
        start_at_hour: 7,
        trips: [{
            arrival_time_seconds: 27015,
            block_id: "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
            departure_time_seconds: 25200,
            id: uuidV4(),
            node_arrival_times_seconds: [25200, 25251, 26250, 27015],
            node_departure_times_seconds: [25200, 25261, 26260, 27015],
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
            path_id: pathAttributes.id,
            seated_capacity: 20,
            total_capacity: 50,
            schedule_period_id: 2,
            data: {}
        },
        {
            arrival_time_seconds: 27015,
            block_id: "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
            departure_time_seconds: 25200,
            id: uuidV4(),
            node_arrival_times_seconds: [25200, 25251, 26250, 27015],
            node_departure_times_seconds: [25200, 25261, 26260, 27015],
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
            path_id: pathAttributes2.id,
            seated_capacity: 20,
            total_capacity: 50,
            schedule_period_id: 2,
            data: {}
        }]
    }],
    periods_group_shortname: "all_day",
};

jest.mock('../../../models/db/transitSchedules.db.queries', () => {
    return {
        readForLines: jest.fn()
    }
});
const mockReadForLines = schedulesDbQueries.readForLines as jest.MockedFunction<typeof schedulesDbQueries.readForLines>;

jest.mock('../../../models/db/transitPaths.db.queries', () => {
    return {
        geojsonCollection: jest.fn().mockImplementation(async () => {
            return { type: 'FeatureCollection', features: [path.toGeojson(), path2.toGeojson()] };
        })
    }
});

const sluggedServiceId = 'Service';
const sluggedServiceId2 = 'Service2';
const serviceToGtfsId = { [serviceId]: sluggedServiceId, [serviceId2]: sluggedServiceId2 };

beforeEach(() => {
    jest.clearAllMocks();
})

test('Test exporting one schedule', async () => {
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1]);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual(pathAttributes.nodes);
    expect((response as any).pathIds).toEqual([pathAttributes.id]);

    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteTripStream.write).toHaveBeenLastCalledWith([
        '"route_id","service_id","trip_id","trip_headsign","trip_short_name","direction_id","block_id","shape_id","wheelchair_accessible","bikes_allowed"',
        `"${lineId}","${sluggedServiceId}","${scheduleAttributes1.periods[0].trips[0].id}","${pathAttributes.name}",,0,"${scheduleAttributes1.periods[0].trips[0].block_id}","${pathAttributes.id}",,`,
        `"${lineId}","${sluggedServiceId}","${scheduleAttributes1.periods[0].trips[1].id}","${pathAttributes.name}",,0,,"${pathAttributes.id}",,`,
        `"${lineId}","${sluggedServiceId}","${scheduleAttributes1.periods[0].trips[2].id}","${pathAttributes.name}",,0,,"${pathAttributes.id}",,`,
        `"${lineId}","${sluggedServiceId}","${scheduleAttributes1.periods[1].trips[0].id}","${pathAttributes.name}",,0,,"${pathAttributes.id}",,`,
    ].join('\n') + '\n');
    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    // Match strings for each trip individually, to better catch errors in one trip
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        '"trip_id","arrival_time","departure_time","stop_id","stop_sequence","stop_headsign","pickup_type","drop_off_type","continuous_pickup","continuous_drop_off","shape_dist_traveled","timepoint"',
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:00:00","7:00:00","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:00:51","7:01:01","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:17:30","7:17:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:30:15","7:30:15","${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes1.periods[0].trips[1].id}","8:30:01","8:30:01","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[0].trips[1].id}","8:30:52","8:31:02","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[0].trips[1].id}","8:47:30","8:47:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[0].trips[1].id}","9:00:16","9:00:16","${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:00:01","9:00:01","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:00:52","9:01:02","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:17:30","9:17:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:30:16","9:30:16","${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:20:00","13:20:00","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:20:50","13:21:00","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:44:10","13:44:20","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:53:20","13:53:20","${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting one schedule including multiple paths', async () => {
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes2]);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([...pathAttributes.nodes, ...pathAttributes2.nodes]);
    expect((response as any).pathIds).toEqual([pathAttributes.id, pathAttributes2.id]);

    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteTripStream.write).toHaveBeenLastCalledWith([
        '"route_id","service_id","trip_id","trip_headsign","trip_short_name","direction_id","block_id","shape_id","wheelchair_accessible","bikes_allowed"',
        `"${lineId}","${sluggedServiceId2}","${scheduleAttributes2.periods[0].trips[0].id}","${pathAttributes.name}",,0,"${scheduleAttributes2.periods[0].trips[0].block_id}","${scheduleAttributes2.periods[0].trips[0].path_id}",,`,
        `"${lineId}","${sluggedServiceId2}","${scheduleAttributes2.periods[0].trips[1].id}","${pathAttributes.name}",,0,"${scheduleAttributes2.periods[0].trips[1].block_id}","${scheduleAttributes2.periods[0].trips[1].path_id}",,`,
    ].join('\n') + '\n');
    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    // Match strings for each trip individually, to better catch errors in one trip
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        '"trip_id","arrival_time","departure_time","stop_id","stop_sequence","stop_headsign","pickup_type","drop_off_type","continuous_pickup","continuous_drop_off","shape_dist_traveled","timepoint"',
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:00:00","7:00:00","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:00:51","7:01:01","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:17:30","7:17:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:30:15","7:30:15","${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:00:00","7:00:00","${pathAttributes2.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:00:51","7:01:01","${pathAttributes2.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:17:30","7:17:40","${pathAttributes2.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:30:15","7:30:15","${pathAttributes2.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting multiple schedules', async () => {
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1, scheduleAttributes2]);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([...pathAttributes.nodes, ...pathAttributes2.nodes]);
    expect((response as any).pathIds).toEqual([pathAttributes.id, pathAttributes2.id]);

    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(1);
    // Make sure the number of lines matches (6 trips + header + last newline)
    expect((mockWriteTripStream.write.mock.calls[0][0] as string).split('\n').length).toEqual(8);

    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    // Make sure the number of lines matches (6 trips * 4 stops + header + last newline)
    expect((mockWriteStopTimeStream.write.mock.calls[0][0] as string).split('\n').length).toEqual(26);

    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting multiple chunks of schedules', async () => {
    // Create 1000 schedules to force 10 writes, just duplicate existing ones
    const writeCount = 10;
    const manySchedules = Array.from({ length: 1000 }).map((_, index) => scheduleAttributes1);
    mockReadForLines.mockResolvedValueOnce(manySchedules);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([...pathAttributes.nodes]);
    expect((response as any).pathIds).toEqual([pathAttributes.id]);

    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(writeCount);
    // Make sure the number of lines matches (4 trips * 100 schedules + header + last newline)
    expect((mockWriteTripStream.write.mock.calls[0][0] as string).split('\n').length).toEqual(4 * 100 + 1 + 1);
    // Subsequent calls do not have headers
    for (let i = 1; i < writeCount; i++) {
        expect((mockWriteTripStream.write.mock.calls[i][0] as string).split('\n').length).toEqual(4 * 100 + 1);
    }

    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(writeCount);
    // Make sure the number of lines matches (4 trips * 4 stops for 100 schedules + header + last newline)
    expect((mockWriteStopTimeStream.write.mock.calls[0][0] as string).split('\n').length).toEqual(4 * 4 * 100 + 1 + 1);
    // Subsequent calls do not have headers
    for (let i = 1; i < writeCount; i++) {
        expect((mockWriteStopTimeStream.write.mock.calls[i][0] as string).split('\n').length).toEqual(4 * 4 * 100 + 1);
    }

    // Verify the concatenated output has the correct total number of lines (no missing newlines between batches)
    const allTrips = mockWriteTripStream.write.mock.calls.map((call) => call[0] as string).join('');
    expect(allTrips.split('\n').length).toEqual(4 * 1000 + 1 + 1); // 4 trips per schedule * 1000 schedules + header + last newline
    const allStopTimes = mockWriteStopTimeStream.write.mock.calls.map((call) => call[0] as string).join('');
    expect(allStopTimes.split('\n').length).toEqual(4 * 4 * 1000 + 1 + 1); // 4 trips * 4 stops per schedule * 1000 schedules + header + last newline

    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting multiple chunks of lines', async () => {
    // Request writing schedules for 200 lines, to force 4 chunks of lines
    const lineIds = Array.from({ length: 200 }).map(() => uuidV4());
    const writeCount = 4;
    // Actual schedules is not important, just need some to write
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1]);
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1]);
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1]);
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1]);
    const response = await exportSchedule(lineIds, { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([...pathAttributes.nodes]);
    expect((response as any).pathIds).toEqual([pathAttributes.id]);

    // Make sure there was 4 writes for each file, and the same for the readForLines function
    expect(mockReadForLines).toHaveBeenCalledTimes(writeCount);
    expect(mockReadForLines).toHaveBeenCalledWith(lineIds.slice(0, 50));
    expect(mockReadForLines).toHaveBeenCalledWith(lineIds.slice(50, 100));
    expect(mockReadForLines).toHaveBeenCalledWith(lineIds.slice(100, 150));
    expect(mockReadForLines).toHaveBeenCalledWith(lineIds.slice(150, 200));
    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(writeCount);
    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(writeCount);
});

test('Test exporting a schedule with an unknown path', async () => {
    const unknownPathId = uuidV4();
    const schedulesWithNoPath = Object.assign({}, scheduleAttributes2);
    schedulesWithNoPath.periods[0].trips.forEach((trip, index) => schedulesWithNoPath.periods[0].trips[index].path_id = unknownPathId);
    mockReadForLines.mockResolvedValueOnce([schedulesWithNoPath]);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([]);
    expect((response as any).pathIds).toEqual([]);
    expect(mockWriteTripStream.write).not.toHaveBeenCalled();
    expect(mockWriteTripStream.end).toHaveBeenCalledTimes(1);
    expect(mockWriteStopTimeStream.write).not.toHaveBeenCalled();
    expect(mockWriteStopTimeStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting no schedules', async () => {
    mockReadForLines.mockResolvedValueOnce([]);
    const response = await exportSchedule([uuidV4()], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([]);
    expect((response as any).pathIds).toEqual([]);
    expect(mockWriteTripStream.write).not.toHaveBeenCalled();
    expect(mockWriteTripStream.end).toHaveBeenCalledTimes(1);
    expect(mockWriteStopTimeStream.write).not.toHaveBeenCalled();
    expect(mockWriteStopTimeStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test GTFS compliance - arrival_time and departure_time are always populated', async () => {
    // This test validates the fix for missing trip edge times that cause GTFS validation errors
    mockReadForLines.mockResolvedValueOnce([scheduleAttributes1]);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');

    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    const stopTimesOutput = mockWriteStopTimeStream.write.mock.calls[0][0] as string;
    const stopTimesLines = stopTimesOutput.split('\n').filter(line => line.trim() && !line.startsWith('"trip_id"'));

    // Validate that EVERY stop time record has BOTH arrival_time AND departure_time
    stopTimesLines.forEach((line, index) => {
        const fields = line.split(',');
        const tripId = fields[0].replace(/"/g, ''); // Remove quotes
        const arrivalTime = fields[1].replace(/"/g, ''); // Remove quotes
        const departureTime = fields[2].replace(/"/g, ''); // Remove quotes
        const stopSequence = fields[4].replace(/"/g, ''); // Remove quotes

        // GTFS Compliance: Both arrival_time and departure_time must be populated
        expect(arrivalTime).toBeTruthy();
        expect(arrivalTime).not.toBe('');
        expect(departureTime).toBeTruthy();
        expect(departureTime).not.toBe('');

        // Validate time format (HH:MM:SS)
        expect(arrivalTime).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);
        expect(departureTime).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);
    });

    // Additional validation: Check specific expected patterns from the test data
    // First stop should have both arrival and departure times (not empty)
    expect(stopTimesOutput).toContain('"7:00:00","7:00:00"'); // First stop
    expect(stopTimesOutput).toContain('"7:30:15","7:30:15"'); // Last stop
});

test('Test GTFS compliance with edge cases - missing arrival or departure times', async () => {
    // Create test data that simulates missing arrival/departure times to verify fallback logic
    const scheduleWithMissingTimes = JSON.parse(JSON.stringify(scheduleAttributes1));

    // Simulate a trip where first stop has no arrival time and last stop has no departure time
    const firstTrip = scheduleWithMissingTimes.periods[0].trips[0];

    // Set first stop arrival to null (simulating missing data)
    firstTrip.node_arrival_times_seconds[0] = null;
    // Set last stop departure to null (simulating missing data)
    const lastIndex = firstTrip.node_departure_times_seconds.length - 1;
    firstTrip.node_departure_times_seconds[lastIndex] = null;

    mockReadForLines.mockResolvedValueOnce([scheduleWithMissingTimes]);
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');

    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    const stopTimesOutput = mockWriteStopTimeStream.write.mock.calls[0][0] as string;
    const stopTimesLines = stopTimesOutput.split('\n').filter(line => line.trim() && !line.startsWith('"trip_id"'));

    // Even with missing data, ALL stop times should still have both arrival and departure times
    stopTimesLines.forEach((line) => {
        const fields = line.split(',');
        const arrivalTime = fields[1].replace(/"/g, '');
        const departureTime = fields[2].replace(/"/g, '');

        // The fix should ensure these are never empty
        expect(arrivalTime).toBeTruthy();
        expect(arrivalTime).not.toBe('');
        expect(departureTime).toBeTruthy();
        expect(departureTime).not.toBe('');
    });
});

test('Test error handling - both arrival_time and departure_time missing', async () => {
    // This test validates the safety check that throws an error when both times are missing
    const scheduleWithBothTimesMissing = JSON.parse(JSON.stringify(scheduleAttributes1));

    // Simulate a trip where a stop has BOTH arrival and departure times missing
    const firstTrip = scheduleWithBothTimesMissing.periods[0].trips[0];

    // Set both times to null for the second stop (not first or last, to avoid other edge cases)
    firstTrip.node_arrival_times_seconds[1] = null;
    firstTrip.node_departure_times_seconds[1] = null;

    mockReadForLines.mockResolvedValueOnce([scheduleWithBothTimesMissing]);

    // This should throw an error and result in a failed export
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('error');

    if (response.status === 'error') {
        // Verify the error message is what we expect
        expect(response.error).toBeInstanceOf(Error);
        const errorMessage = (response.error as Error).message;
        expect(errorMessage).toContain('Missing both arrival_time and departure_time');
        expect(errorMessage).toContain(`trip ${firstTrip.id}`);
        expect(errorMessage).toContain('stop_sequence 2');
    }

    // Should not have written any data due to the error
    expect(mockWriteStopTimeStream.write).not.toHaveBeenCalled();
});

test('Test GTFS compliance - handles >24h times for midnight-crossing schedules', async () => {
    // Test that times exceeding 24 hours are properly formatted for late-night schedules
    // GTFS specification allows hours >= 24 for services that cross midnight
    
    const scheduleWith24hPlus: ScheduleAttributes = {
        ...scheduleAttributes1,
        periods: [
            {
                ...scheduleAttributes1.periods[0],
                trips: [
                    {
                        id: 'test_trip_midnight_crossing',
                        arrival_time_seconds: 99000,
                        departure_time_seconds: 90600,
                        path_id:  pathAttributes.id,
                        node_arrival_times_seconds: [
                            90600,  // 25:10:00 (1 day + 1h + 10min)
                            97800   // 27:10:00 (1 day + 3h + 10min)
                        ],
                        node_departure_times_seconds: [
                            90600,  // 25:10:00
                            99000   // 27:30:00 (1 day + 3h + 30min)
                        ],
                        nodes_can_board: [true, false],
                        nodes_can_unboard: [false, true],
                        data: {}
                    }
                ]
            }
        ]
    };

    mockReadForLines.mockResolvedValueOnce([scheduleWith24hPlus]);
    const response = await exportSchedule([lineId], { 
        directoryPath: 'test', 
        quotesFct: quoteFct, 
        serviceToGtfsId 
    });

    expect(response.status).toEqual('success');
    expect(mockWriteStopTimeStream.write).toHaveBeenCalled();
    
    const stopTimesOutput = mockWriteStopTimeStream.write.mock.calls[0][0] as string;
    const stopTimesLines = stopTimesOutput.split('\n').filter(line => 
        line.trim() && !line.startsWith('"trip_id"')
    );

    // Verify we have the expected number of stop times
    expect(stopTimesLines).toHaveLength(2);

    // Parse and validate the first stop time (25:10:00)
    const firstStopFields = stopTimesLines[0].split(',');
    const firstArrival = firstStopFields[1].replace(/"/g, '');
    const firstDeparture = firstStopFields[2].replace(/"/g, '');
    
    expect(firstArrival).toBe('25:10:00');
    expect(firstDeparture).toBe('25:10:00');

    // Parse and validate the second stop time (27:10:00 arrival, 27:30:00 departure)
    const secondStopFields = stopTimesLines[1].split(',');
    const secondArrival = secondStopFields[1].replace(/"/g, '');
    const secondDeparture = secondStopFields[2].replace(/"/g, '');
    
    expect(secondArrival).toBe('27:10:00');
    expect(secondDeparture).toBe('27:30:00');

    // Validate GTFS time format compliance (HH:MM:SS with possible H >= 24)
    [firstArrival, firstDeparture, secondArrival, secondDeparture].forEach(timeStr => {
        expect(timeStr).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);
        expect(timeStr).toBeTruthy();
        expect(timeStr).not.toBe('');
    });

    // Verify that hours can indeed be >= 24 (GTFS specification compliance)
    const firstHour = parseInt(firstArrival.split(':')[0]);
    const secondHour = parseInt(secondArrival.split(':')[0]);
    expect(firstHour).toBeGreaterThanOrEqual(24);
    expect(secondHour).toBeGreaterThanOrEqual(24);
});
