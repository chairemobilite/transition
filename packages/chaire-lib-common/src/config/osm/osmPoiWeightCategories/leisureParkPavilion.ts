/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Park pavilions',
    osmQueryOr: [
        {
            tags: {
                building: 'pavilion'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 250,
        min: 10,
        max: 50
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 1,
        max: 150
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.05, // TODO: find better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
