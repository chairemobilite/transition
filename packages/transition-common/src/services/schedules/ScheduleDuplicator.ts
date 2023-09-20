/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidV4 } from 'uuid';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

import Schedule from './Schedule';

export interface DuplicateScheduleOptions {
    lineId?: string | false;
    serviceId?: string | false;
    pathIdsMapping?: { [key: string]: string };
}

/**
 * duplicate a schedule object, with all trips and periods
 */
export const duplicateSchedule = async (
    baseSchedule: Schedule,
    { lineId = false, serviceId = false, pathIdsMapping = {} }: DuplicateScheduleOptions
): Promise<Schedule> => {
    const newScheduleAttribs = baseSchedule.getClonedAttributes(true);
    newScheduleAttribs.id = uuidV4();

    if (serviceId) newScheduleAttribs.service_id = serviceId;
    if (lineId) newScheduleAttribs.line_id = lineId;

    if (newScheduleAttribs.periods) {
        for (let periodI = 0, countPeriods = newScheduleAttribs.periods.length; periodI < countPeriods; periodI++) {
            const period = newScheduleAttribs.periods[periodI];
            period.id = uuidV4();
            period.schedule_id = newScheduleAttribs.id;

            if (period.inbound_path_id && pathIdsMapping[period.inbound_path_id]) {
                period.inbound_path_id = pathIdsMapping[period.inbound_path_id];
            }
            if (period.outbound_path_id && pathIdsMapping[period.outbound_path_id]) {
                period.outbound_path_id = pathIdsMapping[period.outbound_path_id];
            }
            if (period.trips) {
                for (let tripI = 0, countTrips = period.trips.length; tripI < countTrips; tripI++) {
                    const trip = period.trips[tripI];
                    trip.id = uuidV4();
                    trip.schedule_period_id = period.id;
                    trip.schedule_id = newScheduleAttribs.id;
                    if (trip.path_id && pathIdsMapping[trip.path_id]) {
                        trip.path_id = pathIdsMapping[trip.path_id];
                    }
                }
            }
        }
    }
    return new Schedule(newScheduleAttribs, true);
};
