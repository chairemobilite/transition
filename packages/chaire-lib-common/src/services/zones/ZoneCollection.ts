/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Zone, ZoneAttributes } from './Zone';
import CollectionManager from '../../utils/objects/CollectionManager';
import CollectionLoadable from '../objects/CollectionLoadable';
import GenericObjectCollection from '../../utils/objects/GenericObjectCollection';
import Progressable from '../../utils/objects/Progressable';
import { GenericAttributes } from '../../utils/objects/GenericObject';
import { EventManager } from '../events/EventManager';

interface BaseOdTripCollectionAttributes {
    dataSourceId?: string;
    [key: string]: unknown;
}

/**
 * A collection of od trips
 */
class ZoneCollection extends GenericObjectCollection<Zone> implements Progressable {
    protected static displayName = 'ZoneCollection';
    protected static instanceClass = Zone;

    private _eventManager: EventManager | undefined;

    constructor(features: Zone[] = [], attributes: BaseOdTripCollectionAttributes = {}, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${ZoneCollection.displayName}${progressEventName}`, completeRatio);
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): Zone {
        return new Zone(attribs, isNew);
    }

    loadFromCollection(collection: Partial<ZoneAttributes>[]) {
        return CollectionLoadable.loadFromCollection(this, collection);
    }
}

export default ZoneCollection;
