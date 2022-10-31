/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Parks (area)',
    osmQueryOr: [
        {
            tags: {
                leisure: 'park'
            }
        },
        {
            tags: {
                leisure: 'recreation_ground'
            }
        },
        {
            tags: {
                leisure: 'garden'
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
        min: 5,
        max: 50
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.0001, // TODO: get a better estimate, does not include playgrounds, sport pitches and pavilion buildings inside the park
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
