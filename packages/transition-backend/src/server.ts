/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { join } from 'path';
import { createServer as httpCreateServer } from 'http';
import { createServer as httpsCreateServer } from 'https';
import { setupServer } from './serverApp';
import setupSocketServerApp from './socketServerApp';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import express from 'express';
import { registerTranslationDir, addTranslationNamespace } from 'chaire-lib-backend/lib/config/i18next';
import config from 'chaire-lib-backend/lib/config/server.config';
import { startPool, terminatePool } from './tasks/serverWorkerPool';
import OSRMProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { ExecutableJob } from './services/executableJob/ExecutableJob';

import { recreateCache } from './services/capnpCache/dbToCache';

/* Function encapsulating the setup of the routing components */
const setupRouting = async function () {
    // We will await with the recreate cache part to let them run in parallel
    const osrmStartAsync = OSRMProcessManager.configureAllOsrmServers(true);

    if (_booleish(process.env.STARTUP_RECREATE_CACHE)) {
        console.log('Recreating cache files');
        // TODO get cachePathDIrectory from params
        // We don't need to refresh the transferrable nodes on startup as they are saved in the DB
        // We can do osrm and write cache in parallel, since we do not recompute the transferables nodes
        await Promise.all([osrmStartAsync, recreateCache({ refreshTransferrableNodes: false, saveLines: true })]);
    } else {
        await osrmStartAsync;
    }

    // Now that we have OSRM and the cache ready, we can start TrRouting
    // We use restart, to cleanup old leftover from previous execution
    const response = await trRoutingProcessManager.restart({});

    if (response.status !== 'started') {
        console.error('failed to start trRouting at startup');
    }
};

/* Create the http server. Optionally handle SSL configuration */
const createHttpServer = function (port: number, useSSL: boolean) {
    const app = express();

    const { session } = setupServer(app);

    if (!useSSL) {
        // Create http server
        try {
            const server = httpCreateServer(app);
            server.listen(port);
            setupSocketServerApp(server, session);
        } catch (err) {
            console.error('Error starting the http server: ', err);
            throw err;
        }
    } else {
        // Create the https server
        const pk = process.env.SSL_PRIVATE_KEY;
        const crt = process.env.SSL_CERT;
        if (!pk || !crt) {
            console.error(
                'Configuration error: you need to specify the SSL_PRIVATE_KEY and SSL_CERT keys in the .env file'
            );
            throw 'Configuration error: you need to specify the SSL_PRIVATE_KEY and SSL_CERT keys in the .env file';
        }
        try {
            const privateKey = fs.readFileSync(pk, 'utf8');
            const certificate = fs.readFileSync(crt, 'utf8');
            const credentials = { key: privateKey, cert: certificate };
            const httpsServer = httpsCreateServer(credentials, app);
            httpsServer.listen(port);
            setupSocketServerApp(httpsServer, session);
        } catch (err) {
            console.error('Error starting the https server: ', err);
            throw err;
        }
    }
};

/* Main setup function for the server. Will init all parts as necessary */
const setupAll = async function () {
    const argv = yargs(hideBin(process.argv)).argv as { [key: string]: unknown; ssl?: boolean; port?: string };

    const useSSL = argv.ssl ?? false;
    const port = argv.port ? parseInt(argv.port as string) : useSSL ? 8443 : 8080;
    console.log(`starting server for project ${config.projectShortname} with port ${port}`);

    process.on('uncaughtException', (err) => {
        // handle the error safely
        console.error('Just caught an uncaught exception!', err);
    });

    // Setup routing, will await later
    const setupRoutingAsync = setupRouting();

    createHttpServer(port, useSSL);

    // Register server translations
    registerTranslationDir(join(__dirname, '../../../locales/'));
    addTranslationNamespace('transit');

    // Wait for routing to be setup before continuing
    await setupRoutingAsync;

    // Start the worker pool for worker threads
    // We start it after all routing is setup to insure we can run job properly. If a user attempt
    // to create a batch job before this point, the job will be created, but the enqueue and start will fail
    // an error will be seen in the console, but the call to enqueueRunningAndPendingJobs() here will pick it
    // up and start it.
    // TODO: if we need the pool for other jobs earlier in the init, consider a synchronisation mechanism
    // between the job creation backend and the job start part.
    startPool();

    // Do this at the end, since those are batch job and they can wait a little bit
    // Enqueue/resume running and pending tasks
    // FIXME This implies a single server process for a given database. We don't
    // know if the job is enqueued in another process somewhere and may be
    // executed twice. For pending jobs, we could have a first run, first serve,
    // but for jobs in progress, we don't know if they are actively being run or
    // not
    if (process.env.STARTUP_RESTART_JOBS === undefined || _booleish(process.env.STARTUP_RESTART_JOBS)) {
        await ExecutableJob.enqueueRunningAndPendingJobs();
    }

    console.log('Setup done');
};
// Register shutdown handlers
process.on('SIGINT', () => {
    console.log('Received SIGINT. Performing cleanup...');
    terminatePool()
        .catch((error) => console.error('Failed to terminate worker pool', error))
        .finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Performing cleanup...');
    terminatePool()
        .catch((error) => console.error('Failed to terminate worker pool', error))
        .finally(() => process.exit(0));
});
setupAll();
