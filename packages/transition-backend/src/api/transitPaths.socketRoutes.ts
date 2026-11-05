/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { EventEmitter } from 'events';
import type { LineString } from 'geojson';
import { point as turfPoint } from '@turf/turf';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import type { CurveAnalysisResponse } from 'transition-common/lib/services/path/railCurves/types';
import { isRailMode } from 'transition-common/lib/services/line/types';
import { findCoarseVertices } from 'transition-common/lib/services/path/PathVertexGeometry';
import pathsDbQueries from '../models/db/transitPaths.db.queries';
import { analyzeCurveRadius } from '../services/path/railCurves/curvatureAnalysis';

/** Untrusted socket payload. The mode and the speed are checked before use. */
type CurveAnalysisRequest = {
    geography?: LineString;
    mode?: unknown;
    runningSpeedKmH?: unknown;
};

/**
 * Add routes specific to transit paths objects
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function (socket: EventEmitter) {
    socket.on(
        'transitPaths.getForScenario',
        async (
            scenarioId: string,
            callback: (status: Status.Status<GeoJSON.FeatureCollection<GeoJSON.LineString>>) => void
        ) => {
            try {
                const paths = await pathsDbQueries.geojsonCollection({ scenarioId });
                callback(Status.createOk(paths));
            } catch (error) {
                console.error(`An error occurred while getting paths for scenario ${scenarioId}: ${error}`);
                if (typeof callback === 'function') {
                    callback(Status.createError('Error getting paths for scenario'));
                }
            }
        }
    );

    socket.on(
        'transitPaths.getForServices',
        async (
            serviceIds: string[],
            callback: (status: Status.Status<GeoJSON.FeatureCollection<GeoJSON.LineString>>) => void
        ) => {
            try {
                const paths = await pathsDbQueries.geojsonCollectionForServices(serviceIds);
                callback(Status.createOk(paths));
            } catch (error) {
                console.error(`An error occurred while getting paths for services ${serviceIds}: ${error}`);
                if (typeof callback === 'function') {
                    callback(Status.createError('Error getting paths for services'));
                }
            }
        }
    );

    socket.on(
        'transitPaths.curveAnalysis',
        (
            request: CurveAnalysisRequest | null | undefined,
            callback: (status: Status.Status<CurveAnalysisResponse>) => void
        ) => {
            try {
                // Destructured in the try block, so a missing payload returns an error status
                const { geography, mode, runningSpeedKmH } = request ?? {};
                // Only rail modes are accepted, so other strings cannot select a speed coefficient
                if (typeof mode !== 'string' || !isRailMode(mode)) {
                    callback(Status.createError('Curve analysis is only available for rail modes'));
                    return;
                }
                // The caller sends the path running speed, which the path always has from its mode defaults
                if (typeof runningSpeedKmH !== 'number' || !Number.isFinite(runningSpeedKmH) || runningSpeedKmH <= 0) {
                    callback(Status.createError('Curve analysis requires a positive running speed'));
                    return;
                }
                const coordinates = geography?.coordinates;
                if (!geography || !Array.isArray(coordinates) || coordinates.length < 3) {
                    callback(Status.createOk({ segments: [], unreliableRadiusVertices: [] }));
                    return;
                }
                callback(
                    Status.createOk({
                        segments: analyzeCurveRadius(geography, { mode, runningSpeedKmH }),
                        unreliableRadiusVertices: findCoarseVertices(coordinates).map(({ index }) =>
                            turfPoint(coordinates[index])
                        )
                    })
                );
            } catch (error) {
                console.error(`Error in transitPaths.curveAnalysis: ${error}`);
                callback(Status.createError('Error performing curve analysis'));
            }
        }
    );
}
