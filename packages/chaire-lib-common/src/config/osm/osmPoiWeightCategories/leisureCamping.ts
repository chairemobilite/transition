/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Camping',
    osmQueryOr: [
        {
            tags: {
                camping: 'reception'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area', // TODO: this should be polygon:area instead maybe?
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
        average: 0.1, // TODO: find a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
