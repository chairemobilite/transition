/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Task wrapper should be imported first for the config and dotenv to be loaded before any other import
import taskWrapper from '../../tasks/taskWrapper';
import { PrepareOsmNetworkData } from '../../tasks/osrm/prepareOsmNetworkData';

taskWrapper(new PrepareOsmNetworkData())
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
