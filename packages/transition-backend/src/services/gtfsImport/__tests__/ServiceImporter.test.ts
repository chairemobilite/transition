/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import Service, { ServiceAttributes } from 'transition-common/lib/services/service/Service';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import each from 'jest-each';

import { gtfsValidSimpleData, defaultImportData, defaultInternalImportData, gtfsValidTransitionGeneratedData } from './GtfsImportData.test';
import ServiceImporter, { gtfsToObjectAttributes } from '../ServiceImporter';
import Line from 'transition-common/lib/services/line/Line';
import { getUniqueServiceName } from '../../transitObjects/transitServices/ServiceUtils';

let currentData: any = gtfsValidSimpleData;
const serviceSaveFct = Service.prototype.save = jest.fn();

jest.mock('chaire-lib-backend/lib/services/files/CsvFile', () => {
    return {
        parseCsvFile: jest.fn().mockImplementation(async (filePath, rowCallback, _options) => {
            const data = currentData[filePath];
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});

jest.mock('../../transitObjects/transitServices/ServiceUtils', () => ({
    getUniqueServiceName: jest.fn().mockImplementation((name: string) => name)
}));
const mockGetUniqueServiceName = getUniqueServiceName as jest.MockedFunction<typeof getUniqueServiceName>;

const lines = new LineCollection([], {});
const importedAgencyId = uuidV4();
const internalImportData = _cloneDeep(defaultInternalImportData);
internalImportData.agencyIdsByAgencyGtfsId['AGENCY'] = importedAgencyId;
const existingLineAttributes = {
    id: uuidV4(),
    agency_id: importedAgencyId
};

const convertToServiceAttributes = (data) => {
    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday,  ...rest } = data;
    return gtfsToObjectAttributes({ 
        monday: parseInt(monday), 
        tuesday: parseInt(tuesday), 
        wednesday: parseInt(wednesday), 
        thursday: parseInt(thursday), 
        friday: parseInt(friday), 
        saturday: parseInt(saturday), 
        sunday: parseInt(sunday), 
        ...rest });
} 

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GTFS Service import preparation', () => {
    test('Test prepare service data, only calendar file', async () => {
        currentData = gtfsValidSimpleData
        const collection = new ServiceCollection([], {})

        const importer = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(1);
        expect(data).toEqual([ 
            { 
                service: {
                    name: gtfsValidSimpleData['calendar.txt'][0].service_id,
                    monday: parseInt(gtfsValidSimpleData['calendar.txt'][0].monday) === 1, 
                    tuesday: parseInt(gtfsValidSimpleData['calendar.txt'][0].tuesday) === 1, 
                    wednesday: parseInt(gtfsValidSimpleData['calendar.txt'][0].wednesday) === 1, 
                    thursday: parseInt(gtfsValidSimpleData['calendar.txt'][0].thursday) === 1, 
                    friday: parseInt(gtfsValidSimpleData['calendar.txt'][0].friday) === 1, 
                    saturday: parseInt(gtfsValidSimpleData['calendar.txt'][0].saturday) === 1, 
                    sunday: parseInt(gtfsValidSimpleData['calendar.txt'][0].sunday) === 1, 
                    start_date: '2021-07-01',
                    end_date: '2022-08-01',
                    only_dates: [],
                    except_dates: [],
                    data: {
                        gtfs: {
                            service_id: gtfsValidSimpleData['calendar.txt'][0].service_id
                        }
                    }
                }
            },
        ]);
    });

    test('Test prepare service data, calendar file with date exceptions', async () => {
        const exceptDates = [ '20210802', '20210803' ];
        currentData = {
            ...gtfsValidSimpleData,
            'calendar_dates.txt': exceptDates.map(date => ({ service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date, exception_type: '2' }))
        }
        const collection = new ServiceCollection([], {})

        const importer = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(1);
        expect(data).toEqual([ 
            { 
                service: {
                    name: gtfsValidSimpleData['calendar.txt'][0].service_id,
                    monday: parseInt(gtfsValidSimpleData['calendar.txt'][0].monday) === 1, 
                    tuesday: parseInt(gtfsValidSimpleData['calendar.txt'][0].tuesday) === 1, 
                    wednesday: parseInt(gtfsValidSimpleData['calendar.txt'][0].wednesday) === 1, 
                    thursday: parseInt(gtfsValidSimpleData['calendar.txt'][0].thursday) === 1, 
                    friday: parseInt(gtfsValidSimpleData['calendar.txt'][0].friday) === 1, 
                    saturday: parseInt(gtfsValidSimpleData['calendar.txt'][0].saturday) === 1, 
                    sunday: parseInt(gtfsValidSimpleData['calendar.txt'][0].sunday) === 1, 
                    start_date: '2021-07-01',
                    end_date: '2022-08-01',
                    only_dates: [],
                    except_dates: [ '2021-08-02', '2021-08-03' ],
                    data: {
                        gtfs: {
                            service_id: gtfsValidSimpleData['calendar.txt'][0].service_id
                        }
                    }
                }
            },
        ]);
    });

    test('Test prepare service data, calendar date file only', async () => {
        // Create a file with a few dates, unsorted
        currentData = {
            'calendar_dates.txt': [
                { service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date: '20210802', exception_type: '1' },
                { service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date: '20210801', exception_type: '1' },
                { service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date: '20210803', exception_type: '2' },
                { service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date: '20210805', exception_type: '1' },
                { service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date: '20210804', exception_type: '1' },
                { service_id: gtfsValidSimpleData['calendar.txt'][0].service_id, date: '20210806', exception_type: '2' },
                { service_id: `${gtfsValidSimpleData['calendar.txt'][0].service_id}.bis`, date: '20210806', exception_type: '1' }
            ]
        }
        const collection = new ServiceCollection([], {})

        const importer = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(2);
        expect(data).toEqual([ 
            { 
                service: {
                    name: gtfsValidSimpleData['calendar.txt'][0].service_id,
                    monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false,
                    start_date: '2021-08-01',
                    end_date: '2021-08-05',
                    only_dates: [ '2021-08-01', '2021-08-02', '2021-08-04', '2021-08-05' ],
                    except_dates: [ '2021-08-03', '2021-08-06' ],
                    data: {
                        gtfs: {
                            service_id: gtfsValidSimpleData['calendar.txt'][0].service_id
                        }
                    }
                }
            },
            { 
                service: {
                    name: `${gtfsValidSimpleData['calendar.txt'][0].service_id}.bis`,
                    monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false,
                    start_date: '2021-08-06',
                    end_date: '2021-08-06',
                    only_dates: [ '2021-08-06' ],
                    except_dates: [ ],
                    data: {
                        gtfs: {
                            service_id: `${gtfsValidSimpleData['calendar.txt'][0].service_id}.bis`
                        }
                    }
                }
            }
        ]);
    });

    test('Test prepare service data, from Transition', async () => {
        currentData = gtfsValidTransitionGeneratedData
        const collection = new ServiceCollection([], {})

        const importer = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(1);
        expect(data).toEqual([ 
            { 
                service: {
                    ...convertToServiceAttributes(gtfsValidTransitionGeneratedData['calendar.txt'][0]),
                    only_dates: [],
                    except_dates: []
                }
            },
        ]);
    });
});

