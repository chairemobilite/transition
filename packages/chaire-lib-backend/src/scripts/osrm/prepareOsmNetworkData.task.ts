/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PrepareOsmNetworkData } from '../../tasks/osrm/prepareOsmNetworkData';
import taskWrapper from '../../tasks/taskWrapper';
import { fileManager } from '../../utils/filesystem/fileManager';

taskWrapper(new PrepareOsmNetworkData(fileManager))
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
