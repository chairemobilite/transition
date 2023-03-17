/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import sharedSession from 'express-socket.io-session';
import socketMiddleWare from 'socketio-wildcard';
import socketIO from 'socket.io';
import { spawn } from 'child_process';
import events from 'events';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import OSRMProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import { _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';

import { recreateCache } from './services/capnpCache/dbToCache';
import preferencesSocketRoutes from 'chaire-lib-backend/lib/api/preferences.socketRoutes';
import allSocketRoutes from './api/all.socketRoutes';
import { startPool } from './tasks/serverWorkerPool';
import { ExecutableJob } from './services/executableJob/ExecutableJob';
import clientEventManager from './utils/ClientEventManager';

const socketWildCard = socketMiddleWare();

const setupSocketServerApp = async function (server, session) {
    // Start the worker pool for worker threads
    startPool();

    // Cleanup trRouting processes
    const trRoutingDirectoryPath = process.env.TR_ROUTING_PATH !== undefined ? process.env.TR_ROUTING_PATH : undefined;
    console.log('exiting old trRouting engines from directory', trRoutingDirectoryPath);

    // killall trRoutingCSA (should not have any except if node exited with Exception):
    spawn('killall trRouting || echo "Process was not running."', [], {
        shell: true,
        detached: false,
        cwd: trRoutingDirectoryPath
    });

    await OSRMProcessManager.configureAllOsrmServers(true);
    // Add socket routes to an event emitter for the server process to use
    serviceLocator.addService('socketEventManager', new events.EventEmitter());
    allSocketRoutes(serviceLocator.socketEventManager);

    // Batch calculation jobs require the cache to exist. It should not be
    // possible to run those without the cache, so we wait for its creation
    // before allowing users to connect
    if (_booleish(process.env.STARTUP_RECREATE_CACHE)) {
        console.log('Recreating cache files');
        // TODO get cachePathDIrectory from params
        await recreateCache({ refreshTransferrableNodes: true, saveLines: true });
    }

    // Enqueue/resume running and pending tasks
    // FIXME This implies a single server process for a given database. We don't
    // know if the job is enqueued in another process somewhere and may be
    // executed twice. For pending jobs, we could have a first run, first serve,
    // but for jobs in progress, we don't know if they are actively being run or
    // not
    if (process.env.STARTUP_RESTART_JOBS === undefined || _booleish(process.env.STARTUP_RESTART_JOBS)) {
        await ExecutableJob.enqueueRunningAndPendingJobs();
    }

    const io = socketIO(server, {
        pingTimeout: 60000,
        transports: ['websocket']
    });

    // FIXME Call to restore unsecure behavior from socket.io < 2.4.0 (https://socket.io/blog/socket-io-2-4-0/). We should eventually pass to socket.io v3 and make sure the app is secure.
    io.origins((_, callback) => {
        callback(null, true);
    });

    io.use(
        sharedSession(session, {
            autoSave: true
        })
    );

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'test') {
        console.log('using wildcard for socket (dev mode)');
        io.use(socketWildCard);
    }

    io.use((socket, next) => {
        if (
            socket.handshake.session &&
            // TODO Is it possible to type the session?
            (socket.handshake.session as any).passport &&
            (socket.handshake.session as any).passport.user > 0
        ) {
            return next();
        }
        socket.disconnect(true);
    });

    io.on('error', (error: unknown) => {
        console.log('error!', error);
    });

    io.on('connection', (socket: socketIO.Socket) => {
        const userId = (socket as any).handshake.session.passport.user;
        socket.on('disconnect', () => {
            io.emit('user disconnected');
            clientEventManager.removeClientSocket(socket, userId);
        });

        if (
            process.env.NODE_ENV === 'development' ||
            process.env.NODE_ENV === 'dev' ||
            process.env.NODE_ENV === 'test'
        ) {
            socket.on('*', (packet) => {
                console.log('socket received event', packet.data[0]);
            });
        }

        clientEventManager.registerClientSocket(socket, userId);
        preferencesSocketRoutes(socket, userId);
        allSocketRoutes(socket, userId);
    });

    return io;
};

export default setupSocketServerApp;
