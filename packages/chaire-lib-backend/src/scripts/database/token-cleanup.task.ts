/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-backend/lib/config/dotenv.config';
import taskWrapper from '../../tasks/taskWrapper';
import tokensDbQueries from '../../models/db/tokens.db.queries'
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';


class CleanupApiTokenRun implements GenericTask {
    async run(argv: { [key: string]: unknown }): Promise<void> {
        console.log("CleanupApiToken..")
        try {
            tokensDbQueries.cleanExpiredApiTokens()
        } catch (error) {
            throw(error)
        }
    }
}

const run = async () => {
    await taskWrapper(new CleanupApiTokenRun());
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
