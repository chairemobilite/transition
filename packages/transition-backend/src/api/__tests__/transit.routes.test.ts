/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitRoutes from '../transit.socketRoutes';
import transitScheduleQueries from '../../models/db/transitSchedules.db.queries';

const socketStub = new EventEmitter();
transitRoutes(socketStub);

const mockedDbQuery = jest.fn();

jest.mock('../../models/db/transitNodes.db.queries', () => {
    return {
        getAssociatedPathIds: jest.fn().mockImplementation(async () => {
            return mockedDbQuery();
        })
    }
});

jest.mock('../../models/db/transitSchedules.db.queries', () => {
    return {
        readForLine: jest.fn()
    }
});
const mockedReadForLine = transitScheduleQueries.readForLine as jest.MockedFunction<typeof transitScheduleQueries.readForLine>;

describe('Nodes: get associated path ids', () => {

    const nodeIds = [
        uuidV4(),
        uuidV4()
    ];

    const pathIds = [
        uuidV4(),
        uuidV4()
    ];

    test('Get associated path ids correctly', (done) => {
        mockedDbQuery.mockResolvedValueOnce({
            [nodeIds[0]]: [],
            [nodeIds[1]]: pathIds
        });
        //TODO
        socketStub.emit('transitNodes.getAssociatedPathIdsByNodeId', [uuidV4(), uuidV4()], function (status) {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual({
                [nodeIds[0]]: [],
                [nodeIds[1]]: pathIds
            });
            done();
        });
    });

    test('Get associated path ids with error', (done) => {
        mockedDbQuery.mockRejectedValueOnce('Error getting nodes associated path ids');
        //TODO
        socketStub.emit('transitNodes.getAssociatedPathIdsByNodeId', ['foo'], function (status) {
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toBe('Error getting nodes associated path ids');
            done();
        });
    });
});

describe('Schedules: get schedules for line', () => {

    const lineId = uuidV4();
    const serviceId1 = uuidV4();
    const serviceId2 = uuidV4();

    test('Get schedules for line correctly', (done) => {
        const schedulesAttributes = [
            {
                id: uuidV4(),
                line_id: lineId,
                service_id: serviceId1,
                periods: [],
                data: {}
            },
            {
                id: uuidV4(),
                line_id: lineId,
                service_id: serviceId2,
                periods: [],
                data: {}
            }
        ];
        mockedReadForLine.mockResolvedValueOnce(schedulesAttributes);
        socketStub.emit('transitSchedules.getForLine', lineId, function (status) {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual(schedulesAttributes);
            done();
        });
    });

    test('Get schedules for line with error', (done) => {
        mockedReadForLine.mockRejectedValueOnce('Error getting schedules for line');
        socketStub.emit('transitSchedules.getForLine', lineId, function (status) {
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toBe('Error getting schedules for line');
            done();
        });
    });
});