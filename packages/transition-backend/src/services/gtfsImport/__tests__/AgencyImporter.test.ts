/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import Agency from 'transition-common/lib/services/agency/Agency';
import each from 'jest-each';

import { gtfsValidSimpleData, gtfsValidSingleAgencyData, defaultImportData, defaultInternalImportData, gtfsValidTransitionGeneratedData } from './GtfsImportData.test';
import AgencyImporter from '../AgencyImporter';

let currentData: any = gtfsValidSimpleData;
const agencySaveFct = Agency.prototype.save = jest.fn();
const agencyDeleteFct = Agency.prototype.delete = jest.fn();

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

beforeEach(() => {
    agencySaveFct.mockClear();
    agencyDeleteFct.mockClear();
})

describe('GTFS Agency import preparation', () => {

    test('Test prepare agency data, no existing data', async () => {
        currentData = gtfsValidSimpleData
        const collectionManager = new CollectionManager(null);
        const agencies = new AgencyCollection([], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const data = await agencyImporter.prepareImportData();
        expect(data.length).toEqual(1);
        expect(data[0]).toEqual({ agency: gtfsValidSimpleData['agency.txt'][0], existingAgencies: [] });
    });

    test('Test prepare agency data, with existing agencies', async () => {
        currentData = gtfsValidSimpleData
        const collectionManager = new CollectionManager(null);
        const { agency_id, agency_name, ...rest } = gtfsValidSimpleData['agency.txt'][0];
        // Same gtfs data, even if the acronym is different
        const currentAgency1 = {
            id: 'arbitraryId',
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id + '.1',
            data: {
                gtfs: gtfsValidSimpleData['agency.txt'][0]
            }
        }
        // Same acronym, but no gtfs data
        const currentAgency2 = {
            id: 'arbitraryId2',
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id,
        }
        const currentAgency3 = {
            id: 'arbitraryId3',
            acronym: 'any acronym',
            data: {
                gtfs: {
                    agency_id: 'other',
                    agency_name: 'My other agency',
                    ...rest
                }
            }
        }
        const agencies = new AgencyCollection([ new Agency(currentAgency1, false), new Agency(currentAgency2, false), new Agency(currentAgency3, false) ], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const data = await agencyImporter.prepareImportData();
        expect(data.length).toEqual(1);
        // Match both on acronym and GTFS data
        expect(data[0]).toEqual({ 
            agency: gtfsValidSimpleData['agency.txt'][0], 
            existingAgencies: [{ id: currentAgency1.id, acronym: currentAgency1.acronym }, { id: currentAgency2.id, acronym: currentAgency2.acronym }],
            agencyAction: { action: 'replace', agencyId: currentAgency1.id } 
        });
    });

    test('Test prepare single agency data, with existing agencies and matching acronym', async () => {
        currentData = gtfsValidSingleAgencyData;
        const collectionManager = new CollectionManager(null);
        const { agency_id, agency_name, ...rest } = gtfsValidSimpleData['agency.txt'][0];
        const currentAgency1 = {
            id: 'arbitraryId',
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id,
            data: {
                gtfs: gtfsValidSimpleData['agency.txt'][0]
            }
        }
        const currentAgency2 = {
            id: 'arbitraryId2',
            acronym: 'any acronym',
            data: {
                gtfs: {
                    agency_id: 'other',
                    agency_name: 'My other agency',
                    ...rest
                }
            }
        }
        const agencies = new AgencyCollection([ new Agency(currentAgency1, false), new Agency(currentAgency2, false) ], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const data = await agencyImporter.prepareImportData();
        expect(data.length).toEqual(1);
        expect(data[0]).toEqual({ 
            agency: { agency_id: AgencyImporter.DEFAULT_AGENCY_ACRONYM, ...gtfsValidSingleAgencyData['agency.txt'][0] },
            existingAgencies: [] 
        });

        // Add an agency with a matching acronym
        const currentAgencyWithMatchingAcronym = {
            id: 'arbitraryId3',
            acronym: AgencyImporter.DEFAULT_AGENCY_ACRONYM,
            data: {
                gtfs: gtfsValidSingleAgencyData['agency.txt'][0]
            }
        }
        agencies.add(new Agency(currentAgencyWithMatchingAcronym, false));

        const data2 = await agencyImporter.prepareImportData();
        expect(data2.length).toEqual(1);
        expect(data2[0]).toEqual({ 
            agency: { agency_id: AgencyImporter.DEFAULT_AGENCY_ACRONYM, ...gtfsValidSingleAgencyData['agency.txt'][0] },
            existingAgencies: [{ id: currentAgencyWithMatchingAcronym.id, acronym: currentAgencyWithMatchingAcronym.acronym }],
            agencyAction: { action: 'replace', agencyId: currentAgencyWithMatchingAcronym.id }
        });
    });
});

describe('GTFS Agency import', () => {

    test('Test import agency data, no existing data', async () => {
        currentData = gtfsValidSimpleData
        const importData = [ { agency: gtfsValidSimpleData['agency.txt'][0], existingAgencies: [], selected: true } ];
        const collectionManager = new CollectionManager(null);
        const agencies = new AgencyCollection([], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencySaveFct).toHaveBeenCalledTimes(1);
        const newAgency = data[gtfsValidSimpleData['agency.txt'][0].agency_id];
        expect(newAgency).toBeDefined();
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id,
            name: gtfsValidSimpleData['agency.txt'][0].agency_name,
            description: gtfsValidSimpleData['agency.txt'][0].agency_url,
            data: {
                gtfs: {
                    ...gtfsValidSimpleData['agency.txt'][0]
                }
            }
        }));
    });

    test('Test import agency data, with color', async () => {
        currentData = gtfsValidSimpleData;
        const defaultImportDataWithColor = Object.assign({}, defaultImportData, { agencies_color: '#123456' });
        const importData = [ { agency: gtfsValidSimpleData['agency.txt'][0], existingAgencies: [], selected: true } ];
        const collectionManager = new CollectionManager(null);
        const agencies = new AgencyCollection([], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const data = await agencyImporter.import(Object.assign({}, defaultImportDataWithColor, { agencies: importData}), defaultInternalImportData);
        expect(agencySaveFct).toHaveBeenCalledTimes(1);
        const newAgency = data[gtfsValidSimpleData['agency.txt'][0].agency_id];
        expect(newAgency).toBeDefined();
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id,
            name: gtfsValidSimpleData['agency.txt'][0].agency_name,
            description: gtfsValidSimpleData['agency.txt'][0].agency_url,
            color: '#123456',
            data: {
                gtfs: {
                    ...gtfsValidSimpleData['agency.txt'][0]
                }
            }
        }));
    });

    test('Test import agency data, no selection', async () => {
        currentData = gtfsValidSimpleData
        const importData = [ { agency: gtfsValidSimpleData['agency.txt'][0], existingAgencies: [] } ];
        const collectionManager = new CollectionManager(null);
        const agencies = new AgencyCollection([], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencySaveFct).toHaveBeenCalledTimes(0);
        expect(data).toEqual({});
    });

    test('Test import agency data, overwrite existing agencies', async () => {
        currentData = gtfsValidSimpleData
        const collectionManager = new CollectionManager(null);
        const { agency_id, agency_name, ...rest } = gtfsValidSimpleData['agency.txt'][0];
        const currentAgency1 = {
            id: 'arbitraryId',
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id,
            data: {
                someField: 'value',
                gtfs: gtfsValidSimpleData['agency.txt'][0]
            }
        }
        const currentAgency2 = {
            id: 'arbitraryId2',
            acronym: 'any acronym',
            data: {
                gtfs: {
                    agency_id: 'other',
                    agency_name: 'My other agency',
                    ...rest
                }
            }
        }
        const agencies = new AgencyCollection([ new Agency(currentAgency1, false, collectionManager), new Agency(currentAgency2, false, collectionManager) ], {})
        collectionManager.add('agencies', agencies );
        agencyDeleteFct.mockImplementationOnce(() => agencies.removeById(currentAgency1.id));

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const importData = [ { 
            agency: gtfsValidSimpleData['agency.txt'][0], 
            existingAgencies: [{ id: currentAgency1.id, acronym: currentAgency1.acronym }],
            agencyAction: { action: 'replace', agencyId: currentAgency1.id },
            selected: true
        } ];

        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencyDeleteFct).toHaveBeenCalledTimes(1);
        expect(agencyDeleteFct.mock.instances[0].getId()).toEqual(currentAgency1.id);
        expect(agencySaveFct).toHaveBeenCalledTimes(1);
        const newAgency = data[gtfsValidSimpleData['agency.txt'][0].agency_id];
        expect(newAgency).toBeDefined();
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            acronym: `${currentAgency1.acronym}`,
            name: gtfsValidSimpleData['agency.txt'][0].agency_name,
            data: {
                gtfs: {
                    ...gtfsValidSimpleData['agency.txt'][0]
                }
            }
        }));
    });

    each([
        ['mergeAndIgnore', false, {}],
        ['mergeAndReplace', true, { name: gtfsValidSimpleData['agency.txt'][0].agency_name, data: { gtfs: expect.anything() } }]
    ]).test('Test import agency data, merge with existing agencies, %s', async (action: string, expectSaveCalled: boolean, changedAttribs: { [key: string]: any }) => {
        currentData = gtfsValidSimpleData
        const collectionManager = new CollectionManager(null);
        const { agency_id, agency_name, ...rest } = gtfsValidSimpleData['agency.txt'][0];
        const currentAgency1 = {
            id: 'arbitraryId',
            acronym: `${gtfsValidSimpleData['agency.txt'][0].agency_id} modified`,
            name: 'Was renamed',
            data: {
                someField: 'value',
                gtfs: gtfsValidSimpleData['agency.txt'][0]
            }
        }
        const currentAgency2 = {
            id: 'arbitraryId2',
            acronym: 'any acronym',
            data: {
                gtfs: {
                    agency_id: 'other',
                    agency_name: 'My other agency',
                    ...rest
                }
            }
        }
        const agencies = new AgencyCollection([ new Agency(currentAgency1, false), new Agency(currentAgency2, false) ], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const importData = [ { 
            agency: gtfsValidSimpleData['agency.txt'][0], 
            existingAgencies: [{ id: currentAgency1.id, acronym: currentAgency1.acronym }],
            agencyAction: { action, agencyId: currentAgency1.id },
            selected: true
        } ];

        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencyDeleteFct).toHaveBeenCalledTimes(0);
        expect(agencySaveFct).toHaveBeenCalledTimes(expectSaveCalled ? 1 : 0);
        const newAgency = data[gtfsValidSimpleData['agency.txt'][0].agency_id];
        expect(newAgency).toBeDefined();
        const newAgencyAttribs = Object.assign({}, currentAgency1, changedAttribs);
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining(newAgencyAttribs));
    });

    each([
        ['existing acronym', gtfsValidSimpleData['agency.txt'][0].agency_id, `${gtfsValidSimpleData['agency.txt'][0].agency_id}-1`],
        ['different acronym', 'New name for agency', 'New name for agency']
    ]).test('Test import agency data, with existing agencies, create new, %s', async (_name, newAcronym, expectedAcronym) => {
        currentData = gtfsValidSimpleData
        const collectionManager = new CollectionManager(null);
        const { agency_id, agency_name, ...rest } = gtfsValidSimpleData['agency.txt'][0];
        const currentAgency1 = {
            id: 'arbitraryId',
            acronym: gtfsValidSimpleData['agency.txt'][0].agency_id,
            data: {
                gtfs: gtfsValidSimpleData['agency.txt'][0]
            }
        }
        const currentAgency2 = {
            id: 'arbitraryId2',
            acronym: 'any acronym',
            data: {
                gtfs: {
                    agency_id: 'other',
                    agency_name: 'My other agency',
                    ...rest
                }
            }
        }
        const agencies = new AgencyCollection([ new Agency(currentAgency1, false), new Agency(currentAgency2, false) ], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const importData = [ { 
            agency: gtfsValidSimpleData['agency.txt'][0], 
            existingAgencies: [{ id: currentAgency1.id, acronym: currentAgency1.acronym }],
            agencyAction: { action: 'create', agencyId: newAcronym },
            selected: true
        } ];

        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencyDeleteFct).toHaveBeenCalledTimes(0);
        expect(agencySaveFct).toHaveBeenCalledTimes(1);
        const newAgency = data[gtfsValidSimpleData['agency.txt'][0].agency_id];
        expect(newAgency).toBeDefined();
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            acronym: `${expectedAcronym}`,
            name: gtfsValidSimpleData['agency.txt'][0].agency_name,
            data: {
                gtfs: {
                    ...gtfsValidSimpleData['agency.txt'][0]
                }
            }
        }));
    });

    test('Test import single agency data', async () => {
        currentData = gtfsValidSingleAgencyData
        const collectionManager = new CollectionManager(null);
        const { agency_name, ...rest } = gtfsValidSingleAgencyData['agency.txt'][0];
        
        const agencies = new AgencyCollection([ ], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const importData = [ { 
            agency: { agency_id: AgencyImporter.DEFAULT_AGENCY_ACRONYM, ...gtfsValidSingleAgencyData['agency.txt'][0] },
            existingAgencies: [ ],
            agencyIdToOverwrite: undefined,
            selected: true
        } ];

        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencySaveFct).toHaveBeenCalledTimes(1);
        const newAgency = data[AgencyImporter.DEFAULT_AGENCY_ACRONYM];
        expect(newAgency).toBeDefined();
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            acronym: AgencyImporter.DEFAULT_AGENCY_ACRONYM,
            name: gtfsValidSingleAgencyData['agency.txt'][0].agency_name,
            data: {
                gtfs: {
                    agency_id: AgencyImporter.DEFAULT_AGENCY_ACRONYM,
                    ...gtfsValidSingleAgencyData['agency.txt'][0]
                }
            }
        }));
    });

    test('Test import transition agency data', async () => {
        currentData = gtfsValidTransitionGeneratedData
        const collectionManager = new CollectionManager(null);
        const { agency_name, ...rest } = gtfsValidTransitionGeneratedData['agency.txt'][0];
        
        const agencies = new AgencyCollection([ ], {})
        collectionManager.add('agencies', agencies );

        const agencyImporter = new AgencyImporter({ directoryPath: '', agencies });
        const importData = [ { 
            agency: gtfsValidTransitionGeneratedData['agency.txt'][0],
            existingAgencies: [ ],
            agencyAction: undefined,
            selected: true
        } ];

        const data = await agencyImporter.import(Object.assign({}, defaultImportData, { agencies: importData}), defaultInternalImportData);
        expect(agencySaveFct).toHaveBeenCalledTimes(1);
        const newAgency = data[gtfsValidTransitionGeneratedData['agency.txt'][0].agency_id];
        expect(newAgency).toBeDefined();
        expect(newAgency.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            acronym: gtfsValidTransitionGeneratedData['agency.txt'][0].agency_id,
            name: gtfsValidTransitionGeneratedData['agency.txt'][0].agency_name,
            description: gtfsValidTransitionGeneratedData['agency.txt'][0].tr_agency_description,
            color: gtfsValidTransitionGeneratedData['agency.txt'][0].tr_agency_color,
            data: {
                gtfs: gtfsValidTransitionGeneratedData['agency.txt'][0]
            }
        }));
    });
});
