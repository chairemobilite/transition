/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericImmutableCollection from './GenericImmutableCollection';
import { EventManager } from '../../services/events/EventManager';

export default class CollectionManager {
    // TODO Does the collection manager need an event manager at all?
    public _eventManager: EventManager | null | undefined; // TODO should be private, but there are still consumers that uses this attribute directly
    private _collectionsByName: { [key: string]: GenericImmutableCollection<any> };

    constructor(
        eventManager: EventManager | null | undefined,
        collectionByNames: { [key: string]: GenericImmutableCollection<any> } = {}
    ) {
        this._eventManager = eventManager;
        this._collectionsByName = {};
        for (const collectionName in collectionByNames) {
            this.add(collectionName, collectionByNames[collectionName], false);
        }
    }

    // TODO Some code path don't have event managers, like tasks, so this can be undefined. There should always be one, event if it doesn't do anything with events
    public getEventManager(): EventManager | undefined {
        return this._eventManager || undefined;
    }

    public add(collectionName: string, collection: GenericImmutableCollection<any>, refresh = true): void {
        this.update(collectionName, collection, refresh);
    }

    public set(collectionName: string, collection: GenericImmutableCollection<any>, refresh = true): void {
        this.update(collectionName, collection, refresh);
    }

    public update(collectionName: string, collection: GenericImmutableCollection<any>, refresh = true): void {
        this._collectionsByName[collectionName] = collection;
        if (refresh) {
            this.refresh(collectionName);
        }
    }

    public remove(collectionName: string, refresh = true): void {
        delete this._collectionsByName[collectionName];
        if (refresh) {
            this.refresh(collectionName);
        }
    }

    public has(collectionName: string): boolean {
        return collectionName in this._collectionsByName;
    }

    public hasCollection(
        collectionName: string // alias of has (still in use)
    ) {
        return this.has(collectionName);
    }

    public getNames(): string[] {
        return Object.keys(this._collectionsByName);
    }

    public getCollectionNames(): string[] {
        // alias of getNames (still in use)
        return this.getNames();
    }

    public get(collectionName: string): GenericImmutableCollection<any> {
        return this._collectionsByName[collectionName];
    }

    public getCollection(collectionName: string): GenericImmutableCollection<any> {
        // alias of get (still in use)
        return this.get(collectionName);
    }

    public getSize(): number {
        return Object.keys(this._collectionsByName).length;
    }

    public refresh(collectionName: string): void {
        if (this._eventManager) {
            this._eventManager.emit(`collection.update.${collectionName}`);
            this._eventManager.emit('collections.update');
        }
    }
}
