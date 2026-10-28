/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { EventEmitter } from 'events';
import type SocketIO from 'socket.io';

export const isSocketIo = (socket: EventEmitter): socket is SocketIO.Socket => {
    return typeof (socket as any).use === 'function';
};
