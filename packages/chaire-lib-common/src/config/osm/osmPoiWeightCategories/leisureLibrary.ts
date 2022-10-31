/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Libraries',
    osmQueryOr: [
        {
            tags: {
                amenity: 'library'
            }
        },
        {
            tags: {
                amenity: 'toy_library'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 1103,
        min: 150,
        max: 2500
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 50,
        max: 500
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.18,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
