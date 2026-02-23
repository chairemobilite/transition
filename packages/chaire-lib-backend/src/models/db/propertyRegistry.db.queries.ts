/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
import knexPostgis from 'knex-postgis';
import { type Knex } from 'knex';
import type { Iso3166Alpha2Code } from 'iso-3166-ts';
import { isPoint } from 'geojson-validation';

import type {
    PropertyRegistryRecordAttributes,
    PropertyRegistryRecordPointGeoJSONProperties
} from 'chaire-lib-common/lib/services/propertyRegistry/PropertyRegistryRecord';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { geometryToPostgis } from '../../utils/db/geometry/GeometryUtils';

// Only import useful functions from default.db.queries.ts for property registries.
// We should not need to update or delete property registry records manually after import.
import { exists, createMultiple, deleteForDataSourceId, create } from './default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const tableName = 'tr_property_registry';
const st = knexPostgis(knex);

// Type for the object sent to db for insert or update:
type PropertyRegistryRecordToDbAttributes = {
    id: number;
    internal_id?: string;
    addresses?: string[];
    geog_main_building_polygon?: ReturnType<knexPostgis.KnexPostgis['geomFromGeoJSON']>;
    geog_parcel_polygon?: ReturnType<knexPostgis.KnexPostgis['geomFromGeoJSON']>;
    geog_main_building_centroid_point?: ReturnType<knexPostgis.KnexPostgis['geomFromGeoJSON']>;
    geog_parcel_centroid_point?: ReturnType<knexPostgis.KnexPostgis['geomFromGeoJSON']>;
    geog_main_entrance_point?: ReturnType<knexPostgis.KnexPostgis['geomFromGeoJSON']>;
    main_entrance_max_error_m?: number;
    num_flats?: number;
    num_non_residential_units?: number;
    total_floor_area_m2?: number;
    levels?: number;
    year_built?: number;
    building_type?: string;
    assessed_value_total?: number;
    assessed_value_land?: number;
    assessed_value_building?: number;
    parcel_area_m2?: number;
    land_use_code?: string;
    country?: Iso3166Alpha2Code;
    region?: string;
    municipality?: string;
    borough?: string;
    last_updated?: Date;
    data_source_id?: string; // UUID v4
};

// Type for the object fetched from db:
type PropertyRegistryRecordFromDbAttributes = {
    id: number;
    internal_id?: string;
    addresses?: string[];
    geog_main_building_polygon?: GeoJSON.MultiPolygon;
    geog_parcel_polygon?: GeoJSON.MultiPolygon;
    geog_main_building_centroid_point?: GeoJSON.Point;
    geog_parcel_centroid_point?: GeoJSON.Point;
    geog_main_entrance_point?: GeoJSON.Point;
    main_entrance_max_error_m?: number;
    num_flats?: number;
    num_non_residential_units?: number;
    total_floor_area_m2?: number;
    levels?: number;
    year_built?: number;
    building_type?: string;
    assessed_value_total?: number;
    assessed_value_land?: number;
    assessed_value_building?: number;
    parcel_area_m2?: number;
    land_use_code?: string;
    country?: Iso3166Alpha2Code;
    region?: string;
    municipality?: string;
    borough?: string;
    last_updated?: Date;
    data_source_id?: string; // UUID v4
};

/**
 * Clean and format attributes for database insertion
 * Using partial to accept empty id before inserting (id will be filled by the database)
 */
