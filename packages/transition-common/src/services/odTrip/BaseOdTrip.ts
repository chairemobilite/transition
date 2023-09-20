/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { multiPoint as turfMultiPoint } from '@turf/turf';

import { MapObject, MapObjectAttributes } from 'chaire-lib-common/lib/utils/objects/MapObject';

export interface BaseOdTripAttributes extends MapObjectAttributes<GeoJSON.MultiPoint> {
    origin_geography: GeoJSON.Point;
    destination_geography: GeoJSON.Point;
    timeOfTrip: number;
    timeType: 'departure' | 'arrival';
    dataSourceId?: string;
}

/**
 * A trip with origin, destination and departure or arrival time. This
 * represents any trip from any source, not related to the OD surveys.
 *
 * @export
 * @class BaseOdTrip
 * @extends {MapObject<GeoJSON.MultiPoint, BaseOdTripAttributes>}
 */
export class BaseOdTrip extends MapObject<GeoJSON.MultiPoint, BaseOdTripAttributes> {
    protected static displayName = 'BaseOdTrip';

    constructor(attributes: Partial<BaseOdTripAttributes> = {}, isNew = false) {
        super(attributes, isNew, undefined);
    }

    protected _prepareAttributes(attributes: Partial<BaseOdTripAttributes>) {
        const _attributes = _cloneDeep(attributes);
        if (!attributes.geography && attributes.origin_geography && attributes.destination_geography) {
            _attributes.geography = turfMultiPoint([
                attributes.origin_geography.coordinates,
                attributes.destination_geography.coordinates
            ]).geometry;
        }
        // Default time of trip to a departure time of 0, so it is not undefined
        if (attributes.timeOfTrip === undefined) {
            _attributes.timeOfTrip = 0;
        }
        if (attributes.timeType === undefined) {
            _attributes.timeType = 'departure';
        }
        return super._prepareAttributes(_attributes);
    }

    static getPluralName() {
        return 'baseOdTrips';
    }

    static getCapitalizedPluralName() {
        return 'BaseOdTrips';
    }

    static getDisplayName() {
        return BaseOdTrip.displayName;
    }
}
