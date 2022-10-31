/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Colleges and universities',
    osmQueryOr: [
        {
            tags: {
                amenity: 'college'
            }
        },
        {
            tags: {
                amenity: 'university'
            }
        }
    ],
    tripDestinationsTripsMethods: ['capacity'],
    floorArea: {
        average: undefined,
        min: undefined,
        max: undefined
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 100,
        max: 5000
    },
    capacityTag: 'student:count', // if the school is multi-level (student:count:primary, student:count:secondary), there must also be the total/sum in student:count
    tripDestinationsTripsPerCapacityPerWeekday: {
        average: 1.0,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
