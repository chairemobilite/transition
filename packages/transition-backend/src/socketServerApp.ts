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

import preferencesSocketRoutes from 'chaire-lib-backend/lib/api/preferences.socketRoutes';
import allSocketRoutes from './api/all.socketRoutes';
import clientEventManager from './utils/ClientEventManager';

const socketWildCard = socketMiddleWare();

const setupSocketServerApp = async function (server, sessionMiddleware) {
    // Add socket routes to an event emitter for the server process to use
    serviceLocator.addService('socketEventManager', new events.EventEmitter());
    allSocketRoutes(serviceLocator.socketEventManager);

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
