/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _uniq from 'lodash/uniq';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { validate as uuidValidate } from 'uuid';

/**
 * This class serves to validate all attributes in a scheduleByServiceId[serviceId] object
 *
 * @export
 * @class ScheduleDataValidator
 */
export default class ScheduleDataValidator {
    static validate(scheduleData: { [key: string]: any }, pathObject?: any): { isValid: boolean; errors: string[] } {
        // TODO: change any to Path object when it will be available in ts

        let isValid = true;
        const errors: string[] = [];

        // schedule atributes:
        if (_isBlank(scheduleData.id) || !uuidValidate(scheduleData.id)) {
            // required
            isValid = false;
            errors.push('ScheduleDataValidator: id is blank or not a valid uuid');
        }
        if (_isBlank(scheduleData.service_id) || !uuidValidate(scheduleData.service_id)) {
            // required
            isValid = false;
            errors.push('ScheduleDataValidator: service_id is blank or not a valid uuid');
        }
        if (
            !_isBlank(scheduleData.allow_seconds_based_schedules) &&
            typeof scheduleData.allow_seconds_based_schedules !== 'boolean'
        ) {
            // optional, but must be bool
            isValid = false;
            errors.push('ScheduleDataValidator: allow_seconds_based_schedules is not a boolean');
        }
        if (
            _isBlank(scheduleData.periods_group_shortname) ||
            typeof scheduleData.periods_group_shortname !== 'string'
        ) {
            // required and must be string
            isValid = false;
            errors.push('ScheduleDataValidator: periods_group_shortname is blank or not a string');
        }
        if (!_isBlank(scheduleData.is_frozen) && typeof scheduleData.is_frozen !== 'boolean') {
            // optional, but must be bool
            isValid = false;
            errors.push('ScheduleDataValidator: is_frozen is not a boolean');
        }

        // periods attributes:
        const periods = scheduleData.periods;

        if (_isBlank(periods) || !Array.isArray(periods)) {
            // required and must be an array
            isValid = false;
            errors.push('ScheduleDataValidator: periods is blank or not an array');
        }
        for (let i = 0, countI = periods.length; i < countI; i++) {
            const periodData = periods[i];

            if (_isBlank(periodData.outbound_path_id) || !uuidValidate(periodData.outbound_path_id)) {
                // required
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: outbound_path_id is blank or not a valid uuid');
            }
            if (!_isBlank(periodData.inbound_path_id) && !uuidValidate(periodData.inbound_path_id)) {
                // optional, but must be a valid uuid
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: inbound_path_id is not a valid uuid');
            }
            if (_isBlank(periodData.period_shortname) || typeof periodData.period_shortname !== 'string') {
                // required and but must be a string
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: period_shortname is not a string');
            }
            if (_isBlank(periodData.interval_seconds) && _isBlank(periodData.number_of_units)) {
                // there must be at least interval or number of units
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: both interval_seconds and number_of_units are empty');
            }
            if (!_isBlank(periodData.interval_seconds) && typeof periodData.interval_seconds !== 'number') {
                // interval must be a number
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: interval_seconds must be a number');
            }
            if (!_isBlank(periodData.number_of_units) && typeof periodData.number_of_units !== 'number') {
                // number of units must be a number
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: number_of_units must be a number');
            }
            if (_isBlank(periodData.start_at_hour) || typeof periodData.start_at_hour !== 'number') {
                // required and must be a number
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: start_at_hour is blank or not a number');
            }
            if (_isBlank(periodData.end_at_hour) || typeof periodData.end_at_hour !== 'number') {
                // required and must be a number
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: end_at_hour is blank or not a number');
            }
            if (!_isBlank(periodData.custom_start_at_str) && typeof periodData.custom_start_at_str !== 'string') {
                // optional, but must be a string
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: custom_start_at_str is not a string');
            }
            if (!_isBlank(periodData.custom_end_at_str) && typeof periodData.custom_end_at_str !== 'string') {
                // optional, but must be a string
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: custom_end_at_str is not a string');
            }
            if (!_isBlank(periodData.is_frozen) && typeof periodData.is_frozen !== 'boolean') {
                // optional, but must be bool
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: is_frozen is not a boolean');
            }

            // trips attributes:
            const trips = periodData.trips || [];
            //console.log("Trips: ", trips);
            if (!Array.isArray(trips)) {
                // required and must be an array
                isValid = false;
                errors.push('ScheduleDataValidator: Period data: trips is not an array');
            }
            for (let j = 0, countJ = trips.length; j < countJ; j++) {
                const tripData = trips[j];
                if (_isBlank(tripData.id) || !uuidValidate(tripData.id)) {
                    // required
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: id is blank or not a valid uuid');
                }
                if (_isBlank(tripData.path_id) || !uuidValidate(tripData.path_id)) {
                    // required
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: path_id is not a valid uuid');
                }
                if (!_isBlank(tripData.block_id) && !uuidValidate(tripData.block_id)) {
                    // optional, but must be a uuid
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: block_id is not a valid uuid');
                }
                if (_isBlank(tripData.arrival_time_seconds) || typeof tripData.arrival_time_seconds !== 'number') {
                    // required, mut be a number
                    isValid = false;
                    errors.push(
                        'ScheduleDataValidator: Period data: Trip data: arrival_time_seconds is not a valid uuid'
                    );
                }
                if (_isBlank(tripData.departure_time_seconds) || typeof tripData.departure_time_seconds !== 'number') {
                    // required, mut be a number
                    isValid = false;
                    errors.push(
                        'ScheduleDataValidator: Period data: Trip data: departure_time_seconds is not a valid uuid'
                    );
                }
                if (!_isBlank(tripData.block_id) && !uuidValidate(tripData.block_id)) {
                    // optional, but must be a uuid
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: block_id is not a valid uuid');
                }
                if (
                    _isBlank(tripData.node_arrival_times_seconds) ||
                    !Array.isArray(tripData.node_arrival_times_seconds)
                ) {
                    // required, must be an array
                    isValid = false;
                    errors.push(
                        'ScheduleDataValidator: Period data: Trip data: node_arrival_times_seconds is blank or not an array'
                    );
                }
                if (
                    _isBlank(tripData.node_departure_times_seconds) ||
                    !Array.isArray(tripData.node_departure_times_seconds)
                ) {
                    // required, must be an array
                    isValid = false;
                    errors.push(
                        'ScheduleDataValidator: Period data: Trip data: node_departure_times_seconds is blank or not an array'
                    );
                }
                if (_isBlank(tripData.nodes_can_board) || !Array.isArray(tripData.nodes_can_board)) {
                    // required, must be an array
                    isValid = false;
                    errors.push(
                        'ScheduleDataValidator: Period data: Trip data: nodes_can_board is blank or not an array'
                    );
                }
                if (_isBlank(tripData.nodes_can_unboard) || !Array.isArray(tripData.nodes_can_unboard)) {
                    // required, must be an array
                    isValid = false;
                    errors.push(
                        'ScheduleDataValidator: Period data: Trip data: nodes_can_unboard is blank or not an array'
                    );
                }
                if (!_isBlank(tripData.is_frozen) && typeof tripData.is_frozen !== 'boolean') {
                    // optional, but must be bool
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: is_frozen is not a boolean');
                }
                if (!_isBlank(tripData.seated_capacity) && typeof tripData.seated_capacity !== 'number') {
                    // optional, but must be a number
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: seated_capacity is not a number');
                }
                if (!_isBlank(tripData.total_capacity) && typeof tripData.total_capacity !== 'number') {
                    // optional, but must be a number
                    isValid = false;
                    errors.push('ScheduleDataValidator: Period data: Trip data: total_capacity is not a number');
                }
                if (pathObject) {
                    // if the path is injected, we can validate the nodes size with the arrival/deparutre/can_board/can_unboard arrays sizes
                    const pathNodesLength = pathObject.get('nodes', []).length;

                    if (tripData.node_arrival_times_seconds.length !== pathNodesLength) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: node_arrival_times_seconds array is not the same size as the path nodes array'
                        );
                    }
                    if (tripData.node_departure_times_seconds.length !== pathNodesLength) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: node_departure_times_seconds array is not the same size as the path nodes array'
                        );
                    }
                    if (tripData.nodes_can_board.length !== pathNodesLength) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: nodes_can_board array is not the same size as the path nodes array'
                        );
                    }
                    if (tripData.nodes_can_unboard.length !== pathNodesLength) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: nodes_can_unboard array is not the same size as the path nodes array'
                        );
                    }
                } else {
                    const nodeArrivalTimesSecondsArrayLength = tripData.node_arrival_times_seconds.length;
                    if (nodeArrivalTimesSecondsArrayLength !== tripData.node_departure_times_seconds.length) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: node_departure_times_seconds array is not the same size as the node_arrival_times_seconds array'
                        );
                    }
                    if (nodeArrivalTimesSecondsArrayLength !== tripData.nodes_can_board.length) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: nodes_can_board array is not the same size as the node_arrival_times_seconds array'
                        );
                    }
                    if (nodeArrivalTimesSecondsArrayLength !== tripData.nodes_can_unboard.length) {
                        isValid = false;
                        errors.push(
                            'ScheduleDataValidator: Period data: Trip data: nodes_can_unboard array is not the same size as the node_arrival_times_seconds array'
                        );
                    }
                }
            }
        }

        const uniqErrors = _uniq(errors);

        if (errors.length > 0) {
            console.error(uniqErrors);
        }

        return { isValid, errors: uniqErrors };
    }
}
