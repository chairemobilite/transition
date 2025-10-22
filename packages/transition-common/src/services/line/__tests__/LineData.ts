/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { LineAttributes } from '../Line';

export const agencyId = uuidV4();

export const lineAttributesBaseData = {
    id: uuidV4(),
    shortname: 'L1',
    longname: 'Main Street',
    agency_id: agencyId,
    mode: 'bus',
    path_ids: [],
    category: 'C',
    allow_same_line_transfers: false,
    is_autonomous: true,
    data: {},
    scheduleByServiceId: { },
    is_frozen: false
} as LineAttributes;

export const lineAttributesMinimalData = {
    id: uuidV4(),
    is_frozen: false
} as LineAttributes;

export const lineAttributesWithPathAndSchedule = {
    id: uuidV4(),
    shortname: 'L1',
    longname: 'Main Street',
    agency_id: agencyId,
    mode: 'bus',
    path_ids: [uuidV4(), uuidV4()],
    category: 'C',
    allow_same_line_transfers: false,
    is_autonomous: true,
    data: {
        other: 'some field',
        gtfs: {
            route_id: 'R1',
            route_type: 200
        }
    },
    scheduleByServiceId: { },
    is_frozen: false,
    created_at: '2021-07-23T09:59:00.182Z',
    updated_at: '2021-07-23T10:17:00.182Z'
} as LineAttributes;
