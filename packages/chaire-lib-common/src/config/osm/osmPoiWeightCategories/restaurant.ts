/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Restaurants',
    osmQueryOr: [
        {
            tags: {
                amenity: 'restaurant'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 315,
        min: 50,
        max: 800
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 20,
        max: 300
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.33,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
