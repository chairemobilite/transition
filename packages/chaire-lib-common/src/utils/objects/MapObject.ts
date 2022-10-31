/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _omit from 'lodash.omit';

import { ObjectWithHistory } from './ObjectWithHistory';
import { GenericAttributes } from './GenericObject';

export interface MapObjectAttributes<M extends GeoJSON.GeometryObject> extends GenericAttributes {
    geography: M;
}

/**
 * An object that can be rendered as a feature on map
 */
export class MapObject<M extends GeoJSON.GeometryObject, T extends MapObjectAttributes<M>> extends ObjectWithHistory<
    T
> {
    // TODO: we should inject collections directly and remove this attribute
    protected _collectionManager;

    constructor(attributes = {}, isNew = true, collectionManager) {
        super(attributes, isNew);
        this._collectionManager = collectionManager;
    }

    toGeojson(): GeoJSON.Feature<M, T> {
        return {
            id: this.attributes.integer_id || 1,
            geometry: this.attributes.geography,
            type: 'Feature',
            properties: _omit(this.attributes, 'data') as T
        };
    }
}

export default MapObject;
