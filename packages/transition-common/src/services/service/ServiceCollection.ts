/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Service from './Service';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of transit services
 */
class ServiceCollection extends GenericObjectCollection<Service> implements Progressable {
    protected static displayName = 'ServiceCollection';
    protected static socketPrefix = 'transitServices';
    protected static instanceClass = Service;

    private _eventManager: EventManager | undefined;

    constructor(features, attributes, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${ServiceCollection.displayName}${progressEventName}`, completeRatio);
    }

    forCsv() {
        return this._features.map((service) => {
            const attributes = service.attributes;
            return {
                uuid: attributes.id,
                name: attributes.name,
                internal_id: attributes.internal_id,
                start_date: attributes.start_date,
                end_date: attributes.end_date,
                monday: attributes.monday,
                tuesday: attributes.tuesday,
                wednesday: attributes.wednesday,
                thursday: attributes.thursday,
                friday: attributes.friday,
                saturday: attributes.saturday,
                sunday: attributes.sunday,
                color: attributes.color,
                only_dates: attributes.only_dates ? attributes.only_dates.join('|') : '',
                except_dates: attributes.except_dates ? attributes.except_dates.join('|') : '',
                description: attributes.description
            };
        });
    }

    async deleteUnused(socket) {
        const promises = this.getFeatures()
            .filter((service) => !service.isFrozen() && !service.hasScheduledLines())
            .map((service) => service.delete(socket));
        const results = await Promise.allSettled(promises);
        results
            .filter((result) => result.status !== 'fulfilled')
            .forEach((result) => console.log(`Error deleting service: ${result}`));
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): Service {
        return new Service(attribs, isNew, collectionManager);
    }

    saveCache(socket) {
        return CollectionCacheable.saveCache(this, socket);
    }

    loadCache(socket) {
        return CollectionCacheable.loadCache(this, socket);
    }

    loadFromServer(socket, collectionManager?) {
        return CollectionLoadable.loadFromServer(this, socket, collectionManager);
    }

    loadFromCollection(collection, collectionManager?) {
        return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
    }
}

export default ServiceCollection;
