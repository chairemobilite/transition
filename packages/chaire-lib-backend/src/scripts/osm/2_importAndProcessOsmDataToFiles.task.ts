/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import prepareOsmData from '../../tasks/dataImport/prepareOsmDataForImport';
import taskWrapper from '../../tasks/taskWrapper';

import { fileManager } from '../../utils/filesystem/fileManager';

taskWrapper(new prepareOsmData(fileManager))
    .then(() => {
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        process.exit();
    });
