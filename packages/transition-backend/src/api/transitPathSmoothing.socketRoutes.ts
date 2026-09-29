/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { chaikinSmoothPath } from '../services/path/chaikinSmoothing';

type SmoothPathRequest = {
    coordinates: [number, number][];
    nodeIndices: number[];
    iterations?: number;
};

type SmoothPathResponse = {
    waypoints: [number, number][][];
};

export default function (socket: EventEmitter) {
    socket.on(
        'transitPaths.smoothPath',
        (params: SmoothPathRequest, callback: (status: Status.Status<SmoothPathResponse>) => void) => {
            try {
                const { coordinates, nodeIndices, iterations = 2 } = params;

                if (!coordinates || coordinates.length < 2 || !nodeIndices || nodeIndices.length < 1) {
                    callback(Status.createOk({ waypoints: [] }));
                    return;
                }

                const waypoints = chaikinSmoothPath(coordinates, nodeIndices, iterations) as [number, number][][];
                callback(Status.createOk({ waypoints }));
            } catch (error) {
                console.error(`Error in transitPaths.smoothPath: ${error}`);
                if (typeof callback === 'function') {
                    callback(Status.createError('Error smoothing path'));
                }
            }
        }
    );
}
