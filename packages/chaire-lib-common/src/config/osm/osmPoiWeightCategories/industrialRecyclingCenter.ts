/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Recycling centers',
    osmQueryOr: [
        {
            tags: {
                amenity: 'recycling',
                recycling_type: 'centre'
            }
        },
        {
            tags: {
                amenity: 'recycling',
                recycling_type: 'center'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: 10000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: undefined,
        max: undefined
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.026, // TODO: find a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
