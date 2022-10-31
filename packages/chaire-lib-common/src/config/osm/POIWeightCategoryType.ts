/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { OsmRawQueryOr } from '../../tasks/dataImport/data/dataOsmRaw';
import { Activities } from '../lookups';
import { PlaceCategory, PlaceDetailedCategory } from './osmMappingDetailedCategoryToCategory';

/*
These are POIs categories used for generating a plausible number of trips per weekday
with matching osm tags. The level of detailed is variable. All matching tags in a POI
category will have common trip generation rates according to samples and Trip Generation
Manual.
*/

export type POIWeightCategory = {
    /*
    Description of the POI category
    */
    description: string;

    /*
    Array of matching osm tags used to build queries for matching
    the POI category to any osm data.
    */
    osmQueryOr: OsmRawQueryOr[];

    /*
    Used when using the floor area to determine the weight of the POI.
    Setting a min or max will change the calculated value.
    Average would be used if no floor area could be found or calculated for
    the POI building.
    */
    floorArea?: {
        average?: number;
        min?: number; // trigger a warning if floor area is < min, but user could accept
        max?: number; // trigger a warning if floor area is > max, but user could accept
    };

    /*
    The associated ITE Land Use Code: https://www.ite.org/ (could be partially associated).
    */
    ITELandUseCodes: number[];

    /*
    OD associated activities (could be partially associated).
    */
    activities: Activities[];

    /*
    Weights are in number of trip destinations generated per weekday.
    Floor area is used, but these min and max will override the floor area
    calculated values.
    */
    tripDestinationsPerWeekday?: {
        min?: number; // trigger a warning if generated number of trip is < min, but user could accept
        max?: number; // trigger a warning if generated number of trip is > max, but user could accept
    };

    /*
    Which tag to use to get the area for the POI (building:floor_area or building:area or polygon:area for non-building)
    Default is building:floor_area
    */
    areaTag?: string;

    /*
    OD and Trip generation Manual weighted number of trip destinations per m2 per weekday,
    any activity, any mode estimated only for destinations for which the POI is unique and
    clear enough to be associated with. Be careful because these are only sampled from large
    buildings with clear delimitations. 2021 regional survey data and later could
    give better, more precise estimations since the respondent must declare the name
    of the POI in the questionnaire. By default, the average value is used to generate trips.
    TODO: add a way to use a custom function (log or exponential) instead of the average
    */
    tripDestinationsTripsPerSqMetersPerWeekday?: {
        average: number;
        min?: number;
        max?: number;
    };

    /*
    Which tag to use to get capacity for the POI (student:count, employees, etc.)
    */
    capacityTag?: string;

    /*
    OD and Trip generation Manual weighted number of trip destinations per capacity per weekday,
    any activity, any mode. If you use this instead of per m2, provide capacityTag so we know
    where to take the capacity 9could be number of students, employees, etc.).
    TODO: add the possibility to prioritize capacity and/or m2 when calculating weights
    */
    tripDestinationsTripsPerCapacityPerWeekday?: {
        average: number;
        min?: number;
        max?: number;
    };

    /*
    Methods to use to generate number of trips per weekday, in priorization order
    */
    tripDestinationsTripsMethods: ('capacity' | 'area')[];

    /*
    Main associated aggregation categories
    */
    categories?: PlaceCategory[];

    /*
    Main associated  aggregation detailed categories
    */
    detailedCategories?: PlaceDetailedCategory[];
};
