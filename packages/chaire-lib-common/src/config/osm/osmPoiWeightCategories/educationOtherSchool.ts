/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Other school (music, acting, dance, crafts, driving, language, etc.)',
    osmQueryOr: [
        {
            tags: {
                amenity: 'art_school'
            }
        },
        {
            tags: {
                amenity: 'music_school'
            }
        },
        {
            tags: {
                amenity: 'theatre_school'
            }
        },
        {
            tags: {
                amenity: 'prep_school'
            }
        },
        {
            tags: {
                amenity: 'dancing_school'
            }
        },
        {
            tags: {
                amenity: 'language_school'
            }
        },
        {
            tags: {
                amenity: 'driving_school'
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
        max: 100
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.15,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
