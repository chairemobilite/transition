/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { GenericPlace, GenericPlaceAttributes } from 'chaire-lib-common/lib/utils/objects/GenericPlace';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import TrError from 'chaire-lib-common/lib/utils/TrError';

export interface PlaceAttributes extends GenericPlaceAttributes {
    data_source_id: string;
    internal_id?: string;
    shortname?: string;
    name?: string;
    description?: string;
    data: { [key: string]: any };
}

export class Place extends GenericPlace<PlaceAttributes> implements Saveable {
    protected static displayName = 'Node';

    constructor(attributes: Partial<PlaceAttributes> = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew, collectionManager);
    }

    toGeojson() {
        return {
            id: this._attributes.id,
            geometry: this._attributes.geography,
            type: 'Feature',
            properties: {
                ...this._attributes
            }
        } as GeoJSON.Feature<GeoJSON.Point, PlaceAttributes>;
    }

    lat() {
        return this._attributes.geography.coordinates[1];
    }

    lon() {
        return this._attributes.geography.coordinates[0];
    }

    toString(showId = true) {
        if (this._attributes.name) {
            return this._attributes.name + showId ? ' id: ' + this._attributes.id : '';
        }
        return showId ? this._attributes.id : null;
    }

    async delete(socket: EventEmitter): Promise<Status.Status<{ id: string | undefined }>> {
        return new Promise((resolve, _reject) => {
            SaveUtils.delete(this, socket, 'Place', this._collectionManager?.get('places')).then(
                (response: Status.Status<{ id: string | undefined }>) => {
                    if (
                        Status.isStatusOk(response) &&
                        Status.unwrap(response).id !== undefined &&
                        this._collectionManager?.get('places')
                    ) {
                        this._collectionManager?.get('places').updateSpatialIndex();
                    }
                    resolve(response);
                }
            );
        });
    }

    public async save(socket: EventEmitter) {
        if (this.hasChanged() || this.isNew()) {
            try {
                const geography = this._attributes.geography;

                // TODO Keeping this for now, as it works and changing may have side effects, but the Node should not know about its collection. It's not its responsibility to do this. It could be a save callback though.
                if (this._collectionManager?.get('places')) {
                    const placeGeojson = this._collectionManager?.get('places').getById(this._attributes.id);
                    if (placeGeojson) {
                        const oldLat = placeGeojson.geometry.coordinates[1];
                        const oldLon = placeGeojson.geometry.coordinates[0];
                        const newLat = geography.coordinates[1];
                        const newLon = geography.coordinates[0];

                        if (newLat !== oldLat || newLon !== oldLon) {
                            placeGeojson.geometry = geography;
                            this._collectionManager?.get('places').updateSpatialIndex();
                        }
                    }
                }

                const response = await SaveUtils.save(this, socket, 'place', this._collectionManager?.get('places'));
                return response;
            } catch (error) {
                if (TrError.isTrError(error)) {
                    return error.export();
                }
                const trError = new TrError(
                    `cannot fetch places in radius because of an error: ${error}`,
                    'P0001',
                    'PlacesInRadiusCouldNotBeFetchedBecauseError'
                );
                console.error(error);
                return trError.export();
            }
        } else {
            return { id: this._attributes.id };
        }
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager?.get('places'));
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(this, this._collectionManager?.get('places'));
    }

    static getPluralName() {
        return 'places';
    }

    static getCapitalizedPluralName() {
        return 'Places';
    }

    static getDisplayName() {
        return Place.displayName;
    }
}

export default Place;
