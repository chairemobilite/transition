/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createWriteStream } from 'fs';
import { v4 as uuidV4 } from 'uuid';

import { exportAgency } from '../AgencyExporter';

jest.mock('fs', () => {
    // Require the original module to not be mocked for config file existence check...
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

const agencyAttributes1 = {
    id: uuidV4(),
    acronym: 'AC1',
    name: 'Agency1',
    line_ids: [uuidV4(), uuidV4()],
    unit_ids: [],
    garage_ids: [],
    data: {
        gtfs: {
            agency_email: 'test@test.agency',
            agency_url: 'http://test.test.agency',
            agency_timezone: 'America/Montreal',
            agency_fare_url: 'http://test.test.agency.fare',
            agency_phone: '+1 999-999-9999',
            agency_lang: 'fr'
        }
    },
    is_frozen: false
};

const agencyAttributes2= {
    id: uuidV4(),
    acronym: 'AC2 ALLO with spaces and éèàê',
    name: 'Agency2',
    description: 'descAC2',
    internal_id: '1234AAA',
    line_ids: [],
    unit_ids: [uuidV4(), uuidV4()],
    garage_ids: [uuidV4(), uuidV4()],
    color: '#ff0000',
    data: {
        foo: 'bar'
    },
    is_frozen: true
};
const sluggedId = 'AC2-ALLO-with-spaces-and-eeae';

jest.mock('../../../models/db/transitAgencies.db.queries', () => {
    return {
        collection: jest.fn().mockImplementation(async () => {
            return [agencyAttributes1, agencyAttributes2];
        })
    }
});

beforeEach(() => {
    mockWriteStream.write.mockClear();
    mockWriteStream.end.mockClear();
    mockCreateStream.mockClear();
})

test('Test exporting one agency originally from gtfs', async () => {
    const response = await exportAgency([agencyAttributes1.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect((response as any).lineIds).toEqual(agencyAttributes1.line_ids);
    expect((response as any).agencyToGtfsId).toEqual({ [agencyAttributes1.id]: agencyAttributes1.acronym });
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"agency_id","agency_name","agency_url","agency_timezone","agency_lang","agency_phone","agency_fare_url","agency_email"',
        `"${agencyAttributes1.acronym}","${agencyAttributes1.name}","${agencyAttributes1.data.gtfs.agency_url}","${agencyAttributes1.data.gtfs.agency_timezone}","${agencyAttributes1.data.gtfs.agency_lang}","${agencyAttributes1.data.gtfs.agency_phone}","${agencyAttributes1.data.gtfs.agency_fare_url}","${agencyAttributes1.data.gtfs.agency_email}"`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/agency.txt'));
});

test('Test exporting an agency not from gtfs with custom fields', async () => {
    const response = await exportAgency([agencyAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct, includeTransitionFields: true });
    expect(response.status).toEqual('success');
    expect((response as any).lineIds).toEqual(agencyAttributes2.line_ids);
    expect((response as any).agencyToGtfsId).toEqual({ [agencyAttributes2.id]: sluggedId });
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"agency_id","agency_name","agency_url","agency_timezone","agency_lang","agency_phone","agency_fare_url","agency_email","tr_agency_color","tr_agency_description"',
        `"${sluggedId}","${agencyAttributes2.name}","","",,,,,"${agencyAttributes2.color}","${agencyAttributes2.description}"`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/agency.txt'));
});

test('Test exporting multiple agencies', async () => {
    const response = await exportAgency([agencyAttributes1.id, agencyAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect((response as any).lineIds).toEqual([...agencyAttributes1.line_ids, ...agencyAttributes2.line_ids]);
    expect((response as any).agencyToGtfsId).toEqual({ [agencyAttributes1.id]: agencyAttributes1.acronym, [agencyAttributes2.id]: sluggedId });
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"agency_id","agency_name","agency_url","agency_timezone","agency_lang","agency_phone","agency_fare_url","agency_email"',
        `"${agencyAttributes1.acronym}","${agencyAttributes1.name}","${agencyAttributes1.data.gtfs.agency_url}","${agencyAttributes1.data.gtfs.agency_timezone}","${agencyAttributes1.data.gtfs.agency_lang}","${agencyAttributes1.data.gtfs.agency_phone}","${agencyAttributes1.data.gtfs.agency_fare_url}","${agencyAttributes1.data.gtfs.agency_email}"`,
        `"${sluggedId}","${agencyAttributes2.name}","","",,,,`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/agency.txt'));
});

test('Test exporting unknown agencies', async () => {
    const response = await exportAgency([uuidV4()], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('error');
    expect(mockWriteStream.write).not.toHaveBeenCalled();
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/agency.txt'));
});
