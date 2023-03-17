/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from 'events';

const globalEvents = ['progress', 'progressCount', 'executableJob.updated'] as const;

/** An enumeration of events that all clients registered for a given user will
 * be notified of, if using this event emitter */
export type GlobalEvents = typeof globalEvents[number];

class ClientEventManager {
    private _socketsByUser: {
        [userId: number]: EventEmitter[];
    } = {};
    private _eventEmitterByUser: {
        [userId: number]: EventEmitter;
    } = {};

    registerClientSocket = (socket: EventEmitter, userId: number) => {
        const socketsForUser = this._socketsByUser[userId] || [];
        socketsForUser.push(socket);
        this._socketsByUser[userId] = socketsForUser;
    };

    /**
     * Get an event emitter that listens to any global event and sends it to all
     * client sockets for this user. This can replace the socketEventManager for
     * events that may live through many client sessions, for example, events
     * regarding the progress and update of long-running jobs.
     *
     * @param userId
     * @returns
     */
    getUserEventEmitter = (userId: number) => {
        const eventEmitter = this._eventEmitterByUser[userId];
        if (eventEmitter !== undefined) {
            return eventEmitter;
        }
        const newEventEmitter = new EventEmitter();
        globalEvents.forEach((event) => {
            newEventEmitter.on(event, (payload) => {
                const sockets = this._socketsByUser[userId] || [];
                sockets.forEach((socket) => socket.emit(event, payload));
            });
        });
        this._eventEmitterByUser[userId] = newEventEmitter;
        return newEventEmitter;
    };

    removeClientSocket = (socket: EventEmitter, userId: number) => {
        const socketsForUser = this._socketsByUser[userId] || [];
        const newSockets = socketsForUser.filter((s) => s !== socket);
        if (newSockets.length === 0) {
            delete this._socketsByUser[userId];
            delete this._eventEmitterByUser[userId];
        } else {
            this._socketsByUser[userId] = newSockets;
        }
    };
}

const clientEventManager = new ClientEventManager();
/**
 * This object manages the various event emitters for a given user. Event
 * emitters, like sockets, who want to be notified of global events on tasks
 * that it did not start can register to this object. Notifiers who advertise
 * global events will get the event emitter from this object for the user, so
 * any listener, even if it doesn't know about it, will be notified.
 * */
export default clientEventManager;
