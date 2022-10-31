/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Food stores',
    osmQueryOr: [
        {
            tags: {
                shop: 'bakery'
            }
        },
        {
            tags: {
                shop: 'pastry'
            }
        },
        {
            tags: {
                shop: 'coffee'
            }
        },
        {
            tags: {
                shop: 'farm'
            }
        },
        {
            tags: {
                shop: 'alcohol'
            }
        },
        {
            tags: {
                shop: 'greengrocer'
            }
        },
        {
            tags: {
                shop: 'grocery'
            }
        },
        {
            tags: {
                shop: 'food'
            }
        },
        {
            tags: {
                shop: 'deli'
            }
        },
        {
            tags: {
                shop: 'chocolate'
            }
        },
        {
            tags: {
                shop: 'wine'
            }
        },
        {
            tags: {
                shop: 'cannabis'
            }
        },
        {
            tags: {
                shop: 'tea'
            }
        },
        {
            tags: {
                shop: 'cheese'
            }
        },
        {
            tags: {
                shop: 'water'
            }
        },
        {
            tags: {
                shop: 'butcher'
            }
        },
        {
            tags: {
                amenity: 'marketplace'
            }
        },
        {
            tags: {
                shop: 'beverages'
            }
        },
        {
            tags: {
                shop: 'confectionery'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 240, // TODO: update with better estimates
        min: 100,
        max: 450
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 300
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.7, // TODO: update with better estimates for each kind
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
