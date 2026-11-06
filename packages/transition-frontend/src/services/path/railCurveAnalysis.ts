/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

import type * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import type { RailMode } from 'transition-common/lib/services/line/types';
import type { CurveAnalysisResponse, CurveSegment } from 'transition-common/lib/services/path/railCurves/types';

/**
 * Request the curve analysis of a rail path geography from the server.
 *
 * @param {LineString} geography Path geography
 * @param {RailMode} mode Rail mode of the path line
 * @param {number} runningSpeedKmH Running speed of the path, in km/h
 * @returns {Promise<Status.Status<CurveAnalysisResponse>>} The analysis, or an error status
 */
export const requestRailCurveAnalysis = (
    geography: LineString,
    mode: RailMode,
    runningSpeedKmH: number
): Promise<Status.Status<CurveAnalysisResponse>> =>
    new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(
            'transitPaths.curveAnalysis',
            { geography, mode, runningSpeedKmH },
            resolve
        );
    });

/**
 * Line features for the curve segments whose radius limits the speed below
 * the running speed.
 *
 * @param {Position[]} coordinates Coordinates that were analyzed. The segment
 * indices refer to them.
 * @param {CurveSegment[]} segments Segments of the analysis
 * @returns {FeatureCollection<LineString>} One line feature per curve segment,
 * with its median and minimum radius and its length, rounded to the meter
 */
export const curveSegmentsToGeojson = (
    coordinates: Position[],
    segments: CurveSegment[]
): FeatureCollection<LineString> => {
    const features: Feature<LineString>[] = segments
        .filter((segment) => segment.type === 'curve' && segment.endIndex > segment.startIndex)
        .map((segment) => ({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates.slice(segment.startIndex, segment.endIndex + 1)
            },
            properties: {
                medianRadiusMeters: Math.round(segment.medianRadiusMeters),
                minRadiusMeters: Math.round(segment.minRadiusMeters),
                lengthMeters: Math.round(segment.lengthMeters)
            }
        }));
    return turfFeatureCollection(features);
};
