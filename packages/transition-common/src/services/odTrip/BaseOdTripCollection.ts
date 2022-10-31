/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BaseOdTrip, BaseOdTripAttributes } from './BaseOdTrip';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

interface BaseOdTripCollectionAttributes {
    dataSourceId?: string;
    [key: string]: unknown;
}

/**
 * A collection of od trips
 */
class BaseOdTripCollection extends GenericObjectCollection<BaseOdTrip> implements Progressable {
    protected static displayName = 'BaseOdTripCollection';
    protected static socketPrefix = 'odPairs';
    protected static instanceClass = BaseOdTrip;

    private _eventManager: EventManager | undefined;

    constructor(
        features: BaseOdTrip[] = [],
        attributes: BaseOdTripCollectionAttributes = {},
        eventManager?: EventManager
    ) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${BaseOdTripCollection.displayName}${progressEventName}`, completeRatio);
    }

    forCsv() {
        return this._features.map((odPair) => {
            const attributes = odPair.getAttributes();
            return {
                id: attributes.id,
                routingName: attributes.internal_id,
                originLon: attributes.origin_geography.coordinates[0],
                originLat: attributes.origin_geography.coordinates[1],
                destinationLon: attributes.destination_geography.coordinates[0],
                destinationLat: attributes.destination_geography.coordinates[0],
                time: attributes.timeOfTrip,
                timeType: attributes.timeType
            };
        });
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): BaseOdTrip {
        return new BaseOdTrip(attribs, isNew);
    }

    loadFromServer(socket, collectionManager?) {
        const dataSourceId = (this.getAttributes() as BaseOdTripCollectionAttributes).dataSourceId;
        return CollectionLoadable.loadFromServer(this, socket, collectionManager, dataSourceId);
    }

    loadFromCollection(collection: Partial<BaseOdTripAttributes>[], collectionManager?) {
        return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
    }
}

export default BaseOdTripCollection;
