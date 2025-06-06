/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as Status from 'chaire-lib-common/lib/utils/Status';

export interface DuplicateScheduleOptions {
    lineIdMapping?: { [key: string]: string };
    serviceIdMapping?: { [key: string]: string };
    pathIdMapping?: { [key: string]: string };
}

/**
 * Duplicate schedules from mapping. Makes a call to the backend
 *
 * FIXME: This function should be removed from frontend, as it will typically be
 * after a line and/or service duplication, but these are still in the frontend
 */
export const duplicateSchedules = async (
    socket: any,
    mappings: DuplicateScheduleOptions
): Promise<{ [key: number]: number }> => {
    return new Promise<{ [key: number]: number }>((resolve, reject) => {
        socket.emit('transitSchedules.duplicate', mappings, (response: Status.Status<{ [key: number]: number }>) => {
            if (Status.isStatusOk(response)) {
                resolve(Status.unwrap(response));
            } else {
                reject(new Error('Error duplicating schedules'));
            }
        });
    });
};
