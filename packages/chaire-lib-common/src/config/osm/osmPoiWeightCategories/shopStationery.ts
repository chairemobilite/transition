/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Stationery stores',
    osmQueryOr: [
        {
            tags: {
                shop: 'stationery'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 1000,
        min: 200,
        max: 4000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 30,
        max: 450
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.11, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
