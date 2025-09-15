/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { ImportDisseminationBlocks } from '../../tasks/disseminationBlocks/importDisseminationBlocks';
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';

taskWrapper(new ImportDisseminationBlocks())
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
