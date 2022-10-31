/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Bars, pubs and nightclubs',
    osmQueryOr: [
        {
            tags: {
                amenity: 'bar'
            }
        },
        {
            tags: {
                amenity: 'social_club'
            }
        },
        {
            tags: {
                amenity: 'pub'
            }
        },
        {
            tags: {
                amenity: 'nightclub'
            }
        },
        {
            tags: {
                amenity: 'brothel'
            }
        },
        {
            tags: {
                amenity: 'stripclub'
            }
        },
        {
            tags: {
                amenity: 'swingerclub'
            }
        },
        {
            tags: {
                amenity: 'karaoke_box'
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
        average: 0.33, // using restaurant value for now, TODO: estimate this better
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
