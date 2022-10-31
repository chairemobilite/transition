/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples
//TODO: separate swimming pools

const poiWeightCategory: POIWeightCategory = {
    description: 'Park playgrounds',
    osmQueryOr: [
        {
            tags: {
                leisure: 'playground'
            }
        },
        {
            tags: {
                leisure: 'splash_pad'
            }
        },
        {
            tags: {
                leisure: 'swimming_pool'
            }
        },
        {
            tags: {
                amenity: 'swimming_pool'
            }
        },
        {
            tags: {
                tourism: 'picnic_site'
            }
        },
        {
            tags: {
                leisure: 'fitness_station'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'polygon:area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: undefined
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 1,
        max: 100
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.1, // TODO: find better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
