/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Import taskWrapper first to load all configuration
import taskWrapper from '../../tasks/taskWrapper';
import downloadOsmData from 'chaire-lib-common/lib/tasks/dataImport/downloadOsmData';

import { fileManager } from '../../utils/filesystem/fileManager';
import { CliPromptGeojsonPolygonService } from '../../services/prompt/CliPromptGeojsonPolygonService';

// TODO: remove boundaries and large polygons that we will never use (like countries and states boundaries)

taskWrapper(
    new downloadOsmData(
        fileManager,
        new CliPromptGeojsonPolygonService(fileManager.directoryManager.projectDirectory + '/imports/')
    )
)
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
