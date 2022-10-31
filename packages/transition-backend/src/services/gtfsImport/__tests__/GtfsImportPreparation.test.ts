/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import GtfsImportPreparation from '../GtfsImportPreparation';

import { gtfsValidSimpleData } from './GtfsImportData.test';

let currentData: any = gtfsValidSimpleData;

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

LineCollection.prototype.loadFromServer = jest.fn();
ServiceCollection.prototype.loadFromServer = jest.fn();
AgencyCollection.prototype.loadFromServer = jest.fn();

test('Test prepare data for import', async () => {
    const importData = await GtfsImportPreparation.prepare('');
    expect(importData.agencies.length).toEqual(1);
    expect(importData.lines.length).toEqual(2);
    expect(importData.services.length).toEqual(1);
});
