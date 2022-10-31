/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createWriteStream } from 'fs';
import { v4 as uuidV4 } from 'uuid';

import { exportService } from '../ServiceExporter';

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

const serviceAttributes1 = {
    id: uuidV4(),
    name: 'AC1',
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_date: '2020-01-01',
    end_date: '2020-12-31',
    data: {
        gtfs: {
            service_id: 'AC1'
        }
    },
    is_frozen: false
};

const serviceAttributes2= {
    id: uuidV4(),
    name: 'AC2 ALLO with spaces and éèàê',
    description: 'descAC2',
    monday: false,
    tuesday: false,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_date: '2021-09-01',
    end_date: '2021-12-31',
    only_dates: ['2021-12-01', '2021-12-02', '2021-12-04'],
    except_dates: ['2021-12-03', '2021-12-05'],
    color: '#ff0000',
    data: {
        foo: 'bar'
    },
    is_frozen: true
};
const sluggedId = 'AC2-ALLO-with-spaces-and-eeae';

jest.mock('../../../models/db/transitServices.db.queries', () => {
    return {
        collection: jest.fn().mockImplementation(async () => {
            return [serviceAttributes1, serviceAttributes2];
        })
    }
});

beforeEach(() => {
    mockWriteStream.write.mockClear();
    mockWriteStream.end.mockClear();
    mockCreateStream.mockClear();
})

test('Test exporting a service originally from gtfs', async () => {
    const response = await exportService([serviceAttributes1.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect((response as any).serviceToGtfsId).toEqual({ [serviceAttributes1.id]: serviceAttributes1.name });
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"service_id","start_date","end_date","monday","tuesday","wednesday","thursday","friday","saturday","sunday"',
        `"${serviceAttributes1.name}","20200101","20201231",1,1,1,1,1,0,0`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/calendar.txt'));
});

test('Test exporting a service not from gtfs with custom fields', async () => {
    const response = await exportService([serviceAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct, includeTransitionFields: true });
    expect(response.status).toEqual('success');
    expect((response as any).serviceToGtfsId).toEqual({ [serviceAttributes2.id]: sluggedId });
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"service_id","start_date","end_date","monday","tuesday","wednesday","thursday","friday","saturday","sunday","tr_service_desc","tr_service_color"',
        `"${sluggedId}","20210901","20211231",0,0,1,1,1,0,0,"${serviceAttributes2.description}","${serviceAttributes2.color}"`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/calendar.txt'));
});

test('Test exporting multiple services', async () => {
    const response = await exportService([serviceAttributes1.id, serviceAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect((response as any).serviceToGtfsId).toEqual({ [serviceAttributes1.id]: serviceAttributes1.name, [serviceAttributes2.id]: sluggedId });
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"service_id","start_date","end_date","monday","tuesday","wednesday","thursday","friday","saturday","sunday"',
        `"${serviceAttributes1.name}","20200101","20201231",1,1,1,1,1,0,0`,
        `"${sluggedId}","20210901","20211231",0,0,1,1,1,0,0`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/calendar.txt'));
});

test('Test exporting unknown services', async () => {
    const response = await exportService([uuidV4()], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('error');
    expect(mockWriteStream.write).not.toHaveBeenCalled();
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/calendar.txt'));
});
