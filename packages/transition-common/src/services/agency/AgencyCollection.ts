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

    /**
     * Finds an agency by its acronym. It first looks for an exact match, then
     * looks for a case-insensitive match.
     * @param acronym the acronym of the agency to find
     * @returns The acronym or undefined if not found
     */
    findByAcronym(acronym: string): Agency | undefined {
        // Since agency acronyms are unique, but case sensitive, we first look for an exact match, then with case insensitivity
        const acronymMatchCase = this.features.find((feature) => feature.attributes.acronym === acronym);
        return acronymMatchCase
            ? acronymMatchCase
            : this.features.find((feature) => feature.attributes.acronym.toLowerCase() === acronym.toLowerCase());
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
