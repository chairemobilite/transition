/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { duplicateLines } from '../LineDuplicator';
import transitLinesDbQueries from '../../../../models/db/transitLines.db.queries';
import { duplicatePaths } from '../../transitPaths/PathDuplicator';
import { duplicateServices } from '../../transitServices/ServiceDuplicator';
import { duplicateSchedules, getServiceIdsForLines } from '../../transitSchedules/ScheduleUtils';

const transactionObjectMock = new Object(3) as any;

jest.mock('chaire-lib-backend/lib/config/shared/db.config', () => ({
    transaction: jest.fn()
}));
jest.mock('../../../../models/db/transitLines.db.queries', () => ({
    duplicate: jest.fn()
}));
jest.mock('../../transitPaths/PathDuplicator', () => ({
    duplicatePaths: jest.fn()
}));
jest.mock('../../transitServices/ServiceDuplicator', () => ({
    duplicateServices: jest.fn()
}));
jest.mock('../../transitSchedules/ScheduleUtils', () => ({
    duplicateSchedules: jest.fn(),
    getServiceIdsForLines: jest.fn()
}));

const mockTransaction = knex.transaction as jest.MockedFunction<typeof knex.transaction>;
const mockDuplicateLines = transitLinesDbQueries.duplicate as jest.MockedFunction<
    typeof transitLinesDbQueries.duplicate
>;
const mockDuplicatePaths = duplicatePaths as jest.MockedFunction<typeof duplicatePaths>;
const mockDuplicateServices = duplicateServices as jest.MockedFunction<typeof duplicateServices>;
const mockDuplicateSchedules = duplicateSchedules as jest.MockedFunction<typeof duplicateSchedules>;
const mockGetServiceIdsForLines = getServiceIdsForLines as jest.MockedFunction<typeof getServiceIdsForLines>;

