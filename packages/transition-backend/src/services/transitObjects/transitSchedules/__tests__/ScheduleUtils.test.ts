/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { duplicateSchedules } from '../ScheduleUtils';
import transitSchedulesDbQueries from '../../../../models/db/transitSchedules.db.queries';
import * as Status from 'chaire-lib-common/lib/utils/Status';

// Mock the knex transaction object.
const transactionObjectMock = new Object(3) as any;

jest.mock('../../../../models/db/transitSchedules.db.queries', () => ({
    duplicateSchedule: jest.fn(),
}));
const mockDuplicateSchedule = transitSchedulesDbQueries.duplicateSchedule as jest.MockedFunction<typeof transitSchedulesDbQueries.duplicateSchedule>;    

describe('duplicateSchedules', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should call the duplicateSchedule db function with mappings and return ok result', async () => {
        const expectedResult = { 3: 4, 5: 6 };
        mockDuplicateSchedule.mockResolvedValue(expectedResult);
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
        };
        expect(await duplicateSchedules(mappings)).toEqual(Status.createOk(expectedResult));
        expect(mockDuplicateSchedule).toHaveBeenCalledWith({
            ...mappings,
            transaction: undefined
        });
    });

    it('should call the duplicateSchedule db function with mappings and provided transaction and return ok result', async () => {
        const expectedResult = { 3: 4, 5: 6 };
        mockDuplicateSchedule.mockResolvedValue(expectedResult);
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
            serviceIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
            pathIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
        };
        expect(await duplicateSchedules(mappings, { transaction: transactionObjectMock })).toEqual(Status.createOk(expectedResult));
        expect(mockDuplicateSchedule).toHaveBeenCalledWith({
            ...mappings,
            transaction: transactionObjectMock
        });
    });

    it('should return an error status if db function throw an error', async () => {
        mockDuplicateSchedule.mockRejectedValue(new Error('error'));
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
            serviceIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
            pathIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
        };
        expect(await duplicateSchedules(mappings)).toEqual(Status.createError('An error occurred while duplicating schedules'));
        expect(mockDuplicateSchedule).toHaveBeenCalledWith({
            ...mappings,
            transaction: undefined
        });
    });

});
