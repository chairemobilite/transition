/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import { ScheduleAttributes } from '../Schedule';

const defaultLineId = uuidV4();
const defaultServiceId = uuidV4();
const defaultPathId = uuidV4();
const defaultScheduleId = uuidV4();
const periodIds = [uuidV4(), uuidV4(), uuidV4()];

// FIXME: departure/arrival times need to be set to number[] even if they have null. Make sure ScheduleAttributes have the proper types or review how times are used.
export const getScheduleAttributes: (params: any) => ScheduleAttributes = ({
    lineId = defaultLineId,
    serviceId = defaultServiceId,
    pathId = defaultPathId,
    scheduleId = defaultScheduleId
}) => {
    return {
        id: scheduleId,
        allow_seconds_based_schedules: false,
        line_id: lineId,
        service_id: serviceId,
        is_frozen: false,
        periods_group_shortname: 'default',
        data: {},
        periods: [{
            // Period with start and end hours and multiple trips
            id: periodIds[0],
            schedule_id: scheduleId,
            inbound_path_id: undefined,
            outbound_path_id: pathId,
            interval_seconds: 1800,        
            period_shortname: "morning",
            start_at_hour: 7,
            end_at_hour: 12,
            data: {},
            trips: [{
                id: uuidV4(),
                schedule_id: scheduleId,
                schedule_period_id: periodIds[0],
                data: {},
                path_id: pathId,
                departure_time_seconds: 25200,
                arrival_time_seconds: 27015,
                node_arrival_times_seconds: [null, 25251, 26250, 27015] as number[],
                node_departure_times_seconds: [25200, 25261, 26260, null] as number[],
                nodes_can_board: [true, true, true, false],
                nodes_can_unboard: [false, true, true, true],
                seated_capacity: 20,
                total_capacity: 50
            }, {
                id: uuidV4(),
                schedule_id: scheduleId,
                schedule_period_id: periodIds[0],
                data: {},
                path_id: pathId,
                departure_time_seconds: 30601,
                arrival_time_seconds: 32416,
                node_arrival_times_seconds: [null, 30652, 31650, 32416] as number[],
                node_departure_times_seconds: [30601, 30662, 31660, null] as number[],
                nodes_can_board: [true, true, true, false],
                nodes_can_unboard: [false, true, true, true],
                seated_capacity: 20,
                total_capacity: 50
            }, {
                id: uuidV4(),
                schedule_id: scheduleId,
                schedule_period_id: periodIds[0],
                data: {},
                path_id: pathId,
                arrival_time_seconds: 34216,
                departure_time_seconds: 32401,
                node_arrival_times_seconds: [null, 32452, 33450, 34216] as number[],
                node_departure_times_seconds: [32401, 32462, 33460, null] as number[],
                nodes_can_board: [true, true, true, false],
                nodes_can_unboard: [false, true, true, true],
                seated_capacity: 20,
                total_capacity: 50
            }]
        }, {
            id: periodIds[1],
            schedule_id: scheduleId,
            // Period with custom start and end, with a single trip
            custom_start_at_str: "13:15",
            custom_end_at_str: "17:24",
            end_at_hour: 18,
            inbound_path_id: undefined,
            number_of_units: 4,
            outbound_path_id: pathId,
            period_shortname: "midday",
            start_at_hour: 13,
            data: {},
            trips: [{
                id: uuidV4(),
                schedule_id: scheduleId,
                schedule_period_id: periodIds[1],
                data: {},
                path_id: pathId,
                arrival_time_seconds: 50000,
                departure_time_seconds: 48000,
                node_arrival_times_seconds: [null, 48050, 49450, 50000] as number[],
                node_departure_times_seconds: [48000, 48060, 49460, null] as number[],
                nodes_can_board: [true, true, true, false],
                nodes_can_unboard: [false, true, true, true],
                seated_capacity: 20,
                total_capacity: 50
            }]
        }, {
            // Period with custom start and end, without trips
            id: periodIds[2],
            schedule_id: scheduleId,
            data: {},
            custom_start_at_str: '18:00',
            custom_end_at_str: '23:00',
            end_at_hour: 23,
            inbound_path_id: undefined,
            interval_seconds: 1800,
            outbound_path_id: pathId,
            period_shortname: "pm_peaks",
            start_at_hour: 18,
            trips: []
        }],
    };
};

test('Dummy schedule data test', () => {
    // Dummy test so this file passes
})