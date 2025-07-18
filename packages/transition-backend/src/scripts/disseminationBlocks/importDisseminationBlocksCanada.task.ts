/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { ImportDisseminationBlocksCanada } from '../../tasks/disseminationBlocks/importDisseminationBlocksCanada';
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';

taskWrapper(new ImportDisseminationBlocksCanada())
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
