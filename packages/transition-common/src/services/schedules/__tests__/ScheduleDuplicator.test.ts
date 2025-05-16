/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _omit from 'lodash/omit';
import EventEmitter from 'events';
import { v4 as uuidV4 } from 'uuid';

import { duplicateSchedules } from '../ScheduleDuplicator';
import * as Status from 'chaire-lib-common/lib/utils/Status';

const socketStub = new EventEmitter();

let nextResult: Status.Status<{ [oldSchedId: number]: number }> = Status.createOk({ 3: 4, 5: 6 });
const transitScheduleHandlerMock = jest.fn().mockImplementation(async (mapping, callback) => {
    callback(nextResult);
});
socketStub.on('transitSchedules.duplicate', transitScheduleHandlerMock);

beforeEach(() => {
    jest.clearAllMocks();
})

test('Duplicate schedules with mapping and return ok', async () => {
    const expectedNextResult = Status.createOk({ 3: 4, 5: 6 });
    nextResult = _cloneDeep(expectedNextResult);
    const mappings = {
        lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
        serviceIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() },
        pathIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
    };
    const result = await duplicateSchedules(socketStub, mappings);
    expect(result).toEqual(Status.unwrap(expectedNextResult));
    expect(transitScheduleHandlerMock).toHaveBeenCalledWith(mappings, expect.any(Function));
});

test('Duplicate schedule, different line, path and services', async () => {
    const expectedNextResult = Status.createError('socket: Error duplicating schedules');
    nextResult = _cloneDeep(expectedNextResult);
    const mappings = {
        lineIdMapping: { [uuidV4()]: uuidV4(), [uuidV4()]: uuidV4() }
    };
    await expect(duplicateSchedules(socketStub, mappings)).rejects.toThrow('Error duplicating schedules');
    expect(transitScheduleHandlerMock).toHaveBeenCalledWith(mappings, expect.any(Function));
});