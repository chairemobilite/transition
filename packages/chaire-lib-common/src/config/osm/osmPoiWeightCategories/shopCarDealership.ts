/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Car dealerships',
    osmQueryOr: [
        {
            tags: {
                shop: 'car'
            }
        },
        {
            tags: {
                shop: 'motorcycle'
            }
        },
        {
            tags: {
                shop: 'trailers'
            }
        },
        {
            tags: {
                shop: 'tractor'
            }
        },
        {
            tags: {
                shop: 'forklift'
            }
        },
        {
            tags: {
                shop: 'atv'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 1348,
        min: 180,
        max: 3000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 200
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.07,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
