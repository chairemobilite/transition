/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Agency from './Agency';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of transit agencies
 */
class AgencyCollection extends GenericObjectCollection<Agency> implements Progressable {
    protected static displayName = 'AgencyCollection';
    protected static socketPrefix = 'transitAgencies';
    protected static instanceClass = Agency;

    private _eventManager: EventManager | undefined;

    constructor(features, attributes, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${AgencyCollection.displayName}${progressEventName}`, completeRatio);
    }

    findByAcronym(acronym: string): Agency | undefined {
        return this.features.find((feature) => feature.attributes.acronym === acronym);
    }

    forCsv() {
        return this._features.map((agency) => {
            const attributes = agency.attributes;
            return {
                uuid: attributes.id,
                acronym: attributes.acronym,
                name: attributes.name,
                internal_id: attributes.internal_id,
                color: attributes.color,
                description: attributes.description
            };
        });
    }

    forJson() {
        return this._features.map((agency) => {
            return agency.attributes;
        });
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): Agency {
        return new Agency(attribs, isNew, collectionManager);
    }

    // TODO Have this collection and others implement some interface from which to get those methods
    saveCache(socket, customCollection) {
        return CollectionCacheable.saveCache(this, socket, customCollection);
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

export default AgencyCollection;
