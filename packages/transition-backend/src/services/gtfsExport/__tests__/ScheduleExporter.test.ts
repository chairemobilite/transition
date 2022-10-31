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
    write: jest.fn().mockImplementation((chunk) => {
      
    }),
    end: jest.fn()
};
const mockWriteStopTimeStream = {
    write: jest.fn().mockImplementation((chunk) => {
      
    }),
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

// Schedule with many periods/trips, but one path
const scheduleAttributes1: ScheduleAttributes = {
    allow_seconds_based_schedules: false,
    id: uuidV4(),
    line_id: lineId,
    service_id: serviceId,
    is_frozen: false,
    data: {},
    periods: [{
        // Period with start and end hours and multiple trips
        schedule_id: uuidV4(),
        id: uuidV4(),
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
            schedule_id: uuidV4(),
            schedule_period_id: uuidV4(),
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
            schedule_id: uuidV4(),
            schedule_period_id: uuidV4(),
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
            schedule_id: uuidV4(),
            schedule_period_id: uuidV4(),
            data: {}
        }]
    }, {
        schedule_id: uuidV4(),
        id: uuidV4(),
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
            schedule_id: uuidV4(),
            schedule_period_id: uuidV4(),
            data: {}
        }]
    }, {
        // Period with custom start and end, without trips
        schedule_id: uuidV4(),
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
const scheduleAttributes2: ScheduleAttributes = {
    allow_seconds_based_schedules: false,
    id: uuidV4(),
    line_id: lineId,
    service_id: serviceId2,
    is_frozen: false,
    data: {},
    periods: [{
        schedule_id: uuidV4(),
        id: uuidV4(),
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
            schedule_id: uuidV4(),
            schedule_period_id: uuidV4(),
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
            schedule_id: uuidV4(),
            schedule_period_id: uuidV4(),
            data: {}
        }]
    }],
    periods_group_shortname: "all_day",
};

let schedulesToReturn: ScheduleAttributes[] = [];
jest.mock('../../../models/db/transitSchedules.db.queries', () => {
    return {
        readForLines: jest.fn().mockImplementation(async () => {
            return schedulesToReturn;
        })
    }
});

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
    mockWriteTripStream.write.mockClear();
    mockWriteTripStream.end.mockClear();
    mockWriteStopTimeStream.write.mockClear();
    mockWriteStopTimeStream.end.mockClear();
    mockCreateStream.mockClear();
})

test('Test exporting one schedule', async () => {
    schedulesToReturn = [scheduleAttributes1];
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
    ].join('\n'));
    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    // Match strings for each trip individually, to better catch errors in one trip
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        '"trip_id","arrival_time","departure_time","stop_id","stop_sequence","stop_headsign","pickup_type","drop_off_type","continuous_pickup","continuous_drop_off","shape_dist_traveled","timepoint"',
        `"${scheduleAttributes1.periods[0].trips[0].id}",,"7:00:00","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:00:51","7:01:01","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:17:30","7:17:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[0].trips[0].id}","7:30:15",,"${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes1.periods[0].trips[1].id}",,"8:30:01","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[0].trips[1].id}","8:30:52","8:31:02","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[0].trips[1].id}","8:47:30","8:47:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[0].trips[1].id}","9:00:16",,"${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes1.periods[0].trips[2].id}",,"9:00:01","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:00:52","9:01:02","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:17:30","9:17:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[0].trips[2].id}","9:30:16",,"${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes1.periods[1].trips[0].id}",,"13:20:00","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:20:50","13:21:00","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:44:10","13:44:20","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes1.periods[1].trips[0].id}","13:53:20",,"${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting one schedule including multiple paths', async () => {
    schedulesToReturn = [scheduleAttributes2];
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([...pathAttributes.nodes, ...pathAttributes2.nodes]);
    expect((response as any).pathIds).toEqual([pathAttributes.id, pathAttributes2.id]);

    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteTripStream.write).toHaveBeenLastCalledWith([
        '"route_id","service_id","trip_id","trip_headsign","trip_short_name","direction_id","block_id","shape_id","wheelchair_accessible","bikes_allowed"',
        `"${lineId}","${sluggedServiceId2}","${scheduleAttributes2.periods[0].trips[0].id}","${pathAttributes.name}",,0,"${scheduleAttributes2.periods[0].trips[0].block_id}","${scheduleAttributes2.periods[0].trips[0].path_id}",,`,
        `"${lineId}","${sluggedServiceId2}","${scheduleAttributes2.periods[0].trips[1].id}","${pathAttributes.name}",,0,"${scheduleAttributes2.periods[0].trips[1].block_id}","${scheduleAttributes2.periods[0].trips[1].path_id}",,`,
    ].join('\n'));
    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    // Match strings for each trip individually, to better catch errors in one trip
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        '"trip_id","arrival_time","departure_time","stop_id","stop_sequence","stop_headsign","pickup_type","drop_off_type","continuous_pickup","continuous_drop_off","shape_dist_traveled","timepoint"',
        `"${scheduleAttributes2.periods[0].trips[0].id}",,"7:00:00","${pathAttributes.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:00:51","7:01:01","${pathAttributes.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:17:30","7:17:40","${pathAttributes.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes2.periods[0].trips[0].id}","7:30:15",,"${pathAttributes.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockWriteStopTimeStream.write).toHaveBeenLastCalledWith(expect.stringContaining([
        `"${scheduleAttributes2.periods[0].trips[1].id}",,"7:00:00","${pathAttributes2.nodes[0]}",1,,0,1,1,1,${pathDistances[0]},1`,
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:00:51","7:01:01","${pathAttributes2.nodes[1]}",2,,0,0,1,1,${pathDistances[1]},1`,
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:17:30","7:17:40","${pathAttributes2.nodes[2]}",3,,0,0,1,1,${pathDistances[2]},1`,
        `"${scheduleAttributes2.periods[0].trips[1].id}","7:30:15",,"${pathAttributes2.nodes[3]}",4,,1,0,1,1,${pathDistances[4]},1`,
    ].join('\n')));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting multiple schedules', async () => {
    schedulesToReturn = [scheduleAttributes1, scheduleAttributes2];
    const response = await exportSchedule([lineId], { directoryPath: 'test', quotesFct: quoteFct, serviceToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).nodeIds).toEqual([...pathAttributes.nodes, ...pathAttributes2.nodes]);
    expect((response as any).pathIds).toEqual([pathAttributes.id, pathAttributes2.id]);

    expect(mockWriteTripStream.write).toHaveBeenCalledTimes(1);
    // Make sure the number of lines matches (6 trips + header)
    expect((mockWriteTripStream.write.mock.calls[0][0] as string).split('\n').length).toEqual(7);

    expect(mockWriteStopTimeStream.write).toHaveBeenCalledTimes(1);
    // Make sure the number of lines matches (6 trips * 4 stops + header)
    expect((mockWriteStopTimeStream.write.mock.calls[0][0] as string).split('\n').length).toEqual(25);

    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/trips.txt'));
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stop_times.txt'));
});

test('Test exporting a schedule with an unknown path', async () => {
    const unknownPathId = uuidV4();
    const schedulesWithNoPath = Object.assign({}, scheduleAttributes2);
    schedulesWithNoPath.periods[0].trips.forEach((trip, index) => schedulesWithNoPath.periods[0].trips[index].path_id = unknownPathId);
    schedulesToReturn = [schedulesWithNoPath];
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
    schedulesToReturn = [];
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
