/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Fast food restaurant',
    osmQueryOr: [
        {
            tags: {
                amenity: 'fast_food'
            }
        },
        {
            tags: {
                amenity: 'food_court'
            }
        },
        {
            tags: {
                amenity: 'ice_cream'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 220,
        min: 10,
        max: 700
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 20,
        max: 400
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.65,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
