/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Industrial including factories',
    osmQueryOr: [
        {
            tags: {
                office: 'transport'
            }
        },
        {
            tags: {
                industrial: 'transport'
            }
        },
        {
            tags: {
                industrial: 'distributor'
            }
        },
        {
            tags: {
                office: 'distributor'
            }
        },
        {
            tags: {
                craft: 'storage'
            }
        },
        {
            tags: {
                craft: 'storage_rental'
            }
        },
        {
            tags: {
                shop: 'storage_rental'
            }
        },
        {
            tags: {
                telecom: 'data_center' // TODO: separate
            }
        },
        {
            tags: {
                telecom: 'data_centre' // TODO: separate
            }
        },
        {
            tags: {
                industrial: 'storage'
            }
        },
        {
            tags: {
                railway: 'yard'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: 40000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: undefined,
        max: undefined
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.015,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
