/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { EventEmitter } from 'events';
import type { LineString } from 'geojson';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import type { CurveAnalysisResponse } from 'transition-common/lib/services/path/railCurves/types';
import { getDefaultRunningSpeedKmH, isRailMode } from 'transition-common/lib/services/line/types';
import { analyzeCurveRadius } from '../services/path/railCurves/curvatureAnalysis';
import { computeLargeAngleVertices } from '../services/path/railCurves/geometry';

/** Untrusted socket payload. The mode and the speed are checked before use. */
type CurveAnalysisRequest = {
    geography?: LineString;
    mode?: unknown;
    runningSpeedKmH?: unknown;
};

export default function (socket: EventEmitter) {
    socket.on(
        'transitPaths.curveAnalysis',
        async (
            { geography, mode, runningSpeedKmH }: CurveAnalysisRequest,
            callback: (status: Status.Status<CurveAnalysisResponse>) => void
        ) => {
            try {
                // Only rail modes are accepted, so other strings cannot select a speed coefficient
                if (typeof mode !== 'string' || !isRailMode(mode)) {
                    callback(Status.createError('Curve analysis is only available for rail modes'));
                    return;
                }
                const coordinates = geography?.coordinates;
                if (!geography || !Array.isArray(coordinates) || coordinates.length < 3) {
                    callback(Status.createOk({ curveRadius: null, largeAngleVertices: [] }));
                    return;
                }
                // Non-finite or non-positive speeds are replaced by the mode default
                const speedKmH =
                    typeof runningSpeedKmH === 'number' && Number.isFinite(runningSpeedKmH) && runningSpeedKmH > 0
                        ? runningSpeedKmH
                        : getDefaultRunningSpeedKmH(mode);
                callback(
                    Status.createOk({
                        curveRadius: analyzeCurveRadius(geography, { mode, runningSpeedKmH: speedKmH }),
                        largeAngleVertices: computeLargeAngleVertices(coordinates)
                    })
                );
            } catch (error) {
                console.error(`Error in transitPaths.curveAnalysis: ${error}`);
                callback(Status.createError('Error performing curve analysis'));
            }
        }
    );
}
