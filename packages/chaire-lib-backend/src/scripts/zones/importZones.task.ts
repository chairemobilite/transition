/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import '../../config/dotenv.config'; // Unused, but must be imported
import { ImportZonesFromGeojson } from '../../tasks/zones/importZonesFromGeojson';
import taskWrapper from '../../tasks/taskWrapper';

taskWrapper(new ImportZonesFromGeojson())
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
