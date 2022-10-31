/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Scenario from './Scenario';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of transit scenarios
 */
class ScenarioCollection extends GenericObjectCollection<Scenario> implements Progressable {
    protected static displayName = 'ScenarioCollection';
    protected static socketPrefix = 'transitScenarios';
    protected static instanceClass = Scenario;

    private _eventManager: EventManager | undefined;

    constructor(features, attributes, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${ScenarioCollection.displayName}${progressEventName}`, completeRatio);
    }

    forCsv() {
        return this._features.map((scenario) => {
            const attributes = scenario.getAttributes();
            return {
                uuid: attributes.id,
                name: attributes.name,
                color: attributes.color,
                description: attributes.description,
                services: attributes.services.join('|'),
                only_agencies: attributes.only_agencies ? attributes.only_agencies.join('|') : '',
                except_agencies: attributes.except_agencies ? attributes.except_agencies.join('|') : '',
                only_lines: attributes.only_lines ? attributes.only_lines.join('|') : '',
                except_lines: attributes.except_lines ? attributes.except_lines.join('|') : '',
                only_nodes: attributes.only_nodes ? attributes.only_nodes.join('|') : '',
                except_nodes: attributes.except_nodes ? attributes.except_nodes.join('|') : '',
                only_modes: attributes.only_modes ? attributes.only_modes.join('|') : '',
                except_modes: attributes.except_modes ? attributes.except_modes.join('|') : ''
            };
        });
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): Scenario {
        return new Scenario(attribs, isNew, collectionManager);
    }

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

export default ScenarioCollection;
