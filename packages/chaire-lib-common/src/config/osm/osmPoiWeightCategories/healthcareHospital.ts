/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Hospitals',
    osmQueryOr: [
        {
            tags: {
                amenity: 'hospital'
            }
        },
        {
            tags: {
                healthcare: 'hospital'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 50000,
        min: 18000,
        max: 95000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 800,
        max: 10000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.08,
        min: 0.06,
        max: 0.09
    }
};

export default poiWeightCategory;
