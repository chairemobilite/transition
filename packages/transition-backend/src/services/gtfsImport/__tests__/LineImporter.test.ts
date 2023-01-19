/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import each from 'jest-each';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import Line from 'transition-common/lib/services/line/Line';

import { gtfsValidSimpleData, gtfsValidSingleAgencyData, defaultImportData, defaultInternalImportData, gtfsValidTransitionGeneratedData } from './GtfsImportData.test';
import LineImporter from '../LineImporter';
import AgencyImporter from '../AgencyImporter';

let currentData: any = gtfsValidSimpleData;
const lineSaveFct = Line.prototype.save = jest.fn();

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

const changeRouteTypeToInt = (data) => {
    const { route_type, ...rest } = data;
    return { route_type: parseInt(route_type), ...rest };
} 

beforeEach(() => {
    lineSaveFct.mockClear();
});

describe('GTFS Line import preparation', () => {
    test('Test prepare line data, with agency ID', async () => {
        currentData = gtfsValidSimpleData
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.prepareImportData();
        expect(data.length).toEqual(2);
        expect(data).toEqual([ 
            { line: changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][0]) },
            { line: changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][1]) }
        ]);
    });

    test('Test prepare line data, without agency ID, but agency with ID', async () => {
        currentData = Object.assign({}, gtfsValidSimpleData, { 'routes.txt': gtfsValidSingleAgencyData['routes.txt'] });
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines, agencyIds: [gtfsValidSimpleData['agency.txt'][0].agency_id] });
        const data = await lineImporter.prepareImportData();
        expect(data.length).toEqual(2);
        expect(data).toEqual([
            { line: changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][0]) },
            { line: changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][1]) }
        ]);
    });

    test('Test prepare line data, without agency ID', async () => {
        currentData = gtfsValidSingleAgencyData
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.prepareImportData();
        expect(data.length).toEqual(2);
        expect(data).toEqual([ 
            { line: { ...changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][0]), agency_id: AgencyImporter.DEFAULT_AGENCY_ACRONYM } },
            { line: { ...changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][1]), agency_id: AgencyImporter.DEFAULT_AGENCY_ACRONYM } }
        ]);
    });
});

