/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-common/lib/config/shared/dotenv.config';
import prepareSocketRoutes from '../prepareProcessRoutes';
import { recreateCache } from '../../services/capnpCache/dbToCache';
import OSRMProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';

/**
 * Recreate the cache files from the database. The OSRM 'walking' server must be
 * running to refresh the transferrable nodes.
 */
const run = async () => {
    // Prepare socket routes to be able to use them
    prepareSocketRoutes();
    await OSRMProcessManager.configureAllOsrmServers(false);

    // TODO get cachePathDIrectory from params
    await recreateCache({ refreshTransferrableNodes: true, saveLines: true });
};

run()
    .then(() => {
        console.log('Cache recreated successfully');
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((error) => {
        console.error('Recreating the cache did not complete correctly', error);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
