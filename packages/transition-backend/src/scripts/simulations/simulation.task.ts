/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import '../../config/app.config';

import prepareSocketRoutes from '../prepareProcessRoutes';
import { registerTranslationDir, addTranslationNamespace } from 'chaire-lib-backend/lib/config/i18next';

import RunSimulation from '../../tasks/simulation/runSimulation';
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';
import OSRMProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';

addTranslationNamespace('transit');
registerTranslationDir(__dirname + '/../../../../../locales/');

const run = async () => {
    // Prepare socket routes to be able to use them
    prepareSocketRoutes();
    await OSRMProcessManager.configureAllOsrmServers(false);

    await taskWrapper(new RunSimulation());
};

run()
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