describe('GTFS Line import', () => {

    const line0ForImport = changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][0]);
    const line1ForImport = changeRouteTypeToInt(gtfsValidSimpleData['routes.txt'][1]);
    const agencyId = uuidV4();
    const agencyIdsByAgencyGtfsId = { };
    agencyIdsByAgencyGtfsId[currentData['agency.txt'][0].agency_id] = agencyId;

    test('Test import line data, no existing data, two selected', async () => {
        currentData = gtfsValidSimpleData;
        
        const importData = [ { line: line0ForImport, selected: true }, { line: line1ForImport, selected: true } ];
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData}), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(2);
        const newLine = data[gtfsValidSimpleData['routes.txt'][0].route_id];
        expect(newLine).toBeDefined();
        expect(newLine.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            agency_id: agencyId,
            shortname: gtfsValidSimpleData['routes.txt'][0].route_short_name,
            longname: gtfsValidSimpleData['routes.txt'][0].route_long_name,
            mode: 'bus',
            color: gtfsValidSimpleData['routes.txt'][0].route_color,
            data: expect.objectContaining({
                gtfs: {
                    ...line0ForImport
                }
            })
        }));

        const newLine2 = data[gtfsValidSimpleData['routes.txt'][1].route_id];
        expect(newLine2).toBeDefined();
        expect(newLine2.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            agency_id: agencyId,
            shortname: gtfsValidSimpleData['routes.txt'][1].route_short_name,
            longname: gtfsValidSimpleData['routes.txt'][1].route_long_name,
            mode: 'bus',
            color: `#${gtfsValidSimpleData['routes.txt'][1].route_color}`,
            data: expect.objectContaining({
                gtfs: {
                    ...line1ForImport
                }
            })
        }));
    });

    test('Test import line data, no existing data, no selection', async () => {
        currentData = gtfsValidSimpleData;
        const importData = [ { line: line0ForImport, selected: false }, { line: line1ForImport, selected: false } ];
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData}), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(0);
        expect(Object.keys(data).length).toEqual(0);
    });

    each([
        ['mergeAndIgnore', false, [{}, {}]],
        ['mergeAndReplace', true, [{ mode: 'bus' }, { data: { gtfs: { ...line1ForImport}}}]]
    ]).test('Test import line data, two selected, line exists, same agency, %s', async (_title: string, agencyShouldUpdate: boolean, changedAttribs: { [key: string]: any }[]) => {
        currentData = gtfsValidSimpleData;

        // A line imported from GTFS with same route_id, but names have changed, should be same
        const existingLineAttribs1 = {
            id: uuidV4(),
            agency_id: agencyId, 
            shortname: `${gtfsValidSimpleData['routes.txt'][0].route_short_name} modified`,
            longname: `${gtfsValidSimpleData['routes.txt'][0].route_long_name} modified`,
            mode: 'train',
            color: gtfsValidSimpleData['routes.txt'][0].route_color,
            data: {
                gtfs: {
                    ...line0ForImport
                }
            }
        }
        const existingLine1 = new Line(existingLineAttribs1, false);

        // A line not from gtfs, but with identical long and short names, should be same
        const existingLineAttribs2 = {
            id: uuidV4(),
            agency_id: agencyId, 
            shortname: gtfsValidSimpleData['routes.txt'][1].route_short_name,
            longname: gtfsValidSimpleData['routes.txt'][1].route_long_name,
            mode: 'bus',
            color: `#${gtfsValidSimpleData['routes.txt'][1].route_color}`,
            data: {}
        }
        const existingLine2 = new Line(existingLineAttribs2, false);
        
        const importData = [ { line: line0ForImport, selected: true }, { line: line1ForImport, selected: true } ];
        const lines = new LineCollection([existingLine1, existingLine2], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData}), 
            Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId, doNotUpdateAgencies: agencyShouldUpdate ? [] : [agencyId] })
        );
        expect(lineSaveFct).toHaveBeenCalledTimes(agencyShouldUpdate ? 2 : 0);
        const newLine = data[gtfsValidSimpleData['routes.txt'][0].route_id];
        expect(newLine).toBeDefined();
        const newLine1Attribs = Object.assign({}, existingLineAttribs1, changedAttribs[0]);
        expect(newLine.getAttributes()).toEqual(expect.objectContaining(newLine1Attribs));

        const newLine2 = data[gtfsValidSimpleData['routes.txt'][1].route_id];
        expect(newLine2).toBeDefined();
        const newLine2Attribs = Object.assign({}, existingLineAttribs2, changedAttribs[1]);
        expect(newLine2.getAttributes()).toEqual(expect.objectContaining(newLine2Attribs));
    });

    test('Test import line data, two selected, line exists, different agency', async () => {
        currentData = gtfsValidSimpleData;
        const otherAgencyId = uuidV4();

        // A line imported from GTFS with same route_id, but names have changed, should be same
        const existingLineAttribs1 = {
            id: uuidV4(),
            agency_id: otherAgencyId, 
            shortname: `${gtfsValidSimpleData['routes.txt'][0].route_short_name} modified`,
            longname: `${gtfsValidSimpleData['routes.txt'][0].route_long_name} modified`,
            mode: 'bus',
            color: gtfsValidSimpleData['routes.txt'][0].route_color,
            data: {
                gtfs: {
                    ...line0ForImport
                }
            }
        }
        const existingLine1 = new Line(existingLineAttribs1, false);

        // A line not from gtfs, but with identical long and short names, should be same
        const existingLineAttribs2 = {
            id: uuidV4(),
            agency_id: otherAgencyId, 
            shortname: gtfsValidSimpleData['routes.txt'][1].route_short_name,
            longname: gtfsValidSimpleData['routes.txt'][1].route_long_name,
            mode: 'bus',
            color: gtfsValidSimpleData['routes.txt'][1].route_color,
            data: {}
        }
        const existingLine2 = new Line(existingLineAttribs2, false);
        
        const importData = [ { line: line0ForImport, selected: true }, { line: line1ForImport, selected: true } ];
        const lines = new LineCollection([existingLine1, existingLine2], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData}), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(2);
        const newLine = data[gtfsValidSimpleData['routes.txt'][0].route_id];
        expect(newLine).toBeDefined();
        expect(newLine.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            agency_id: agencyId,
            shortname: gtfsValidSimpleData['routes.txt'][0].route_short_name,
            longname: gtfsValidSimpleData['routes.txt'][0].route_long_name,
            mode: 'bus',
            color: gtfsValidSimpleData['routes.txt'][0].route_color,
            data: expect.objectContaining({
                gtfs: {
                    ...line0ForImport
                }
            })
        }));

        const newLine2 = data[gtfsValidSimpleData['routes.txt'][1].route_id];
        expect(newLine2).toBeDefined();
        expect(newLine2.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            agency_id: agencyId,
            shortname: gtfsValidSimpleData['routes.txt'][1].route_short_name,
            longname: gtfsValidSimpleData['routes.txt'][1].route_long_name,
            mode: 'bus',
            color: `#${gtfsValidSimpleData['routes.txt'][1].route_color}`,
            data: expect.objectContaining({
                gtfs: {
                    ...line1ForImport
                }
            })
        }));
    });

    test('Test import line data, no existing data, bad route type', async () => {
        currentData = gtfsValidSimpleData;
        
        const { route_type, ...rest } = line0ForImport
        const importData = [ { line: { route_type: 50000, ...rest }, selected: true } ];
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData}), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(0);
        expect(Object.keys(data).length).toEqual(0);
    });

    test('Test import line data, no existing data, two selected', async () => {
        currentData = gtfsValidTransitionGeneratedData;

        const line0ForImportTransition = changeRouteTypeToInt(gtfsValidTransitionGeneratedData['routes.txt'][0]);
        const line1ForImportTransition = changeRouteTypeToInt(gtfsValidTransitionGeneratedData['routes.txt'][1]);
        
        const importData = [ { line: line0ForImportTransition, selected: true }, { line: line1ForImportTransition, selected: true } ];
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData }), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(2);
        const newLine = data[gtfsValidTransitionGeneratedData['routes.txt'][0].route_id];
        expect(newLine).toBeDefined();
        expect(newLine.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            agency_id: agencyId,
            shortname: gtfsValidTransitionGeneratedData['routes.txt'][0].route_short_name,
            longname: gtfsValidTransitionGeneratedData['routes.txt'][0].route_long_name,
            mode: 'bus',
            color: gtfsValidTransitionGeneratedData['routes.txt'][0].route_color,
            internal_id: gtfsValidTransitionGeneratedData['routes.txt'][0].tr_route_internal_id,
            category: gtfsValidTransitionGeneratedData['routes.txt'][0].tr_route_row_category,
            allow_same_line_transfers: true,
            is_autonomous: true,
            data: expect.objectContaining({
                gtfs: {
                    ...line0ForImportTransition
                }
            })
        }));

        const newLine2 = data[gtfsValidTransitionGeneratedData['routes.txt'][1].route_id];
        expect(newLine2).toBeDefined();
        expect(newLine2.getAttributes()).toEqual(expect.objectContaining({
            id: expect.anything(),
            agency_id: agencyId,
            shortname: gtfsValidTransitionGeneratedData['routes.txt'][1].route_short_name,
            longname: gtfsValidTransitionGeneratedData['routes.txt'][1].route_long_name,
            mode: 'bus',
            color: `#${gtfsValidTransitionGeneratedData['routes.txt'][1].route_color}`,
            internal_id: gtfsValidTransitionGeneratedData['routes.txt'][0].tr_route_internal_id,
            category: gtfsValidTransitionGeneratedData['routes.txt'][0].tr_route_row_category,
            allow_same_line_transfers: false,
            is_autonomous: false,
            data: expect.objectContaining({
                gtfs: {
                    ...line1ForImportTransition
                }
            })
        }));
    });

    test('Test default line color', async () => {
        currentData = gtfsValidSimpleData;
        
        // No route color and no import agency color
        const { route_color, ...rest } = line0ForImport;
        const importData = [ { line: { ...rest }, selected: true } ];
        const lines = new LineCollection([], {})

        const lineImporter = new LineImporter({ directoryPath: '', lines });
        const data = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData }), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(1);
        const newLine = data[gtfsValidTransitionGeneratedData['routes.txt'][0].route_id];
        expect(newLine).toBeDefined();
        expect(newLine.getAttributes().color).toEqual('#FFFFFF');

        // Import again, this time with a default agency color
        const defaultColor = '#ABCDEF';
        const data2 = await lineImporter.import(Object.assign({}, defaultImportData, { lines: importData, agencies_color: defaultColor }), Object.assign({}, defaultInternalImportData, { agencyIdsByAgencyGtfsId }));
        expect(lineSaveFct).toHaveBeenCalledTimes(2);
        const newLine2 = data2[gtfsValidTransitionGeneratedData['routes.txt'][0].route_id];
        expect(newLine2).toBeDefined();
        expect(newLine2.getAttributes().color).toEqual(defaultColor);
    });
})
