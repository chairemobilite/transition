/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

const poiWeightCategory: POIWeightCategory = {
    description:
        'Department and wholesale branded stores (including Walmart, Costco, Canadian Tire, Giant Tiger, Hart, Target and alike)',
    osmQueryOr: [
        {
            tags: {
                shop: 'department_store'
            }
        },
        {
            tags: {
                name: 'Walmart Supercenter', // Walmart supercenters are tagged as supermarket in Canada, but always have the name Walmart Supercenter
                brand: 'Walmart'
            }
        },
        {
            tags: {
                shop: 'wholesale',
                brand: 'Costco'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 1850,
        min: 760,
        max: 14300
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 500,
        max: 6000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.52,
        min: 0.32,
        max: 0.67
    }
};

export default poiWeightCategory;
