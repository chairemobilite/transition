/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { createServer } from 'http';
import Server from 'socket.io';
import Client from 'socket.io-client';

import { isSocketIo } from '../socketUtils';

describe('isSocketIo', () => {
    let io, serverSocket, clientSocket;
  
    beforeAll((done) => {
        const httpServer = createServer();
        io = new Server(httpServer);
        httpServer.listen(() => {
            const port = (httpServer.address() as any).port;
            clientSocket = Client(`http://localhost:${port}`);
            io.on('connection', (socket) => {
                serverSocket = socket;
            });
            clientSocket.on('connect', done);
        });
    });
  
    afterAll(() => {
        io.close();
        clientSocket.close();
    });

    test('Test with event emitter', () => {
        const emitter = new EventEmitter();
        expect(isSocketIo(emitter)).toEqual(false);
    });
  
    test("Test with socket io", () => {
        expect(isSocketIo(serverSocket)).toEqual(true);
    });
  
});


