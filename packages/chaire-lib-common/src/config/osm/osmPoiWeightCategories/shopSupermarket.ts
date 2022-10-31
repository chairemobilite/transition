/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Supermarkets',
    osmQueryOr: [
        {
            tags: {
                shop: 'supermarket'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 870,
        min: 200,
        max: 10000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 2000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.35, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
