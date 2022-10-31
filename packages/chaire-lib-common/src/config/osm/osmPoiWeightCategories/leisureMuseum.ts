/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples
//TODO: deal with outdoor museum and attractions (without buildings)
//TODO: separate theatre with better estimate
const poiWeightCategory: POIWeightCategory = {
    description: 'Museums',
    osmQueryOr: [
        {
            tags: {
                tourism: 'museum'
            }
        },
        {
            tags: {
                tourism: 'theatre'
            }
        },
        {
            tags: {
                tourism: 'arts_centre'
            }
        },
        {
            tags: {
                tourism: 'attraction'
            }
        },
        {
            tags: {
                amenity: 'arts_centre'
            }
        },
        {
            tags: {
                tourism: 'gallery'
            }
        },
        {
            tags: {
                historic: 'manor'
            }
        },
        {
            tags: {
                historic: 'memorial'
            }
        },
        {
            tags: {
                historic: 'monument'
            }
        },
        {
            tags: {
                man_made: 'observatory'
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
        max: 200
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.09, // TODO: find better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
