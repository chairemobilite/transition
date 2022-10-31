/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Shops with medium number of clients',
    osmQueryOr: [
        {
            tags: {
                shop: 'florist'
            }
        },
        {
            tags: {
                shop: 'games'
            }
        },
        {
            tags: {
                shop: 'video_games'
            }
        },
        {
            tags: {
                shop: 'video'
            }
        },
        {
            tags: {
                shop: 'anime'
            }
        },
        {
            tags: {
                shop: 'books'
            }
        },
        {
            tags: {
                shop: 'baby_goods'
            }
        },
        {
            tags: {
                shop: 'party'
            }
        },
        {
            tags: {
                shop: 'lottery'
            }
        },
        {
            tags: {
                shop: 'hifi'
            }
        },
        {
            tags: {
                shop: 'garden_centre'
            }
        },
        {
            tags: {
                shop: 'clothes'
            }
        },
        {
            tags: {
                shop: 'interior_decoration'
            }
        },
        {
            tags: {
                shop: 'outdoor'
            }
        },
        {
            tags: {
                shop: 'wholesale'
            }
        },
        {
            tags: {
                shop: 'electronics'
            }
        },
        {
            tags: {
                shop: 'electronics'
            }
        },
        {
            tags: {
                shop: 'cosmetics'
            }
        },
        {
            tags: {
                shop: 'fashion_accessories'
            }
        },
        {
            tags: {
                shop: 'bag'
            }
        },
        {
            tags: {
                shop: 'shoes'
            }
        },
        {
            tags: {
                shop: 'mobile_phone'
            }
        },
        {
            tags: {
                shop: 'beauty_care'
            }
        },
        {
            tags: {
                shop: 'toys'
            }
        },
        {
            tags: {
                shop: 'variety_store'
            }
        },
        {
            tags: {
                shop: 'sports'
            }
        },
        {
            tags: {
                shop: 'music'
            }
        },
        {
            tags: {
                shop: 'gift'
            }
        },
        {
            tags: {
                shop: 'nutrition_supplements'
            }
        },
        {
            tags: {
                shop: 'health_food'
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
        max: 200
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.3, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
