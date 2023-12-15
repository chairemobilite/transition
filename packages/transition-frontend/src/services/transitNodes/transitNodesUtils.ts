/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitApi } from 'transition-common/lib/api/transit';

export const deleteUnusedNodes = async (nodeIds?: string[] | null): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        serviceLocator.socketEventManager.emit(
            TransitApi.DELETE_UNUSED_NODES,
            nodeIds,
            async (responseStatus: Status.Status<string[]>) => {
                if (Status.isStatusOk(responseStatus)) {
                    await serviceLocator.collectionManager
                        .get('nodes')
                        .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
                    resolve(Status.unwrap(responseStatus));
                } else {
                    reject('Error deleting unused nodes');
                }
            }
        );
    });
};