const attributesCleaner = function (
    attributes: Partial<PropertyRegistryRecordAttributes>
): Partial<PropertyRegistryRecordToDbAttributes> {
    const {
        id,
        internalId,
        addresses,
        geogMainBuildingPolygon,
        geogParcelPolygon,
        geogMainBuildingCentroid,
        geogParcelCentroid,
        geogMainEntrancePoint,
        mainEntranceMaxErrorM,
        numFlats,
        numNonResidentialUnits,
        totalFloorAreaM2,
        levels,
        yearBuilt,
        buildingType,
        assessedValueTotal,
        assessedValueLand,
        assessedValueBuilding,
        parcelAreaM2,
        landUseCode,
        country,
        region,
        municipality,
        borough,
        lastUpdated,
        dataSourceId
    } = attributes;

    const _attributes: Partial<PropertyRegistryRecordToDbAttributes> = {
        id,
        internal_id: internalId,
        addresses,
        geog_main_building_polygon: geometryToPostgis(geogMainBuildingPolygon, st),
        geog_parcel_polygon: geometryToPostgis(geogParcelPolygon, st),
        geog_main_building_centroid_point: geometryToPostgis(geogMainBuildingCentroid, st),
        geog_parcel_centroid_point: geometryToPostgis(geogParcelCentroid, st),
        geog_main_entrance_point: geometryToPostgis(geogMainEntrancePoint, st),
        main_entrance_max_error_m: mainEntranceMaxErrorM,
        num_flats: numFlats,
        num_non_residential_units: numNonResidentialUnits,
        total_floor_area_m2: totalFloorAreaM2,
        levels,
        year_built: yearBuilt,
        building_type: buildingType,
        assessed_value_total: assessedValueTotal,
        assessed_value_land: assessedValueLand,
        assessed_value_building: assessedValueBuilding,
        parcel_area_m2: parcelAreaM2,
        land_use_code: landUseCode,
        country,
        region,
        municipality,
        borough,
        last_updated: lastUpdated ? new Date(lastUpdated) : undefined,
        data_source_id: dataSourceId
    };

    return _attributes;
};

/**
 * Parse database attributes to PropertyRegistryRecordAttributes
 */
const attributesParser = (dbAttributes: PropertyRegistryRecordFromDbAttributes): PropertyRegistryRecordAttributes => {
    const result: PropertyRegistryRecordAttributes = {
        id: dbAttributes.id,
        internalId: dbAttributes.internal_id ?? undefined,
        addresses: dbAttributes.addresses ?? undefined,
        geogMainBuildingPolygon: dbAttributes.geog_main_building_polygon ?? undefined,
        geogParcelPolygon: dbAttributes.geog_parcel_polygon ?? undefined,
        geogMainBuildingCentroid: dbAttributes.geog_main_building_centroid_point ?? undefined,
        geogParcelCentroid: dbAttributes.geog_parcel_centroid_point ?? undefined,
        geogMainEntrancePoint: dbAttributes.geog_main_entrance_point ?? undefined,
        mainEntranceMaxErrorM: dbAttributes.main_entrance_max_error_m ?? undefined,
        numFlats: dbAttributes.num_flats ?? undefined,
        numNonResidentialUnits: dbAttributes.num_non_residential_units ?? undefined,
        totalFloorAreaM2: dbAttributes.total_floor_area_m2 ?? undefined,
        levels: dbAttributes.levels ?? undefined,
        yearBuilt: dbAttributes.year_built ?? undefined,
        buildingType: dbAttributes.building_type ?? undefined,
        // knex casts decimals as strings, so we need to convert them to numbers:
        assessedValueTotal: dbAttributes.assessed_value_total ? Number(dbAttributes.assessed_value_total) : undefined,
        assessedValueLand: dbAttributes.assessed_value_land ? Number(dbAttributes.assessed_value_land) : undefined,
        assessedValueBuilding: dbAttributes.assessed_value_building
            ? Number(dbAttributes.assessed_value_building)
            : undefined,
        parcelAreaM2: dbAttributes.parcel_area_m2 ?? undefined,
        landUseCode: dbAttributes.land_use_code ?? undefined,
        country: dbAttributes.country ?? undefined,
        region: dbAttributes.region ?? undefined,
        municipality: dbAttributes.municipality ?? undefined,
        borough: dbAttributes.borough ?? undefined,
        lastUpdated: dbAttributes.last_updated ? new Date(dbAttributes.last_updated) : undefined,
        dataSourceId: dbAttributes.data_source_id ?? undefined
    };

    return result;
};

