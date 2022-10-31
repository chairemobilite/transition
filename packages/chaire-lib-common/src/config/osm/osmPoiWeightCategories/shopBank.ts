/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Banks',
    osmQueryOr: [
        {
            tags: {
                amenity: 'bank'
            }
        },
        {
            tags: {
                amenity: 'bureau_de_change'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 350,
        min: 100,
        max: 500
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 300
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.2, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
