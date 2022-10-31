/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Fitness centers',
    osmQueryOr: [
        {
            tags: {
                leisure: 'fitness_centre'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 630,
        min: 150,
        max: 2000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 1,
        max: undefined
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.19,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
