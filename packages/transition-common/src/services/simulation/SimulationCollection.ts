/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _toString from 'lodash/toString';

import Simulation, { SimulationAttributes } from './Simulation';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of transit services
 */
class SimulationCollection extends GenericObjectCollection<Simulation> implements Progressable {
    protected static displayName = 'SimulationCollection';
    protected static socketPrefix = 'simulations';
    protected static instanceClass = Simulation;

    private _eventManager: EventManager | undefined;

    constructor(features: Simulation[], attributes, eventManager?: EventManager) {
        super(features, attributes, false, true);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${SimulationCollection.displayName}${progressEventName}`, completeRatio);
    }

    forCsv() {
        return this._features.map((service) => {
            const attributes = service.getAttributes();
            return {
                uuid: attributes.id,
                shortname: attributes.shortname,
                name: attributes.name,
                internal_id: attributes.internal_id,
                description: attributes.description,
                is_enabled: _toString(attributes.isEnabled),
                color: attributes.color
            };
        });
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): Simulation {
        return new Simulation(attribs as Partial<SimulationAttributes>, isNew, collectionManager);
    }

    loadFromServer(socket, collectionManager?) {
        return CollectionLoadable.loadFromServer(this, socket, collectionManager);
    }

    loadFromCollection(collection, collectionManager?) {
        return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
    }
}

export default SimulationCollection;
