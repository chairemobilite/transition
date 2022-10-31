/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Hotels and motels',
    osmQueryOr: [
        {
            tags: {
                tourism: 'hotel'
            }
        },
        {
            tags: {
                tourism: 'motel'
            }
        },
        {
            tags: {
                tourism: 'hostel'
            }
        },
        {
            tags: {
                tourism: 'love_hotel'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: undefined
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 500
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.05, // TODO: does not include tourists for now
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
