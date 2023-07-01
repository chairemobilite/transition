/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Import taskWrapper first to load all configuration
import taskWrapper from '../../tasks/taskWrapper';
import enhanceAndSaveOsmPolygonData from 'chaire-lib-common/lib/tasks/dataImport/enhanceAndSaveOsmPolygonData';

import { fileManager } from '../../utils/filesystem/fileManager';

/* This task is optional. For now, it adds the polygon area in sq meters,
for polygons, it calculates the area and the floor area using the building:levels
value and the calculated area, or it takes the existing floor area from
the building:floor_area tag, which is supposed to be in sq meters.
*/
taskWrapper(new enhanceAndSaveOsmPolygonData(fileManager))
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
