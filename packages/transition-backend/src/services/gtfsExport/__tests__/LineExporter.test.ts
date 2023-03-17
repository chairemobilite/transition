/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createWriteStream } from 'fs';
import { v4 as uuidV4 } from 'uuid';

import { exportLine } from '../LineExporter';
import { LineAttributes } from 'transition-common/lib/services/line/Line';

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
const mockWriteStream = {
    write: jest.fn().mockImplementation((chunk) => {
      
    }),
    end: jest.fn()
};
const mockCreateStream = createWriteStream as jest.MockedFunction<any>;
mockCreateStream.mockReturnValue(mockWriteStream);

const agencyId = uuidV4();
const agencyGtfsSlug = 'FooAgency';

export const lineAttributes1 = {
    id: uuidV4(),
    shortname: 'L1',
    longname: 'Main Street',
    agency_id: agencyId,
    mode: 'bus',
    path_ids: [],
    category: 'C',
    allow_same_line_transfers: false,
    is_autonomous: true,
    color: '#112233',
    data: {
        gtfs: {
            route_id: 'Orig',
            agency_id: 'OrigAg',
            route_type: 3,
            route_url: 'https://foo.com',
            route_color: '112233',
            route_text_color: '123456',
            route_sort_order: 3,
            continuous_pickup: 0,
            continuous_drop_off: 0
        }
    },
    scheduleByServiceId: { },
    is_frozen: false
};

export const lineAttributes2: LineAttributes = {
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
        
        other: 'some field'
    },
    service_ids: [uuidV4(), uuidV4()],
    scheduleByServiceId: { },
    is_frozen: false,
    created_at: '2021-07-23T09:59:00.182Z',
    updated_at: '2021-07-23T10:17:00.182Z'
};

export const lineAttributesNotForExport: LineAttributes = {
    id: uuidV4(),
    agency_id: agencyId,
    is_frozen: false,
    mode: 'transferable',
    path_ids: [uuidV4(), uuidV4()],
    category: 'C',
    allow_same_line_transfers: false,
    is_autonomous: true,
    longname: 'Main Street',
    service_ids: [],
    data: {},
    scheduleByServiceId: { },
};

jest.mock('../../../models/db/transitLines.db.queries', () => {
    return {
        collection: jest.fn().mockImplementation(async () => {
            return [lineAttributes1, lineAttributes2, lineAttributesNotForExport];
        })
    }
});

const agencyToGtfsId = { [agencyId]: agencyGtfsSlug };

beforeEach(() => {
    mockWriteStream.write.mockClear();
    mockWriteStream.end.mockClear();
    mockCreateStream.mockClear();
})

test('Test exporting one line originally from gtfs', async () => {
    const response = await exportLine([lineAttributes1.id], { directoryPath: 'test', quotesFct: quoteFct, agencyToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).serviceIds).toEqual([]);
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"route_id","agency_id","route_short_name","route_long_name","route_desc","route_type","route_url","route_color","route_text_color","route_sort_order","continuous_pickup","continuous_drop_off"',
        `"${lineAttributes1.id}","${agencyGtfsSlug}","${lineAttributes1.shortname}","${lineAttributes1.longname}",,3,"${lineAttributes1.data.gtfs.route_url}","112233","${lineAttributes1.data.gtfs.route_text_color}",${lineAttributes1.data.gtfs.route_sort_order},${lineAttributes1.data.gtfs.continuous_pickup},${lineAttributes1.data.gtfs.continuous_drop_off}`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/routes.txt'));
});

test('Test exporting a line not from gtfs with custom fields', async () => {
    const response = await exportLine([lineAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct, includeTransitionFields: true, agencyToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).serviceIds).toEqual(lineAttributes2.service_ids);
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"route_id","agency_id","route_short_name","route_long_name","route_desc","route_type","route_url","route_color","route_text_color","route_sort_order","continuous_pickup","continuous_drop_off","tr_route_internal_id","tr_route_row_category","tr_is_autonomous","tr_allow_same_route_transfers"',
        `"${lineAttributes2.id}","${agencyGtfsSlug}","${lineAttributes2.shortname}","${lineAttributes2.longname}",,3,,,,,,,,"${lineAttributes2.category}","${lineAttributes2.is_autonomous}","${lineAttributes2.allow_same_line_transfers}"`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/routes.txt'));
});

test('Test exporting multiple lines, with transferable that should not be exported', async () => {
    const response = await exportLine([lineAttributes1.id, lineAttributes2.id, lineAttributesNotForExport.id], { directoryPath: 'test', quotesFct: quoteFct, agencyToGtfsId });
    expect(response.status).toEqual('success');
    expect((response as any).serviceIds).toEqual(lineAttributes2.service_ids);
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"route_id","agency_id","route_short_name","route_long_name","route_desc","route_type","route_url","route_color","route_text_color","route_sort_order","continuous_pickup","continuous_drop_off"',
        `"${lineAttributes1.id}","${agencyGtfsSlug}","${lineAttributes1.shortname}","${lineAttributes1.longname}",,3,"${lineAttributes1.data.gtfs.route_url}","112233","${lineAttributes1.data.gtfs.route_text_color}",${lineAttributes1.data.gtfs.route_sort_order},${lineAttributes1.data.gtfs.continuous_pickup},${lineAttributes1.data.gtfs.continuous_drop_off}`,
        `"${lineAttributes2.id}","${agencyGtfsSlug}","${lineAttributes2.shortname}","${lineAttributes2.longname}",,3,,,,,,`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/routes.txt'));
});

test('Test exporting unknown lines', async () => {
    const response = await exportLine([uuidV4()], { directoryPath: 'test', quotesFct: quoteFct, agencyToGtfsId });
    expect(response.status).toEqual('error');
    expect(mockWriteStream.write).not.toHaveBeenCalled();
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/routes.txt'));
});
