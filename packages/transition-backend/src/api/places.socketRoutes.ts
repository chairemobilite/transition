/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import geobuf from 'geobuf';
import Pbf from 'pbf';
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import placesDbQueries from '../models/db/places.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

export default function (socket: EventEmitter) {
    socket.on('place.update', async (id, attributes, callback) => {
        try {
            const updatedId = await placesDbQueries.update(id, attributes);
            callback({ id: updatedId });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error updating place' });
        }
    });

    socket.on('place.create', async (attributes, callback) => {
        try {
            const returning = await placesDbQueries.create(attributes, 'id');
            callback({ id: returning });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error creating place' });
        }
    });

    socket.on('place.delete', async (id, callback) => {
        try {
            const deletedId = await placesDbQueries.delete(id);
            callback(Status.createOk({ id: deletedId }));
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.export() : 'Error deleting place'));
        }
    });

    socket.on(
        'places.geojsonCollection',
        async (
            params = {
                dataSourceIds: [],
                sampleSize: undefined,
                format: 'geojson'
            },
            callback
        ) => {
            try {
                const geojson = await placesDbQueries.geojsonCollection(params.dataSourceIds, params.sampleSize);
                if (params.format === 'geobuf') {
                    const geobufjson = Buffer.from(geobuf.encode(geojson, new Pbf()));
                    callback({ geobuf: geobufjson });
                } else {
                    callback({ geojson });
                }
            } catch (error) {
                console.error(error);
                callback(
                    TrError.isTrError(error) ? error.export() : { error: 'Error getting place geojson collection' }
                );
            }
        }
    );

    socket.on(
        'places.collection',
        async (dataSourceIds: string[] | undefined, sampleSize: number | undefined, callback) => {
            try {
                const collection = await placesDbQueries.collection(dataSourceIds, sampleSize);
                callback({ collection });
            } catch (error) {
                console.error(error);
                callback(TrError.isTrError(error) ? error.export() : { error: 'Error getting place collection' });
            }
        }
    );
}
