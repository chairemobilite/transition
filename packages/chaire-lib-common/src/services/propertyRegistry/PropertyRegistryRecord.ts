/**
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { Iso3166Alpha2Code } from 'iso-3166-ts';

/**
 * Property registry attributes type
 */
export type PropertyRegistryRecordAttributes = {
    id: number;
    internalId?: string;
    addresses?: string[];
    geogMainBuildingPolygon?: GeoJSON.MultiPolygon;
    geogParcelPolygon?: GeoJSON.MultiPolygon;
    geogMainBuildingCentroid?: GeoJSON.Point;
    geogParcelCentroid?: GeoJSON.Point;
    geogMainEntrancePoint?: GeoJSON.Point;
    mainEntranceMaxErrorM?: number;
    numFlats?: number;
    numNonResidentialUnits?: number;
    totalFloorAreaM2?: number;
    levels?: number;
    yearBuilt?: number;
    buildingType?: string; // building type codes are distinct by country. This code should represent the building type (apartment, house, commercial, industrial, mixed, etc.)
    assessedValueTotal?: number;
    assessedValueLand?: number;
    assessedValueBuilding?: number;
    parcelAreaM2?: number;
    landUseCode?: string; // land use codes are distinct by country. This code should represent the lan use category (industrial, residential, commercial, etc.)
    country?: Iso3166Alpha2Code;
    region?: string;
    municipality?: string;
    borough?: string;
    lastUpdated?: Date;
    dataSourceId?: string; // UUID v4
};

export type PropertyRegistryRecordPointPrecision = 'main_entrance' | 'building_centroid' | 'parcel_centroid';

/**
 * Property registry record point geojson properties type (minimal set of properties)
 * Used for the property registry record points geojson collection.
 * More fields may be added later if needed.
 */
export type PropertyRegistryRecordPointGeoJSONProperties = {
    precision: PropertyRegistryRecordPointPrecision | null;
    main_entrance_max_error_m?: number;
    num_flats?: number;
};

/**
 * A note on PropertyRegistryRecordCollection:
 * For now, we will use simple GeoJSON features collections
 * since there is no current need for more advanced
 * management of property registry record collections.
 */
export class PropertyRegistryRecord {
    protected static displayName = 'PropertyRegistryRecord';
    private _attributes: PropertyRegistryRecordAttributes;

    constructor(attributes: PropertyRegistryRecordAttributes) {
        this._attributes = attributes;
    }

    getId(): number {
        return this._attributes.id;
    }

    get internalId(): string | undefined {
        return this._attributes.internalId;
    }

    get addresses(): string[] {
        return this._attributes.addresses ?? [];
    }

    get geogMainBuildingPolygon(): GeoJSON.MultiPolygon | undefined {
        return this._attributes.geogMainBuildingPolygon;
    }

    get geogParcelPolygon(): GeoJSON.MultiPolygon | undefined {
        return this._attributes.geogParcelPolygon;
    }

    get geogMainBuildingCentroid(): GeoJSON.Point | undefined {
        return this._attributes.geogMainBuildingCentroid;
    }

    get geogParcelCentroid(): GeoJSON.Point | undefined {
        return this._attributes.geogParcelCentroid;
    }

    get geogMainEntrancePoint(): GeoJSON.Point | undefined {
        return this._attributes.geogMainEntrancePoint;
    }

    get mainEntranceMaxErrorM(): number | undefined {
        return this._attributes.mainEntranceMaxErrorM;
    }

    get numFlats(): number | undefined {
        return this._attributes.numFlats;
    }

    get numNonResidentialUnits(): number | undefined {
        return this._attributes.numNonResidentialUnits;
    }

    get totalFloorAreaM2(): number | undefined {
        return this._attributes.totalFloorAreaM2;
    }

    get levels(): number | undefined {
        return this._attributes.levels;
    }

    get yearBuilt(): number | undefined {
        return this._attributes.yearBuilt;
    }

    get buildingType(): string | undefined {
        return this._attributes.buildingType;
    }

    get assessedValueTotal(): number | undefined {
        return this._attributes.assessedValueTotal;
    }

    get assessedValueLand(): number | undefined {
        return this._attributes.assessedValueLand;
    }

    get assessedValueBuilding(): number | undefined {
        return this._attributes.assessedValueBuilding;
    }

    get parcelAreaM2(): number | undefined {
        return this._attributes.parcelAreaM2;
    }

    get landUseCode(): string | undefined {
        return this._attributes.landUseCode;
    }

    get country(): Iso3166Alpha2Code | undefined {
        return this._attributes.country;
    }

    get region(): string | undefined {
        return this._attributes.region;
    }

    get municipality(): string | undefined {
        return this._attributes.municipality;
    }

    get borough(): string | undefined {
        return this._attributes.borough;
    }

    // For now, we keep the data as unix epoch milliseconds
    // TODO: Convert to Date object according to usage needed
    get lastUpdated(): Date | undefined {
        return this._attributes.lastUpdated;
    }

    get dataSourceId(): string | undefined {
        return this._attributes.dataSourceId;
    }

    static getPluralName() {
        return 'propertyRegistries';
    }

    static getCapitalizedPluralName() {
        return 'PropertyRegistries';
    }

    static getDisplayName() {
        return PropertyRegistryRecord.displayName;
    }
}
