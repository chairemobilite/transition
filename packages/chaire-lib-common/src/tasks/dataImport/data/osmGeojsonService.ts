/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { SingleGeoFeature } from '../../../services/geodata/GeoJSONUtils';
import { DataGeojson } from './dataGeojson';
import { OsmRawDataType, OsmRawDataTypeNode } from './dataOsmRaw';
import { PlaceCategory } from '../../../config/osm/osmMappingDetailedCategoryToCategory';

/**
 * Geojson properties for entrances
 */
export type ResidentialEntranceGeojsonProperties = {
    building_id: number | string;
    'building:flats': number;
    area: number;
    retirement_home: boolean;
    from_landrole: boolean;
    weight_categories?: string[];
    'building:levels'?: number;
    'building:floor_area'?: number; // in Quebec, this should always be in squared meters, but this should be validated with levels and building area when available
    flats?: number;
    building?: any;
    zone_id?: number | string;
    entrance_type?: 'entrance' | 'centroid';
    'weight:tripDestinationsPerWeekday'?: number;
    assignedFloorArea?: number;
    [name: string]: any;
};

export type NonResidentialEntranceGeojsonProperties = {
    building_id?: number | string;
    osm_poi_id?: number | string;
    category?: PlaceCategory;
    category_detailed?: string;
    weight_categories?: string[];
    entrance_type?: 'entrance' | 'buildingCentroid' | 'routingEntrance' | 'centroid' | 'nearestEntrance';
    entrance?: string[];
    name?: string;
    area?: number;
    'building:levels'?: number;
    'building:floor_area'?: number; // in Quebec, this should always be in squared meters, but this should be validated with levels and building area when available
    building?: any;
    'weight:tripDestinationsPerWeekday'?: number;
    assignedFloorArea?: number;
    [name: string]: any;
};

export type ResidenceGeojsonProperties = {
    from_landrole: boolean;
    area: number;
    retirement_home: boolean;
    land_value: number;
    [name: string]: any;
};

export type ZoneGeojsonProperties = {
    /**
     * Number of flats from buildings defined in OSM
     */
    flats_from_osm: number;
    /**
     * Total number of flats in the zone
     */
    flats: number;
    [name: string]: any;
};

export type PointOfInterest = GeoJSON.Feature<GeoJSON.Point, NonResidentialEntranceGeojsonProperties>;

/**
 * Check whether the given properties are those of a retirement home
 * @param properties The properties of the feature for which to check if it is a
 * retirement home
 */
const isRetirementHome = function (properties: { [name: string]: any }): boolean {
    // (amenity=retirement_home or amenity=social_facility with
    // social_facility:for=senior) (can be both:
    // amenity=retirement_home;social_facility)
    const amenities = (properties['amenity'] || '').split(';');
    if (amenities.includes('retirement_home')) {
        // this tag is deprecated in osm
        return true;
    }
    if (amenities.includes('social_facility')) {
        const socialFacilityFor = (properties['social_facility:for'] || '').split(';');
        return socialFacilityFor.includes('senior');
    }
    return false;
};

/**
 * Check whether the given properties are those of a park
 * @param properties The properties of the feature for which to check if it is a
 * park
 */
