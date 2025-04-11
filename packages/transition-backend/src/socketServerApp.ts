/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import socketMiddleWare from 'socketio-wildcard';
import sharedSession from 'express-socket.io-session';
import { Server as SocketIOServer, Socket } from 'socket.io';
import events from 'events';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import OSRMProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';

import { recreateCache } from './services/capnpCache/dbToCache';
import preferencesSocketRoutes from 'chaire-lib-backend/lib/api/preferences.socketRoutes';
import allSocketRoutes from './api/all.socketRoutes';
import { startPool } from './tasks/serverWorkerPool';
import { ExecutableJob } from './services/executableJob/ExecutableJob';
import clientEventManager from './utils/ClientEventManager';

const socketWildCard = socketMiddleWare();

const setupSocketServerApp = async function (server, sessionMiddleware) {
    // Start the worker pool for worker threads
    startPool();

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
        // We don't need to refresh the transferrable nodes on startup as they are saved in the DB
        await recreateCache({ refreshTransferrableNodes: false, saveLines: true });
    }

    // Now that we have the cache ready, we can start TrRouting
    // We use restart, to cleanup old leftover from previous execution
    // We do the await later to let toher processes run while this is starting
    const trRoutingStartAsync = trRoutingProcessManager.restart({});

    // Enqueue/resume running and pending tasks
    // FIXME This implies a single server process for a given database. We don't
    // know if the job is enqueued in another process somewhere and may be
    // executed twice. For pending jobs, we could have a first run, first serve,
    // but for jobs in progress, we don't know if they are actively being run or
    // not
    if (process.env.STARTUP_RESTART_JOBS === undefined || _booleish(process.env.STARTUP_RESTART_JOBS)) {
        await ExecutableJob.enqueueRunningAndPendingJobs();
    }

    const response = await trRoutingStartAsync;
    if (response.status !== 'started') {
        console.log('failed to start trRouting at startup');
    }

    const io = new SocketIOServer(server, {
        pingTimeout: 60000,
        transports: ['websocket'],
        maxHttpBufferSize: 1e8 // 100MB
    });

    io.use(
        sharedSession(sessionMiddleware, {
            autoSave: true
        })
    );

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'test') {
        console.log('using wildcard for socket (dev mode)');
        io.use(socketWildCard);
    }

    io.use((socket, next) => {
        // FIXME We should remove the need to use any, but the session field is not present in the handshake type, though this type should be overridden by the express-socket.io-session package. See if there are incompatibilities with socket.io 4
        if (
            (socket.handshake as any).session &&
            (socket.handshake as any).session.passport &&
            (socket.handshake as any).session.passport.user > 0
        ) {
            return next();
        }
        socket.disconnect(true);
    });

    io.on('error', (error: unknown) => {
        console.log('error!', error);
    });

    io.on('connection', (socket: Socket) => {
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
