/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Dog parks (area)',
    osmQueryOr: [
        {
            tags: {
                leisure: 'dog_park'
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
        min: 5,
        max: 60
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.02, // TODO: get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
