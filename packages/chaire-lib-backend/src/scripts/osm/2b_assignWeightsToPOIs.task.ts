/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import assignWeightToPOIs from '../../tasks/dataImport/assignWeightToPOIs';
import taskWrapper from '../../tasks/taskWrapper';

import { fileManager } from '../../utils/filesystem/fileManager';

/* This task is optional. For now, it uses the Trip Generation Manual fucntions
to generate weight (number of generated trip destinations per weekday)
*/
taskWrapper(new assignWeightToPOIs(fileManager))
    .then(() => {
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        process.exit();
    });
