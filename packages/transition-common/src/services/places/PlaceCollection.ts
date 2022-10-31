/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Place, PlaceAttributes } from './Place';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericPlaceCollection from 'chaire-lib-common/lib/utils/objects/GenericPlaceCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of places (POIs or activity places)
 */
export class PlaceCollection extends GenericPlaceCollection<PlaceAttributes, Place> implements Progressable {
    protected static displayName = 'PlaceCollection';
    protected static socketPrefix = 'places';
    protected static instanceClass = Place;

    private _eventManager: EventManager | undefined;

    constructor(features: GeoJSON.Feature<GeoJSON.Point, PlaceAttributes>[], attributes, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${PlaceCollection.displayName}${progressEventName}`, completeRatio);
    }

    newObject(feature: GeoJSON.Feature<GeoJSON.Point, PlaceAttributes>, isNew = false, collectionManager?): Place {
        return new Place(
            Object.assign({}, feature.properties, { geography: feature.geometry }),
            isNew,
            collectionManager
        );
    }

    forCsv() {
        return this.features.map((node) => {
            const geographyCoordinates = node.geometry.coordinates;
            return {
                uuid: node.properties.id,
                shortname: node.properties.shortname,
                name: node.properties.name,
                latitude: geographyCoordinates[1] || null,
                longitude: geographyCoordinates[0] || null,
                internal_id: node.properties.internal_id
            };
        });
    }

    loadFromServer(socket) {
        return CollectionLoadable.loadGeojsonFromServer(this, socket);
    }

    loadFromCollection(collection) {
        return CollectionLoadable.loadGeojsonFromCollection(this, collection);
    }
}

export default PlaceCollection;
