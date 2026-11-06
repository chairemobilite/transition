/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { IncomingMessage } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import events from 'events';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import preferencesSocketRoutes from 'chaire-lib-backend/lib/api/preferences.socketRoutes';
import allSocketRoutes from './api/all.socketRoutes';
import clientEventManager from './utils/ClientEventManager';

// The handshake request, with the express session, where passport keeps the ID of the logged in user
type SessionRequest = IncomingMessage & { session?: { passport?: { user?: number } } };

const setupSocketServerApp = async function (server, sessionMiddleware) {
    // Add socket routes to an event emitter for the server process to use
    serviceLocator.addService('socketEventManager', new events.EventEmitter());
    allSocketRoutes(serviceLocator.socketEventManager);

    const io = new SocketIOServer(server, {
        pingTimeout: 60000,
        transports: ['websocket'],
        maxHttpBufferSize: 1e8 // 100MB
    });

    // Run the express session middleware on the handshake request, as the socket.io documentation shows
    io.engine.use(sessionMiddleware);

    io.use((socket, next) => {
        const userId = (socket.request as SessionRequest).session?.passport?.user;
        if (userId !== undefined && userId > 0) {
            socket.data.userId = userId;
            return next();
        }
        socket.disconnect(true);
    });

    io.on('error', (error: unknown) => {
        console.log('error!', error);
    });

    io.on('connection', (socket: Socket) => {
        const userId: number = socket.data.userId;
        socket.on('disconnect', () => {
            io.emit('user disconnected');
            clientEventManager.removeClientSocket(socket, userId);
        });

        if (
            process.env.NODE_ENV === 'development' ||
            process.env.NODE_ENV === 'dev' ||
            process.env.NODE_ENV === 'test'
        ) {
            socket.onAny((event) => {
                console.log('socket received event', event);
            });
        }

        clientEventManager.registerClientSocket(socket, userId);
        preferencesSocketRoutes(socket, userId);
        allSocketRoutes(socket, userId);
    });

    return io;
};

export default setupSocketServerApp;