const isPark = function (properties: { [name: string]: any }): boolean {
    const leisure = (properties['leisure'] || '').split(';');
    if (leisure.includes('park')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a playground
 * @param properties The properties of the feature for which to check if it is a
 * playground
 */
const isPlayground = function (properties: { [name: string]: any }): boolean {
    const leisure = (properties['leisure'] || '').split(';');
    if (leisure.includes('playground')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a sport pitch
 * @param properties The properties of the feature for which to check if it is a
 * sport pitch
 */
const isSportPitch = function (properties: { [name: string]: any }): boolean {
    const leisure = (properties['leisure'] || '').split(';');
    if (leisure.includes('pitch')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a school
 * @param properties The properties of the feature for which to check if it is a
 * school
 */
const isSchool = function (properties: { [name: string]: any }): boolean {
    const amenities = (properties['amenity'] || '').split(';');
    if (amenities.includes('school')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a college
 * @param properties The properties of the feature for which to check if it is a
 * college
 */
const isCollege = function (properties: { [name: string]: any }): boolean {
    const amenities = (properties['amenity'] || '').split(';');
    if (amenities.includes('college')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a university
 * @param properties The properties of the feature for which to check if it is a
 * university
 */
const isUniversity = function (properties: { [name: string]: any }): boolean {
    const amenities = (properties['university'] || '').split(';');
    if (amenities.includes('university')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a commercial building
 * @param properties The properties of the feature for which to check if it is a
 * commercial building
 */
const isCommercialBuilding = function (properties: { [name: string]: any }): boolean {
    const buildings = (properties['building'] || '').split(';');
    if (buildings.includes('commercial') || buildings.includes('retail')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of an industrial building
 * @param properties The properties of the feature for which to check if it is an
 * industrial building
 */
const isIndustrialBuilding = function (properties: { [name: string]: any }): boolean {
    const buildings = (properties['building'] || '').split(';');
    if (buildings.includes('industrial')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a religious area
 * @param properties The properties of the feature for which to check if it is a
 * religious area
 */
const isReligiousArea = function (properties: { [name: string]: any }): boolean {
    const landuses = (properties['landuse'] || '').split(';');
    if (landuses.includes('religious')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a residential area
 * @param properties The properties of the feature for which to check if it is a
 * residential area
 */
const isResidentialArea = function (properties: { [name: string]: any }): boolean {
    const landuses = (properties['landuse'] || '').split(';');
    if (landuses.includes('residential')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of a commercial area
 * @param properties The properties of the feature for which to check if it is a
 * commercial area
 */
const isCommercialArea = function (properties: { [name: string]: any }): boolean {
    const landuses = (properties['landuse'] || '').split(';');
    if (landuses.includes('commercial') || landuses.includes('retail')) {
        return true;
    }
    return false;
};

/**
 * Check whether the given properties are those of an industrial area
 * @param properties The properties of the feature for which to check if it is an
 * industrial area
 */
const isIndustrialArea = function (properties: { [name: string]: any }): boolean {
    const landuses = (properties['landuse'] || '').split(';');
    if (landuses.includes('industrial')) {
        return true;
    }
    return false;
};

/**
 * Get the building or POI (node) category
 * @param properties The properties of the feature for which to check for the category
 */
const getCategory = function (_properties: { [name: string]: any }): string | null {
    // TODO: Make this function do something, or delete it.
    return null;
};

/**
 * Get the building or POI (node) detailed category
 * @param properties The properties of the feature for which to check for the category
 */
const getCategoryDetailed = function (_properties: { [name: string]: any }): string | null {
    // TODO: Make this function do something, or delete it.
    return null;
};

const unsplitTags = (tags: { [key: string]: string[] | undefined }): { [key: string]: string } => {
    const obj: { [key: string]: string } = {};
    Object.keys(tags).forEach((tag) => {
        if (Array.isArray(tags[tag])) {
            obj[tag] = (tags[tag] as string[]).join(';');
        }
    });
    return obj;
};

const getGeojsonsFromRawData = (
    geojsonData: DataGeojson,
    features: OsmRawDataType[],
    options: { generateNodesIfNotFound: boolean; continueOnMissingGeojson: boolean } = {
        generateNodesIfNotFound: false,
        continueOnMissingGeojson: false
    }
): { geojson: SingleGeoFeature; raw: OsmRawDataType }[] => {
    const geojsonFeatures: { geojson: SingleGeoFeature; raw: OsmRawDataType }[] = [];
    for (let i = 0; i < features.length; i++) {
        let geojson = geojsonData.find({ id: features[i].type + '/' + features[i].id });
        if (!geojson) {
            if (options.generateNodesIfNotFound && features[i].type === 'node') {
                const osmNode = features[i] as OsmRawDataTypeNode;
                geojson = {
                    type: 'Feature' as const,
                    id: features[i].type + '/' + features[i].id,
                    geometry: { type: 'Point' as const, coordinates: [osmNode.lon, osmNode.lat] },
                    properties: unsplitTags(osmNode.tags || {})
                };
            } else {
                console.warn(
                    'A geojson has not been found for the OSM feature %s/%s. Check if you have the right files or verify the OSM data.',
                    features[i].type,
                    features[i].id
                );
                if (options.continueOnMissingGeojson) {
                    continue;
                } else {
                    throw 'Missing OSM geojson';
                }
            }
        } else if (geojson.geometry.type === 'GeometryCollection') {
            console.log('Building ' + geojson.id + ' is of unsupported type GeometryCollection');
            throw 'Unsupported geometry type for building';
        }
        geojsonFeatures.push({ geojson: geojson as SingleGeoFeature, raw: features[i] });
    }
    return geojsonFeatures;
};

export default {
    isRetirementHome,
    isPark,
    isPlayground,
    isSportPitch,
    isSchool,
    isCollege,
    isUniversity,
    isCommercialBuilding,
    isIndustrialBuilding,
    isReligiousArea,
    isResidentialArea,
    isCommercialArea,
    isIndustrialArea,
    getCategory,
    getCategoryDetailed,
    getGeojsonsFromRawData
};
