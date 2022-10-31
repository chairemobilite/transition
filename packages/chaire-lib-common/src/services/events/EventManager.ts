/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import events from 'events';

import Event from './Event';

const prefix = '';

export interface EventManager {
    emit(event: string | Event, ...args: any[]): void;
    emitProgress(progressName: string, completeRatio: number): void;
    once(event: string | Event, callback: (data: any) => void): void;
    on(event: string | Event, callback: (...data: any) => void): void;
    addListener(event: string | Event, callback: (...data: any) => void): void;
    removeListener(event: string | Event, callback: (...data: any) => void): void;
    removeAllListeners(event: string | Event): void;
    off(event: string | Event, callback: (data: any) => void): void;
}

/**
 * Event manager class that wraps an event emitter
 *
 * FIXME: Investigate if this class is really useful? Or can we just use
 * directly the events library (bug #703)
 */
export class EventManagerImpl implements EventManager {
    private _eventManager: events.EventEmitter;

    constructor(wrappedEventManager = new events.EventEmitter()) {
        this._eventManager = wrappedEventManager; // must implement emit, on, once, and removeListener methods
    }

    emit(event: string | Event, ...args: any[]) {
        if (typeof event === 'string') {
            event = new Event(event);
        }
        this._eventManager.emit(`${prefix}${event.eventName}`, ...args);
    }

    emitProgress(progressName: string, completeRatio: number) {
        this._eventManager.emit('progress', { name: progressName, progress: completeRatio });
    }

    once(event: string | Event, callback: (data: any) => void) {
        if (typeof event === 'string') {
            event = new Event(event);
        }
        this._eventManager.once(`${prefix}${event.eventName}`, callback);
    }

    on(event: string | Event, callback: (...data: any) => void) {
        if (typeof event === 'string') {
            event = new Event(event);
        }
        this._eventManager.on(`${prefix}${event.eventName}`, callback);
    }

    addListener(event: string | Event, callback: (...data: any) => void) {
        this.on(event, callback);
    }

    removeListener(event: string | Event, callback: (...data: any) => void) {
        if (typeof event === 'string') {
            event = new Event(event);
        }
        this._eventManager.removeListener(`${prefix}${event.eventName}`, callback);
    }

    removeAllListeners(event: string | Event) {
        if (typeof event === 'string') {
            event = new Event(event);
        }
        this._eventManager.removeAllListeners(`${prefix}${event.eventName}`);
    }

    off(event: string | Event, callback: (data: any) => void) {
        this.removeListener(event, callback);
    }
}

export default EventManagerImpl;
