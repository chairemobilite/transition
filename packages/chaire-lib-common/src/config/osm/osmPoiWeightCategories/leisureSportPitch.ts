/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Sport pitches',
    osmQueryOr: [
        {
            tags: {
                leisure: 'pitch'
            }
        },
        {
            tags: {
                leisure: 'ice_rink'
            }
        },
        {
            tags: {
                leisure: 'track'
            }
        },
        {
            tags: {
                leisure: 'disk_golf_course'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'polygon:area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: undefined
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 1,
        max: 100
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.01, // TODO: find better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
