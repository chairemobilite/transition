/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Aquariums',
    osmQueryOr: [
        {
            tags: {
                tourism: 'aquarium'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area', // TODO: should use the capacity in seats
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
        average: 0.03, // TODO: find better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
