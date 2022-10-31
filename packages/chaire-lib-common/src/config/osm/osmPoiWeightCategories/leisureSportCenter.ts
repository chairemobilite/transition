/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Sport centers',
    osmQueryOr: [
        {
            tags: {
                leisure: 'sports_centre'
            }
        },
        {
            tags: {
                leisure: 'sports_center'
            }
        },
        {
            tags: {
                leisure: 'amusement_arcade'
            }
        },
        {
            tags: {
                leisure: 'bowling_alley'
            }
        },
        {
            tags: {
                leisure: 'indoor_play'
            }
        },
        {
            tags: {
                leisure: 'events_venue'
            }
        },
        {
            tags: {
                amenity: 'events_venue'
            }
        },
        {
            tags: {
                leisure: 'dance'
            }
        },
        {
            tags: {
                amenity: 'dojo'
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
        min: 1,
        max: undefined
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.18,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
