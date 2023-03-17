/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import clientSocketManager from '../ClientEventManager';

const userId = 1;

const createSocketMock = () => {
    const onProgressFct = jest.fn();
    const onProgressCountFct = jest.fn();
    const socketMock = new EventEmitter();
    socketMock.on('progress', onProgressFct);
    socketMock.on('progressCount', onProgressCountFct);
    return { socketMock, onProgressFct, onProgressCountFct };
}

test('No socket for client', () => {
    // Just make sure everything works if there are no socket, we can't test much else here
    const emitter = clientSocketManager.getUserEventEmitter(userId);

    // Emit an event, it should have called the progress functions
    emitter.emit('progress',  { name: 'test', progress: 0.5 });
    emitter.emit('progressCount', { name: 'test', progress: 150 });

    expect(true).toBeTruthy();

})

test('Single socket', () => {
    const { socketMock, onProgressFct, onProgressCountFct } = createSocketMock();
    clientSocketManager.registerClientSocket(socketMock, userId);
    const emitter = clientSocketManager.getUserEventEmitter(userId);

    // Emit an event, it should have called the progress functions
    emitter.emit('progress', { name: 'progress', progress: 0.5 });
    expect(onProgressFct).toHaveBeenCalledTimes(1);
    expect(onProgressFct).toHaveBeenCalledWith({ name: 'progress', progress: 0.5 });

    emitter.emit('progressCount', { name: 'test', progress: 150 });
    expect(onProgressCountFct).toHaveBeenCalledTimes(1);
    expect(onProgressCountFct).toHaveBeenCalledWith({ name: 'test', progress: 150 });

    clientSocketManager.removeClientSocket(socketMock, userId);

    // Emit an event again, the progress function should not have been called
    emitter.emit('progress', 12);
    expect(onProgressFct).toHaveBeenCalledTimes(1);
});

test('Multiple sockets at different times', () => {
    // Create a first socket
    const { socketMock, onProgressFct, onProgressCountFct } = createSocketMock();
    clientSocketManager.registerClientSocket(socketMock, userId);
    const emitter = clientSocketManager.getUserEventEmitter(userId);

    // Emit an event, it should have called the progress functions
    emitter.emit('progress', { name: 'progress', progress: 0.5 });
    expect(onProgressFct).toHaveBeenCalledTimes(1);
    expect(onProgressFct).toHaveBeenCalledWith({ name: 'progress', progress: 0.5 });
    expect(onProgressCountFct).not.toHaveBeenCalled();

    // Create a second socket
    const { socketMock: socketMock2, onProgressFct: onProgressFct2, onProgressCountFct: onProgressCountFct2 } = createSocketMock();
    clientSocketManager.registerClientSocket(socketMock2, userId);

    // Emit an event and make sure both sockets received it
    emitter.emit('progressCount', { name: 'test', progress: 150 });
    expect(onProgressCountFct).toHaveBeenCalledTimes(1);
    expect(onProgressCountFct).toHaveBeenCalledWith({ name: 'test', progress: 150 });
    expect(onProgressCountFct2).toHaveBeenCalledTimes(1);
    expect(onProgressCountFct2).toHaveBeenCalledWith({ name: 'test', progress: 150 });
    expect(onProgressFct2).not.toHaveBeenCalled();

    // Remove the second second
    clientSocketManager.removeClientSocket(socketMock2, userId);

    // Emit an event again, only the first socket should have received it
    emitter.emit('progressCount', { name: 'test', progress: 250 });
    expect(onProgressCountFct).toHaveBeenCalledTimes(2);
    expect(onProgressCountFct).toHaveBeenCalledWith({ name: 'test', progress: 250 });
    expect(onProgressCountFct2).toHaveBeenCalledTimes(1);
});

test('Multiple clients', () => {
    const userId2 = 2;
    // Create a socket for a 2 different clients
    const { socketMock, onProgressFct, onProgressCountFct } = createSocketMock();
    clientSocketManager.registerClientSocket(socketMock, userId);
    const { socketMock: socketMock2, onProgressFct: onProgressFct2, onProgressCountFct: onProgressCountFct2 } = createSocketMock();
    clientSocketManager.registerClientSocket(socketMock2, userId2);

    // Get emitters for each user
    const emitterFor1 = clientSocketManager.getUserEventEmitter(userId);
    const emitterFor2 = clientSocketManager.getUserEventEmitter(userId2);

    // Emit an event, it should have called the progress functions for the correct user
    emitterFor1.emit('progress', { name: 'progress', progress: 0.5 });
    expect(onProgressFct).toHaveBeenCalledTimes(1);
    expect(onProgressFct).toHaveBeenCalledWith({ name: 'progress', progress: 0.5 });
    expect(onProgressCountFct).not.toHaveBeenCalled();
    expect(onProgressFct2).not.toHaveBeenCalled();
    expect(onProgressCountFct2).not.toHaveBeenCalled();

    // Emit an event for user 2, should call progress for user 2 only
    emitterFor2.emit('progress', { name: 'progress', progress: 0.25 });
    expect(onProgressFct2).toHaveBeenCalledTimes(1);
    expect(onProgressFct2).toHaveBeenCalledWith({ name: 'progress', progress: 0.25 });
    expect(onProgressCountFct2).not.toHaveBeenCalled();
    expect(onProgressFct).toHaveBeenCalledTimes(1);
    expect(onProgressCountFct).not.toHaveBeenCalled();

    // Remove unexisting socket for user, both users should stil have their sockets
    clientSocketManager.removeClientSocket(socketMock2, userId);
    emitterFor1.emit('progress', { name: 'progress', progress: 0.55 });
    emitterFor2.emit('progress', { name: 'progress', progress: 0.6 });
    expect(onProgressFct).toHaveBeenCalledTimes(2);
    expect(onProgressFct).toHaveBeenLastCalledWith({ name: 'progress', progress: 0.55 });
    expect(onProgressFct2).toHaveBeenCalledTimes(2);
    expect(onProgressFct2).toHaveBeenLastCalledWith({ name: 'progress', progress: 0.6 });

    // Remove sockets for both users, events shoult not ben called anymore
    clientSocketManager.removeClientSocket(socketMock, userId);
    clientSocketManager.removeClientSocket(socketMock2, userId2);
    emitterFor1.emit('progress', { name: 'progress', progress: 0.75 });
    emitterFor2.emit('progress', { name: 'progress', progress: 0.7 });
    expect(onProgressFct).toHaveBeenCalledTimes(2);
    expect(onProgressFct2).toHaveBeenCalledTimes(2);

    // Try removing a socket for a user with no socket
    clientSocketManager.removeClientSocket(socketMock2, userId2);
    expect(true).toBeTruthy();
});