describe('GTFS Service import', () => {

    const service0ForImport = { ...convertToServiceAttributes(gtfsValidSimpleData['calendar.txt'][0]), only_dates: [], except_dates: [] };

    test('Test import service data, no existing data, selected', async () => {
        currentData = gtfsValidSimpleData;
        
        const importData = [ { service: _cloneDeep(service0ForImport), selected: true } ];
        const collection = new ServiceCollection([], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, defaultImportData, { services: importData}), defaultInternalImportData);
        expect(serviceSaveFct).toHaveBeenCalledTimes(1);
        const newService = data[gtfsValidSimpleData['calendar.txt'][0].service_id];
        expect(newService).toBeDefined();
        expect(newService.attributes).toEqual(expect.objectContaining({
            id: expect.anything(),
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
            start_date: '2021-07-01',
            end_date: '2022-08-01',
            only_dates: [],
            except_dates: [],
            data: expect.objectContaining({
                gtfs: {
                    service_id: gtfsValidSimpleData['calendar.txt'][0].service_id
                }
            })
        }));
    });

    test('Test import service data, no existing data, no selection', async () => {
        currentData = gtfsValidSimpleData;
        const importData = [ { line: service0ForImport, selected: false } ];
        const collection = new ServiceCollection([], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, defaultImportData, { services: importData }), defaultInternalImportData);
        expect(serviceSaveFct).toHaveBeenCalledTimes(0);
        expect(Object.keys(data).length).toEqual(0);
    });

    each([
        ['same dates and days', { }, true],
        ['different dates', { start_date: '2018-07-01', end_date: '2019-08-01' }, false],
        ['different days', { monday: false, tuesday: false, wednesday: false, saturday: true }, false],
        ['different gtfs ids', { data: {} }, false],
        ['imported from same agency', { scheduled_lines: [existingLineAttributes.id] }, true, [new Line(existingLineAttributes, false)]],
        ['imported from same agency, but not from gtfs', { scheduled_lines: [existingLineAttributes.id], data: { } }, false, [new Line(existingLineAttributes, false)]],
        ['imported from different agency', { scheduled_lines: [existingLineAttributes.id]}, false, [new Line(Object.assign({}, existingLineAttributes, {agency_id: uuidV4()}), false)]]
    ]).test('Test import service data, existing service, %s', async (_name: string, customAttributes: Partial<ServiceAttributes>, expectExisting: boolean, existingLines: Line[] = []) => {
        currentData = gtfsValidSimpleData;

        if (!expectExisting) {
            // Return a different unique name for this service
            mockGetUniqueServiceName.mockResolvedValueOnce(service0ForImport.data?.gtfs?.service_id + '-1');
        }
        
        lines.clear();
        lines.setFeatures(existingLines);
        // Customize the existing service
        const existingServiceAttribs1: ServiceAttributes = Object.assign({
            id: uuidV4(),
            name: service0ForImport.data?.gtfs?.service_id,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
            start_date: '2021-07-01',
            end_date: '2022-08-01',
            only_dates: [],
            except_dates: [],
            scheduled_lines: [],
            data: {
                gtfs: {
                    service_id: service0ForImport.data?.gtfs?.service_id
                },
                variables: {}
            }
        }, customAttributes);
        const existingService = new Service(existingServiceAttribs1, false);
        
        const importData = [ { service: _cloneDeep(service0ForImport), selected: true } ];
        const collection = new ServiceCollection([ existingService], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, defaultImportData, { services: importData }), internalImportData);

        const importedService = data[gtfsValidSimpleData['calendar.txt'][0].service_id];
        expect(importedService).toBeDefined();
        if (expectExisting) {
            expect(serviceSaveFct).toHaveBeenCalledTimes(0);
            expect(importedService.attributes).toEqual(expect.objectContaining(existingServiceAttribs1));
        } else {
            expect(mockGetUniqueServiceName).toHaveBeenCalledTimes(1);
            expect(serviceSaveFct).toHaveBeenCalledTimes(1);
            expect(importedService.attributes).toEqual(expect.objectContaining({
                id: expect.anything(),
                name: `${gtfsValidSimpleData['calendar.txt'][0].service_id}-1`,
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false,
                start_date: '2021-07-01',
                end_date: '2022-08-01',
                only_dates: [],
                except_dates: [],
                data: expect.objectContaining({
                    gtfs: {
                        service_id: gtfsValidSimpleData['calendar.txt'][0].service_id
                    }
                })
            }));
        }
    });

    test('Test import service data from Transition, no existing data', async () => {
        currentData = gtfsValidTransitionGeneratedData;

        const line0ForImportTransition = convertToServiceAttributes(gtfsValidTransitionGeneratedData['calendar.txt'][0]);
        
        const importData = [ { service: line0ForImportTransition, selected: true } ];
        const collection = new ServiceCollection([], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, defaultImportData, { services: importData }), defaultInternalImportData);
        expect(serviceSaveFct).toHaveBeenCalledTimes(1);
        const newService = data[gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id];
        expect(newService).toBeDefined();
        expect(newService.attributes).toEqual(expect.objectContaining({
            id: expect.anything(),
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
            start_date: '2021-07-01',
            end_date: '2022-08-01',
            only_dates: [],
            except_dates: [],
            color: gtfsValidTransitionGeneratedData['calendar.txt'][0].tr_service_color,
            description: gtfsValidTransitionGeneratedData['calendar.txt'][0].tr_service_desc,
            data: expect.objectContaining({
                gtfs: {
                    service_id: gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id
                }
            })
        }));
    });

    test('Test import service data, with date exceptions', async () => {
        currentData = gtfsValidSimpleData;
        
        const serviceForImport = { ...convertToServiceAttributes(gtfsValidSimpleData['calendar.txt'][0]), only_dates: ['2021-08-01', '2021-09-01'], except_dates: ['2021-08-02'] };
        const importData = [ { service: serviceForImport, selected: true } ];
        const collection = new ServiceCollection([], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, defaultImportData, { services: importData }), defaultInternalImportData);
        expect(serviceSaveFct).toHaveBeenCalledTimes(1);
        const newService = data[gtfsValidSimpleData['calendar.txt'][0].service_id];
        expect(newService).toBeDefined();
        expect(newService.attributes).toEqual(expect.objectContaining({
            id: expect.anything(),
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
            start_date: '2021-07-01',
            end_date: '2022-08-01',
            only_dates: ['2021-08-01', '2021-09-01'],
            except_dates: ['2021-08-02'],
            data: expect.objectContaining({
                gtfs: {
                    service_id: gtfsValidSimpleData['calendar.txt'][0].service_id
                }
            })
        }));
    });

    test('Test import service data with grouping, compatible', async () => {
        currentData = gtfsValidTransitionGeneratedData;

        // A a second service and change name
        const otherServiceToImport = _cloneDeep(gtfsValidSimpleData['calendar.txt'][0]);
        otherServiceToImport.service_id = 'other';
        const service1ForImport = { ...convertToServiceAttributes(otherServiceToImport), only_dates: [], except_dates: [] };
        
        const importData = [ { service: _cloneDeep(service0ForImport), selected: true }, { service: service1ForImport, selected: true } ];
        const collection = new ServiceCollection([], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, { ...defaultImportData, mergeSameDaysServices: true }, { services: importData }), defaultInternalImportData);
        expect(serviceSaveFct).toHaveBeenCalledTimes(1);
        const newService = data[gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id];
        expect(newService).toBeDefined();
        expect(newService.attributes).toEqual(expect.objectContaining({
            name: gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id,
            data: expect.objectContaining({
                gtfs: {
                    service_id: gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id
                }
            }),
            description: `GTFS: [${service0ForImport.name}, ${otherServiceToImport.service_id}]`
        }));
        const newService2 = data[otherServiceToImport.service_id];
        expect(newService2).toEqual(newService);
    });

    test('Test import service data with grouping, all non compatible', async () => {
        currentData = gtfsValidSimpleData;

        // A a second service and change name and some dates
        const otherServiceToImport = _cloneDeep(gtfsValidSimpleData['calendar.txt'][0]);
        otherServiceToImport.service_id = 'other';
        otherServiceToImport.start_date = '20210901';
        otherServiceToImport.end_date = '20211001'
        const service1ForImport = { ...convertToServiceAttributes(otherServiceToImport), only_dates: [], except_dates: [] };
        
        const importData = [ { service: _cloneDeep(service0ForImport), selected: true }, { service: service1ForImport, selected: true } ];
        const collection = new ServiceCollection([], {})

        const objectImporter = new ServiceImporter({ directoryPath: '', services: collection, lines });
        const data = await objectImporter.import(Object.assign({}, { ...defaultImportData, mergeSameDaysServices: true }, { services: importData }), defaultInternalImportData);
        expect(serviceSaveFct).toHaveBeenCalledTimes(2);
        const newService = data[gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id];
        expect(newService).toBeDefined();
        expect(newService.attributes).toEqual(expect.objectContaining({
            name: gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id,
            data: expect.objectContaining({
                gtfs: {
                    service_id: gtfsValidTransitionGeneratedData['calendar.txt'][0].service_id
                }
            })
        }));
        const newService2 = data[otherServiceToImport.service_id];
        expect(newService2).toBeDefined();
        expect(newService2.attributes).toEqual(expect.objectContaining({
            name: service1ForImport.name,
            data: expect.objectContaining({
                gtfs: {
                    service_id: service1ForImport.name
                }
            })
        }));
    });
});
