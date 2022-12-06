/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { recreateCache } from '../services/capnpCache/dbToCache';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as lineCacheQueries from '../models/capnpCache/transitLines.cache.queries';
import linesDbQueries from '../models/db/transitLines.db.queries';
import Line from 'transition-common/lib/services/line/Line';

export default function (socket: EventEmitter) {
    socket.on(
        'cache.saveAll',
        async (
            callback: (status: Status.Status<boolean>) => void = () => {
                /* empty function */
            }
        ) => {
            // FIXME We can't refresh the transferrable nodes from here, the Node method to
            // do so requires socket access that is not available on the main server
            // process. Besides, the interface has a separate button to refresh them.
            // TODO Return a status in the callback instead
            // TODO get cachePathDIrectory from params
            try {
                await recreateCache({
                    refreshTransferrableNodes: false,
                    saveLines: false
                });
                callback(Status.createOk(true));
                socket.emit('cache.clean');
            } catch (error) {
                console.error('Error recreating cache: ', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error saving cache'));
            }
        }
    );

    socket.on(
        'cache.saveLines',
        async (
            lineIds: string[],
            callback: (status: Status.Status<boolean>) => void = () => {
                /* empty function */
            }
        ) => {
            // Save specific line objects to cache, for example when deleting a service that has scheduled lines
            // TODO Move to its own method? Or remove the need for this at all?
            try {
                const lines = await linesDbQueries.collection(lineIds);
                const affectedLines = lines.map((lineAttributes) => new Line(lineAttributes, false));
                await linesDbQueries.collectionWithSchedules(affectedLines);
                await lineCacheQueries.objectsToCache(affectedLines);
                callback(Status.createOk(true));
            } catch (error) {
                console.error('Error saving lines to cache: ', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error saving lines to cache'));
            }
        }
    );
}
