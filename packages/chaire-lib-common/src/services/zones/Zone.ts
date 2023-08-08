/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MapObject, MapObjectAttributes } from '../../utils/objects/MapObject';

export interface ZoneAttributes extends MapObjectAttributes<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
    dataSourceId?: string;
}

/**
 * A zone is a polygon or multipolygon object on the map
 *
 * @export
 * @class Zone
 * @extends {MapObject<GeoJSON.Polygon | GeoJSON.MultiPolygon, ZoneAttributes>}
 */
export class Zone extends MapObject<GeoJSON.Polygon | GeoJSON.MultiPolygon, ZoneAttributes> {
    protected static displayName = 'Zone';

    constructor(attributes = {}, isNew: boolean) {
        super(attributes, isNew, undefined);
    }

    toString() {
        return this.attributes.name || this.attributes.shortname || this.getId();
    }

    get collectionManager(): any {
        // TODO: test or use dependency injection
        return this._collectionManager;
    }

    static getPluralName() {
        return 'zones';
    }

    static getCapitalizedPluralName() {
        return 'Zones';
    }

    static getDisplayName() {
        return Zone.displayName;
    }
}

export default Zone;