const coalescedPointSql =
    'COALESCE(geog_main_entrance_point, geog_main_building_centroid_point, geog_parcel_centroid_point)';

const pointPropertiesRaw = () =>
    knex.raw(
        `json_build_object(
            'precision', CASE
                WHEN geog_main_entrance_point IS NOT NULL THEN 'main_entrance'
                WHEN geog_main_building_centroid_point IS NOT NULL THEN 'building_centroid'
                WHEN geog_parcel_centroid_point IS NOT NULL THEN 'parcel_centroid'
                ELSE NULL END,
            'main_entrance_max_error_m', main_entrance_max_error_m,
            'num_flats', num_flats
        ) AS properties`
    );

/**
 *
 * This function fetches the property registry points,
 * in order of precision, with optional radius around a point.
 * When main entrance is not available, it will coalesce
 * to building centroid, then parcel centroid.
 * The points for which no point is available (main entrance,
 * building centroid and parcel centroid are null)
 * will be ignored.
 *
 * TODO: add filters for other attributes than data source
 * TODO: add another geojson collection for buildings and/or
 * parcel polygons (not needed right now).
 *
 * For now, we fetch the minimum number of fields required.
 * @param params - The parameters for the query.
 * @param params.propertyIds - The IDs of the properties to fetch (optional).
 * @param params.dataSourceId - The ID of the data source to fetch (required).
 * @param params.aroundPoint - The point around which to fetch properties (optional).
 * @param params.withRadiusMeters - The radius in meters around the point to fetch properties (optional).
 * if aroundPoint is provided, withRadiusMeters is required, otherwise aroundPoint is ignored.
 * @returns A GeoJSON feature collection of the main entrances or centroids of the properties.
 */
const pointsGeojsonCollection = async (params: {
    dataSourceId: string;
    propertyIds?: number[];
    aroundPoint?: GeoJSON.Point;
    withRadiusMeters?: number;
}): Promise<GeoJSON.FeatureCollection<GeoJSON.Point, PropertyRegistryRecordPointGeoJSONProperties>> => {
    try {
        const { dataSourceId, propertyIds, aroundPoint, withRadiusMeters } = params;
        const innerQuery = knex(tableName)
            .select('id', knex.raw(`${coalescedPointSql} as geography`), pointPropertiesRaw())
            .where('data_source_id', dataSourceId)
            .whereRaw(
                '(geog_main_entrance_point IS NOT NULL OR geog_main_building_centroid_point IS NOT NULL OR geog_parcel_centroid_point IS NOT NULL)'
            );
        if (propertyIds && propertyIds.length !== 0) {
            innerQuery.whereIn('id', propertyIds);
        }
        if (!_isBlank(aroundPoint) && isPoint(aroundPoint) && !_isBlank(withRadiusMeters) && withRadiusMeters! > 0) {
            innerQuery.where(
                st.dwithin(geometryToPostgis(aroundPoint, st)!, knex.raw(coalescedPointSql), withRadiusMeters!)
            );
        } else if (!_isBlank(aroundPoint)) {
            throw new TrError(
                'cannot fetch property registry points geojson collection because withRadiusMeters is required when aroundPoint is provided',
                'PRQ0001',
                'PropertyRegistryGeojsonCollectionCouldNotBeFetchedBecauseRadiusMetersIsRequiredWhenAroundPointIsProvided'
            );
        }
        innerQuery.orderBy('id').as('inputs');
        const featureQuery = knex
            .select(
                knex.raw(`jsonb_build_object(
            'type',       'Feature',
            'id',         inputs.id,
            'geometry',   ST_AsGeoJSON(inputs.geography)::jsonb,
            'properties', inputs.properties
          ) AS feature`)
            )
            .from(innerQuery)
            .as('features');
        const response = await knex
            .select<
                { geojson: GeoJSON.FeatureCollection<GeoJSON.Point, PropertyRegistryRecordPointGeoJSONProperties> }[]
            >(
                knex.raw(`
      jsonb_build_object(
        'type',     'FeatureCollection',
        'features', COALESCE(jsonb_agg(features.feature), '[]'::jsonb)
      ) as geojson`)
            )
            .from(featureQuery);
        if (response[0]?.geojson) {
            return response[0].geojson;
        }
        throw new TrError(
            'cannot fetch property registry points geojson collection because database did not return a valid geojson',
            'PRQ0002',
            'PropertyRegistryGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        if (TrError.isTrError(error)) {
            throw error;
        }
        throw new TrError(
            `cannot fetch property registry points geojson collection because of a database error (knex error: ${error})`,
            'PRQ0003',
            'PropertyRegistryGeojsonCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

/**
 * This function fetches the property registry point by ID,
 * in order of precision.
 * When main entrance is not available, it will coalesce
 * to building centroid, then parcel centroid.
 * Only the minimum number of fields are fetched.
 * TODO: More fields may be added later if needed.
 *
 * @param id - The ID of the property to fetch.
 * @returns The property registry point as a GeoJSON feature.
 */
const readPoint = async (
    id: string | number
): Promise<GeoJSON.Feature<GeoJSON.Point, PropertyRegistryRecordPointGeoJSONProperties>> => {
    try {
        const rows = await knex(tableName)
            .select(
                'id',
                knex.raw(
                    `CASE WHEN ${coalescedPointSql} IS NULL THEN NULL
                        ELSE ST_AsGeoJSON(${coalescedPointSql})::jsonb
                    END as geometry`
                ),
                pointPropertiesRaw()
            )
            .where('id', id);
        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'PRQ0011',
                'PropertyRegistryCannotReadPointBecauseObjectDoesNotExist'
            );
        }
        return rows[0];
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'PRQ0012',
            'PropertyRegistryCannotReadPointBecauseDatabaseError'
        );
    }
};

