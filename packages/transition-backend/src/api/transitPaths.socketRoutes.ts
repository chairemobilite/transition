/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import pathsDbQueries from '../models/db/transitPaths.db.queries';

/**
 * Add routes specific to transit paths objects
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function(socket: EventEmitter) {
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
}
