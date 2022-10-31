/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Community centers',
    osmQueryOr: [
        {
            tags: {
                amenity: 'community_centre'
            }
        },
        {
            tags: {
                amenity: 'community_hall'
            }
        },
        {
            tags: {
                amenity: 'community_center'
            }
        },
        {
            tags: {
                amenity: 'community_centre'
            }
        },
        {
            tags: {
                amenity: 'conference_center' // TODO: separate
            }
        },
        {
            tags: {
                amenity: 'conference_centre' // TODO: separate
            }
        },
        {
            tags: {
                amenity: 'theatre' // TODO: separate
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
        min: 50,
        max: 500
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.13,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