/**
 * This function fetches the property registry object by ID.
 * Will fetch every fields and convert all geography fields to GeoJSON.
 * @param id - The ID of the object to fetch.
 * @returns The property registry object.
 */
const read = async (id: string | number) => {
    try {
        const geogAsGeoJson = (col: string) =>
            knex.raw('CASE WHEN ?? IS NULL THEN NULL ELSE ST_AsGeoJSON(??)::jsonb END as ??', [col, col, col]);
        const rows = await knex(tableName)
            .select(
                '*',
                geogAsGeoJson('geog_main_building_polygon'),
                geogAsGeoJson('geog_parcel_polygon'),
                geogAsGeoJson('geog_main_building_centroid_point'),
                geogAsGeoJson('geog_parcel_centroid_point'),
                geogAsGeoJson('geog_main_entrance_point')
            )
            .where('id', id);
        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'PRQ0021',
                'PropertyRegistryCannotReadPointBecauseObjectDoesNotExist'
            );
        }
        return attributesParser(rows[0]);
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'PRQ0022',
            'PropertyRegistryCannotReadPointBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    readPoint,
    create: (
        newObject: Partial<PropertyRegistryRecordAttributes>,
        options?: { returning?: string; transaction?: Knex.Transaction }
    ) =>
        create<PropertyRegistryRecordAttributes, Partial<PropertyRegistryRecordToDbAttributes>>(
            knex,
            tableName,
            attributesCleaner,
            newObject,
            options
        ),
    createMultiple: (
        newObjects: Partial<PropertyRegistryRecordAttributes>[],
        options?: { returning?: string | string[]; transaction?: Knex.Transaction }
    ) =>
        createMultiple<PropertyRegistryRecordAttributes, Partial<PropertyRegistryRecordToDbAttributes>>(
            knex,
            tableName,
            attributesCleaner,
            newObjects,
            options
        ),
    pointsGeojsonCollection,
    deleteForDataSourceId: deleteForDataSourceId.bind(null, knex, tableName)
};
