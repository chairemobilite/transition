/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitAgenciesDbQueries from '../../../../models/db/transitAgencies.db.queries';
import { duplicateLines } from '../../transitLines/LineDuplicator';
import { duplicateAgencies } from '../AgencyDuplicator';

const transactionObjectMock = new Object(3) as any;

jest.mock('chaire-lib-backend/lib/config/shared/db.config', () => ({
    transaction: jest.fn()
}));
jest.mock('../../../../models/db/transitAgencies.db.queries', () => ({
    duplicate: jest.fn(),
    isAcronymSuffixClash: jest.fn()
}));
jest.mock('../../transitLines/LineDuplicator', () => ({
    duplicateLines: jest.fn()
}));

const mockTransaction = knex.transaction as jest.MockedFunction<typeof knex.transaction>;
const mockDuplicateAgencies = transitAgenciesDbQueries.duplicate as jest.MockedFunction<
    typeof transitAgenciesDbQueries.duplicate
>;
const mockIsAcronymSuffixClash = transitAgenciesDbQueries.isAcronymSuffixClash as jest.MockedFunction<
    typeof transitAgenciesDbQueries.isAcronymSuffixClash
>;
const mockDuplicateLines = duplicateLines as jest.MockedFunction<typeof duplicateLines>;

describe('duplicateAgencies', () => {
    const agencyIds = ['agency1', 'agency2'];
    const agencyIdMapping = { agency1: 'agency1-copy', agency2: 'agency2-copy' };

    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction.mockImplementation(async (callback) => callback(transactionObjectMock));
        mockIsAcronymSuffixClash.mockResolvedValue(false);
        mockDuplicateAgencies.mockResolvedValue(agencyIdMapping);
        mockDuplicateLines.mockResolvedValue(Status.createOk({}));
    });

    it('duplicates agencies and their lines with the requested suffix', async () => {
        const options = {
            agencyIds,
            newObjectsSuffix: ' copy',
            duplicateSchedules: true,
            duplicateServices: true
        };

        expect(await duplicateAgencies(options)).toEqual(Status.createOk(agencyIdMapping));
        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockIsAcronymSuffixClash).toHaveBeenCalledWith({
            agencyIds,
            suffix: ' copy',
            transaction: undefined
        });
        expect(mockDuplicateAgencies).toHaveBeenCalledWith({
            agencyIds,
            newAgencySuffix: ' copy',
            transaction: transactionObjectMock
        });
        expect(mockDuplicateLines).toHaveBeenCalledWith(
            {
                agencyIdMapping,
                duplicateSchedules: true,
                duplicateServices: true,
                newObjectsSuffix: undefined
            },
            { transaction: transactionObjectMock }
        );
    });

    it('uses the first available incremented suffix when the requested suffix clashes', async () => {
        mockIsAcronymSuffixClash.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        expect(
            await duplicateAgencies({ agencyIds, newObjectsSuffix: ' copy' })
        ).toEqual(Status.createOk(agencyIdMapping));
        expect(mockIsAcronymSuffixClash).toHaveBeenNthCalledWith(1, {
            agencyIds,
            suffix: ' copy',
            transaction: undefined
        });
        expect(mockIsAcronymSuffixClash).toHaveBeenNthCalledWith(2, {
            agencyIds,
            suffix: ' copy-1',
            transaction: undefined
        });
        expect(mockIsAcronymSuffixClash).toHaveBeenNthCalledWith(3, {
            agencyIds,
            suffix: ' copy-2',
            transaction: undefined
        });
        expect(mockDuplicateAgencies).toHaveBeenCalledWith({
            agencyIds,
            newAgencySuffix: ' copy-2',
            transaction: transactionObjectMock
        });
    });

    it('uses a provided transaction and does not start another transaction', async () => {
        expect(
            await duplicateAgencies(
                { agencyIds, newObjectsSuffix: ' copy' },
                { transaction: transactionObjectMock }
            )
        ).toEqual(Status.createOk(agencyIdMapping));

        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockIsAcronymSuffixClash).toHaveBeenCalledWith({
            agencyIds,
            suffix: ' copy',
            transaction: transactionObjectMock
        });
        expect(mockDuplicateAgencies).toHaveBeenCalledWith({
            agencyIds,
            newAgencySuffix: ' copy',
            transaction: transactionObjectMock
        });
    });

    it('does not duplicate lines if no agencies were duplicated', async () => {
        mockDuplicateAgencies.mockResolvedValue({});

        expect(await duplicateAgencies({ agencyIds, newObjectsSuffix: ' copy' })).toEqual(Status.createOk({}));
        expect(mockDuplicateLines).not.toHaveBeenCalled();
    });

    it('returns an error status if agency duplication throws', async () => {
        mockDuplicateAgencies.mockRejectedValue(new Error('database error'));

        expect(await duplicateAgencies({ agencyIds, newObjectsSuffix: ' copy' })).toEqual(
            Status.createError('An error occurred while duplicating agencies')
        );
        expect(mockDuplicateLines).not.toHaveBeenCalled();
    });

    it('returns an error status if line duplication fails', async () => {
        mockDuplicateLines.mockResolvedValue(Status.createError('line duplication failed'));

        expect(await duplicateAgencies({ agencyIds, newObjectsSuffix: ' copy' })).toEqual(
            Status.createError('An error occurred while duplicating agencies')
        );
    });

    it('returns an error status when no available suffix is found', async () => {
        mockIsAcronymSuffixClash.mockResolvedValue(true);

        expect(await duplicateAgencies({ agencyIds, newObjectsSuffix: ' copy' })).toEqual(
            Status.createError('An error occurred while duplicating agencies')
        );
        expect(mockIsAcronymSuffixClash).toHaveBeenCalledTimes(21);
        expect(mockDuplicateAgencies).not.toHaveBeenCalled();
    });
});
