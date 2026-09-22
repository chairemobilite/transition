/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { duplicatePaths } from '../PathDuplicator';
import transitPathsDbQueries from '../../../../models/db/transitPaths.db.queries';
import * as Status from 'chaire-lib-common/lib/utils/Status';

// Mock the knex transaction object.
const transactionObjectMock = new Object(3) as any;

jest.mock('../../../../models/db/transitPaths.db.queries', () => ({
    duplicate: jest.fn(),
}));
const mockDuplicatePath = transitPathsDbQueries.duplicate as jest.MockedFunction<typeof transitPathsDbQueries.duplicate>;

describe('duplicatePaths', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should call the duplicate db function with line mappings and return ok result', async () => {
        const expectedResult = { [uuidV4()]: uuidV4() };
        mockDuplicatePath.mockResolvedValue(expectedResult);
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
        };
        expect(await duplicatePaths(mappings)).toEqual(Status.createOk(expectedResult));
        expect(mockDuplicatePath).toHaveBeenCalledWith({
            ...mappings,
            transaction: undefined
        });
    });

    it('should call the duplicate db function with path ids and suffix and return ok result', async () => {
        const expectedResult = { [uuidV4()]: uuidV4() };
        mockDuplicatePath.mockResolvedValue(expectedResult);
        const pathIds = [uuidV4(), uuidV4()];
        const newPathSuffix = ' copy';
        expect(await duplicatePaths({ pathIds, newPathSuffix })).toEqual(Status.createOk(expectedResult));
        expect(mockDuplicatePath).toHaveBeenCalledWith({
            pathIds,
            newPathSuffix,
            transaction: undefined
        });
    });

    it('should call the duplicate db function with line mappings, path ids and suffix and return ok result', async () => {
        const expectedResult = { [uuidV4()]: uuidV4() };
        mockDuplicatePath.mockResolvedValue(expectedResult);
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
            pathIds: [uuidV4(), uuidV4()],
            newPathSuffix: ' copy'
        };
        expect(await duplicatePaths(mappings)).toEqual(Status.createOk(expectedResult));
        expect(mockDuplicatePath).toHaveBeenCalledWith({
            ...mappings,
            transaction: undefined
        });
    });

    it('should call the duplicate db function with mappings and provided transaction and return ok result', async () => {
        const expectedResult = { [uuidV4()]: uuidV4() };
        mockDuplicatePath.mockResolvedValue(expectedResult);
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
        };
        expect(await duplicatePaths(mappings, { transaction: transactionObjectMock })).toEqual(Status.createOk(expectedResult));
        expect(mockDuplicatePath).toHaveBeenCalledWith({
            ...mappings,
            transaction: transactionObjectMock
        });
    });

    it('should return an error status if db function throw an error', async () => {
        mockDuplicatePath.mockRejectedValue(new Error('error'));
        const mappings = {
            lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
        };
        expect(await duplicatePaths(mappings)).toEqual(Status.createError('An error occurred while duplicating paths'));
        expect(mockDuplicatePath).toHaveBeenCalledWith({
            ...mappings,
            transaction: undefined
        });
    });

    it('should return an error status if neither path ids or line mappings are set', async () => {
        expect(await duplicatePaths({ })).toEqual(Status.createError('An error occurred while duplicating paths'));
        expect(mockDuplicatePath).not.toHaveBeenCalled();
    });

});
