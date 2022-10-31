/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Car repair and car parts',
    osmQueryOr: [
        {
            tags: {
                shop: 'car_repair'
            }
        },
        {
            tags: {
                shop: 'car_parts'
            }
        },
        {
            tags: {
                amenity: 'car_repair'
            }
        },
        {
            tags: {
                amenity: 'motorcycle_repair'
            }
        },
        {
            tags: {
                shop: 'motorcycle_repair'
            }
        },
        {
            tags: {
                shop: 'car_wash'
            }
        },
        {
            tags: {
                amenity: 'car_wash'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 500,
        min: 150,
        max: 1000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 150
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.15,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
