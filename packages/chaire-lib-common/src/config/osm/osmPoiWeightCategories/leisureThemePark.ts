/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Theme parks',
    osmQueryOr: [
        {
            tags: {
                leisure: 'water_park'
            }
        },
        {
            tags: {
                tourism: 'theme_park'
            }
        },
        {
            tags: {
                tourism: 'zoo'
            }
        },
        {
            tags: {
                leisure: 'miniature_golf'
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
        min: 10,
        max: 1000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.001, // TODO: find better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
