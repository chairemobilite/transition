/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Gas stations',
    osmQueryOr: [
        {
            tags: {
                amenity: 'fuel'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 150,
        min: 50,
        max: 1000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 1000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 2.0, // TODO: get better estimation
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
