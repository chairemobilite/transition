/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import odPairsQueries from '../models/db/odPairs.db.queries';
import { BaseOdTripAttributes } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';

/**
 * Add routes specific to od pairs
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function (socket: EventEmitter) {
    socket.on(
        'odPairs.collection',
        async (
            dataSourceId: string | undefined,
            callback: (
                response:
                    | { collection: BaseOdTripAttributes[] }
                    | { error: string; errorCode?: string; localizedMessage?: TranslatableMessage }
            ) => void
        ) => {
            try {
                const collection = await odPairsQueries.collection(
                    typeof dataSourceId === 'string' ? [dataSourceId] : undefined
                );
                callback({ collection });
            } catch (error) {
                console.error(error);
                callback(TrError.isTrError(error) ? error.export() : { error: 'Error retrieving od pairs' });
            }
        }
    );
}
