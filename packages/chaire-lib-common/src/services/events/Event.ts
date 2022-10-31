/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * A simple class that wraps an event name string
 */
export class Event {
    private _eventName: string;

    constructor(eventName: string) {
        this._eventName = eventName;
    }

    get eventName() {
        return this._eventName;
    }
}

export default Event;