describe('duplicateLines', () => {
    const lineIds = ['line1', 'line2'];
    const lineIdMapping = { line1: 'line1-copy', line2: 'line2-copy' };
    const pathIdMapping = { path1: 'path1-copy', path2: 'path2-copy' };
    const serviceIds = ['service1', 'service2'];
    const serviceIdMapping = { service1: 'service1-copy', service2: 'service2-copy' };

    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockTransaction.mockImplementation(async (callback) => callback(transactionObjectMock));
        mockDuplicateLines.mockResolvedValue(lineIdMapping);
        mockDuplicatePaths.mockResolvedValue(Status.createOk(pathIdMapping));
        mockGetServiceIdsForLines.mockResolvedValue(serviceIds);
        mockDuplicateServices.mockResolvedValue(Status.createOk(serviceIdMapping));
        mockDuplicateSchedules.mockResolvedValue(Status.createOk({}));
    });

    it('duplicates lines and their paths in a transaction', async () => {
        const options = {
            lineIds,
            agencyIdMapping: { agency1: 'agency1-copy' },
            newObjectsSuffix: ' copy'
        };

        expect(await duplicateLines(options)).toEqual(Status.createOk(lineIdMapping));
        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockDuplicateLines).toHaveBeenCalledWith({
            lineIds,
            agencyIdMapping: options.agencyIdMapping,
            newLineSuffix: options.newObjectsSuffix,
            transaction: transactionObjectMock
        });
        expect(mockDuplicatePaths).toHaveBeenCalledWith(
            { lineIdMapping },
            { transaction: transactionObjectMock }
        );
        expect(mockGetServiceIdsForLines).not.toHaveBeenCalled();
        expect(mockDuplicateServices).not.toHaveBeenCalled();
        expect(mockDuplicateSchedules).not.toHaveBeenCalled();
    });

    it('uses the provided transaction instead of starting a new one', async () => {
        expect(
            await duplicateLines({ lineIds }, { transaction: transactionObjectMock })
        ).toEqual(Status.createOk(lineIdMapping));

        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockDuplicateLines).toHaveBeenCalledWith({
            lineIds,
            agencyIdMapping: undefined,
            newLineSuffix: undefined,
            transaction: transactionObjectMock
        });
    });

    it('duplicates schedules and services when requested', async () => {
        const options = {
            lineIds,
            duplicateSchedules: true,
            duplicateServices: true,
            newObjectsSuffix: ' copy'
        };

        expect(await duplicateLines(options)).toEqual(Status.createOk(lineIdMapping));
        expect(mockGetServiceIdsForLines).toHaveBeenCalledWith(Object.keys(lineIdMapping), {
            transaction: transactionObjectMock
        });
        expect(mockDuplicateServices).toHaveBeenCalledWith(
            { serviceIds, newServiceSuffix: options.newObjectsSuffix },
            { transaction: transactionObjectMock }
        );
        expect(mockDuplicateSchedules).toHaveBeenCalledWith(
            { lineIdMapping, pathIdMapping, serviceIdMapping },
            { transaction: transactionObjectMock }
        );
    });

    it('duplicates schedules without duplicating services when that option is disabled', async () => {
        expect(
            await duplicateLines({ lineIds, duplicateSchedules: true, duplicateServices: false })
        ).toEqual(Status.createOk(lineIdMapping));

        expect(mockGetServiceIdsForLines).toHaveBeenCalledWith(Object.keys(lineIdMapping), {
            transaction: transactionObjectMock
        });
        expect(mockDuplicateServices).not.toHaveBeenCalled();
        expect(mockDuplicateSchedules).toHaveBeenCalledWith(
            { lineIdMapping, pathIdMapping, serviceIdMapping: {} },
            { transaction: transactionObjectMock }
        );
    });

    it('chunks line and service mappings while reusing duplicated services', async () => {
        // Size of the mappings to test and the expected chunk size (change if chunk size changes in the LineDuplicator code)
        const mappingSize = 30;
        const expectedChunkSize = 20;
        const sourceLineIds = Array.from({ length: mappingSize }, (_, index) => `line-${index}`);
        const largeLineIdMapping = Object.fromEntries(sourceLineIds.map(id => [id, `${id}-copy`]));
        const sourceServiceIds = Array.from({ length: mappingSize }, (_, index) => `service-${index}`);
        const largeServiceIdMapping = Object.fromEntries(sourceServiceIds.map(id => [id, `${id}-copy`]));
        mockDuplicateLines.mockResolvedValue(largeLineIdMapping);
        mockGetServiceIdsForLines.mockResolvedValue(sourceServiceIds);
        mockDuplicatePaths.mockImplementation(async ({ lineIdMapping }) =>
            Status.createOk(
                Object.fromEntries(
                    Object.keys(lineIdMapping ?? {}).map(lineId => [`path-${lineId}`, `path-${lineId}-copy`])
                )
            )
        );
        mockDuplicateServices.mockImplementation(async ({ serviceIds: ids }) =>
            Status.createOk(Object.fromEntries(ids.map(id => [id, largeServiceIdMapping[id]])))
        );

        expect(await duplicateLines({ lineIds, duplicateSchedules: true, duplicateServices: true })).toEqual(
            Status.createOk(largeLineIdMapping)
        );

        expect(mockDuplicatePaths).toHaveBeenCalledTimes(2);
        expect(mockDuplicatePaths.mock.calls.map(([options]) => Object.keys(options.lineIdMapping ?? {}).length)).toEqual([
            expectedChunkSize,
            mappingSize - expectedChunkSize
        ]);
        for (const [options] of mockDuplicatePaths.mock.calls) {
            const lineIdsInChunk = Object.keys(options.lineIdMapping ?? {});
            expect(Object.keys(options.lineIdMapping ?? {}).every(id => sourceLineIds.includes(id))).toBe(true);
            expect(Object.keys(options.lineIdMapping ?? {}).length).toBeLessThanOrEqual(expectedChunkSize);

            const scheduleCalls = mockDuplicateSchedules.mock.calls.filter(
                ([mappings]) => Object.keys(mappings.lineIdMapping ?? {}).join(',') === lineIdsInChunk.join(',')
            );
            expect(scheduleCalls.length).toBe(2);
            for (const [mappings] of scheduleCalls) {
                expect(Object.keys(mappings.pathIdMapping ?? {})).toEqual(lineIdsInChunk.map(id => `path-${id}`));
                expect(Object.keys(mappings.serviceIdMapping ?? {}).length).toBeLessThanOrEqual(expectedChunkSize);
            }
        }

        expect(mockDuplicateServices).toHaveBeenCalledTimes(2);
        expect(mockDuplicateServices.mock.calls.map(([options]) => options.serviceIds.length)).toEqual([expectedChunkSize, mappingSize - expectedChunkSize]);
        expect(mockDuplicateServices.mock.calls.flatMap(([options]) => options.serviceIds).sort()).toEqual(
            [...sourceServiceIds].sort()
        );
        expect(mockGetServiceIdsForLines).toHaveBeenCalledTimes(2);
        expect(mockDuplicateSchedules).toHaveBeenCalledTimes(4);
    });

    it('does not duplicate paths or schedules when no lines were duplicated', async () => {
        mockDuplicateLines.mockResolvedValue({});

        expect(await duplicateLines({ lineIds })).toEqual(Status.createOk({}));
        expect(mockDuplicatePaths).not.toHaveBeenCalled();
        expect(mockGetServiceIdsForLines).not.toHaveBeenCalled();
        expect(mockDuplicateSchedules).not.toHaveBeenCalled();
    });

    it('returns an error status if a dependent duplication fails', async () => {
        mockDuplicatePaths.mockResolvedValue(Status.createError('path duplication failed'));

        expect(await duplicateLines({ lineIds })).toEqual(
            Status.createError('An error occurred while duplicating lines')
        );
        expect(mockDuplicateSchedules).not.toHaveBeenCalled();
    });

    it('returns an error status if line duplication throws', async () => {
        mockDuplicateLines.mockRejectedValue(new Error('database error'));

        expect(await duplicateLines({ lineIds })).toEqual(
            Status.createError('An error occurred while duplicating lines')
        );
        expect(mockDuplicatePaths).not.toHaveBeenCalled();
    });
});
