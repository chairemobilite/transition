/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MapObject, MapObjectAttributes } from './MapObject';

export type GenericPlaceAttributes = MapObjectAttributes<GeoJSON.Point>;

/**
 * A generic point location on a map
 */
export class GenericPlace<T extends GenericPlaceAttributes> extends MapObject<GeoJSON.Point, T> {
    constructor(attributes: Partial<GenericPlaceAttributes> = {}, isNew = true, collectionManager?) {
        super(attributes, isNew, collectionManager);
    }
}

export default GenericPlace;
