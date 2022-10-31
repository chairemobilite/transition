/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Community centers',
    osmQueryOr: [
        /*{
        tags: {
            leisure: 'golf_course' // there should always be a clubhouse in a building instead
        }
    }, */ {
            tags: {
                golf: 'clubhouse'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: undefined
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 300
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.15, // TODO, find a better estimate, may be a bit low
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
