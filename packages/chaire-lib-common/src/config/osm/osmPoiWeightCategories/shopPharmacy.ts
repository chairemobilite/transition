/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Pharmacies',
    osmQueryOr: [
        {
            tags: {
                amenity: 'pharmacy'
            }
        },
        {
            tags: {
                shop: 'pharmacy'
            }
        },
        {
            tags: {
                healthcare: 'pharmacy'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 750,
        min: 100,
        max: 1800
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 450
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.3, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
