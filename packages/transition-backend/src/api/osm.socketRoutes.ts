/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { getStreetsAroundPoint } from '../services/osm/OsmGetStreetsAroundPoint';

export default function (socket: EventEmitter) {
    socket.on(
        'osm.streetsAroundPoint',
        async (
            aroundPoint: GeoJSON.Feature<GeoJSON.Point>,
            radiusMeters: number,
            callback?: (status: Status.Status<GeoJSON.Feature<GeoJSON.LineString>[]>) => void
        ) => {
            const streetsGeojsonFeatures = await getStreetsAroundPoint(aroundPoint, radiusMeters);
            if (typeof callback === 'function') {
                callback(streetsGeojsonFeatures);
            }
        }
    );
}
