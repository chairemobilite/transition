/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Places of worship',
    osmQueryOr: [
        {
            tags: {
                amenity: 'church'
            }
        },
        {
            tags: {
                building: 'church'
            }
        },
        {
            tags: {
                amenity: 'place_of_worship'
            }
        },
        {
            tags: {
                amenity: 'synagogue'
            }
        },
        {
            tags: {
                building: 'synagogue'
            }
        },
        {
            tags: {
                amenity: 'cathedral'
            }
        },
        {
            tags: {
                amenity: 'chapel'
            }
        },
        {
            tags: {
                building: 'chapel'
            }
        },
        {
            tags: {
                amenity: 'mosque'
            }
        },
        {
            tags: {
                amenity: 'building'
            }
        },
        {
            tags: {
                amenity: 'religious'
            }
        },
        {
            tags: {
                amenity: 'shrine'
            }
        },
        {
            tags: {
                building: 'shrine'
            }
        },
        {
            tags: {
                amenity: 'temple'
            }
        },
        {
            tags: {
                building: 'temple'
            }
        },
        {
            tags: {
                historic: 'monastery'
            }
        },
        {
            tags: {
                amenity: 'monastery'
            }
        },
        {
            tags: {
                building: 'monastery'
            }
        },
        {
            tags: {
                historic: 'church'
            }
        },
        {
            tags: {
                historic: 'wayside_chapel'
            }
        },
        {
            tags: {
                amenity: 'wayside_chapel'
            }
        },
        {
            tags: {
                building: 'wayside_chapel'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 860,
        min: 50,
        max: 4000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: undefined,
        max: 400
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.1,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
