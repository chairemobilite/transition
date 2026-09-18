/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { EventEmitter } from 'events';

import dataSourcesDbQueries from '../models/db/dataSources.db.queries';

/**
 * Add routes specific to the transit objects
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function (socket: EventEmitter, userId?: number) {
    socket.on('dataSources.collection', async (_dataSourceId, callback) => {
        try {
            const collection = await dataSourcesDbQueries.collection({ userId });
            callback({ collection });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error retrieving data sources' });
        }
    });
}
