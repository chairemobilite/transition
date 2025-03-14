/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import ImportPlacesToDb from '../../tasks/dataImport/importPlacesFromGeojson';
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

taskWrapper(new ImportPlacesToDb(fileManager))
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
