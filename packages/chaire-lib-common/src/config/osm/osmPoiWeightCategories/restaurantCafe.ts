/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Cafes',
    osmQueryOr: [
        {
            tags: {
                amenity: 'cafe'
            }
        },
        {
            tags: {
                amenity: 'internet_cafe'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 240,
        min: 50,
        max: 400
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 20,
        max: 300
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.47,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
