/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { LineString, Feature, Point } from 'geojson';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import type {
    CurveRadiusAnalysis,
    PathTravelTimeAnalysis,
    TimeSpeedProfile,
    SpeedProfileOptions
} from 'transition-common/lib/services/path/railCurves/types';
import type { RailMode } from 'transition-common/lib/services/line/types';
import { analyzeCurveRadius } from '../services/path/railCurves/curvatureAnalysis';
import { analyzePathSegmentTravelTimes } from '../services/path/railCurves/segmentTravelTime';
import { getSpeedByTimeWithDwellTimes } from '../services/path/railCurves/speedProfile';
import { computeLargeAngleVertices } from '../services/path/railCurves/geometry';

type CurveAnalysisRequest = {
    geography: LineString;
    segments: number[];
    dwellTimeSeconds: number[];
    mode: RailMode;
    runningSpeedKmH: number;
    accelerationMps2: number;
    decelerationMps2: number;
};

type CurveAnalysisResponse = {
    travelTimeAnalysis: PathTravelTimeAnalysis | null;
    speedProfile: TimeSpeedProfile | null;
    curveRadius: CurveRadiusAnalysis | null;
    largeAngleVertices: Feature<Point>[] | null;
};

export default function (socket: EventEmitter) {
    socket.on(
        'transitPaths.curveAnalysis',
        async (params: CurveAnalysisRequest, callback: (status: Status.Status<CurveAnalysisResponse>) => void) => {
            try {
                const {
                    geography,
                    segments,
                    dwellTimeSeconds,
                    mode,
                    runningSpeedKmH,
                    accelerationMps2,
                    decelerationMps2
                } = params;

                if (!geography || !geography.coordinates || geography.coordinates.length < 2) {
                    callback(
                        Status.createOk({
                            travelTimeAnalysis: null,
                            speedProfile: null,
                            curveRadius: null,
                            largeAngleVertices: null
                        })
                    );
                    return;
                }

                const coordinates = geography.coordinates;
                const opts: SpeedProfileOptions = {
                    mode,
                    runningSpeedKmH,
                    accelerationMps2,
                    decelerationMps2,
                    maxSpeedKmH: runningSpeedKmH
                };

                const travelTimeAnalysis = analyzePathSegmentTravelTimes({ attributes: { geography, segments } }, opts);

                let speedProfile: TimeSpeedProfile | null = null;
                if (segments && segments.length >= 1) {
                    speedProfile = getSpeedByTimeWithDwellTimes(
                        geography,
                        segments,
                        dwellTimeSeconds || [],
                        {
                            ...opts,
                            initialSpeedKmH: 0,
                            finalSpeedKmH: 0
                        },
                        2
                    );
                }

                const curveRadius = coordinates.length >= 3 ? analyzeCurveRadius(geography, opts) : null;

                const largeAngleVertices = computeLargeAngleVertices(coordinates);

                callback(
                    Status.createOk({
                        travelTimeAnalysis,
                        speedProfile,
                        curveRadius,
                        largeAngleVertices
                    })
                );
            } catch (error) {
                console.error(`Error in transitPaths.curveAnalysis: ${error}`);
                if (typeof callback === 'function') {
                    callback(Status.createError('Error performing curve analysis'));
                }
            }
        }
    );
}
