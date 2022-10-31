/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Schools (primary and secondary)',
    osmQueryOr: [
        {
            tags: {
                amenity: 'school'
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
        max: 3000
    },

    capacityTag: 'student:count', // if the school is multi-level (student:count:primary, student:count:secondary), there must also be the total/sum in student:count
    tripDestinationsTripsPerCapacityPerWeekday: {
        average: 1.6, // some parents bring their child to school and so have 2 trips per day + children going home for diner. TODO: make this configurable by kind of school and distance from homes
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
