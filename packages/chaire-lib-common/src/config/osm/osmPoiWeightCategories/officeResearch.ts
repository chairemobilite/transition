/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Research institute or office',
    osmQueryOr: [
        {
            tags: {
                amenity: 'research_institute'
            }
        },
        {
            tags: {
                office: 'research'
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
        max: 1000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.1,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
