/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Hairdressers and beauty shops',
    osmQueryOr: [
        {
            tags: {
                shop: 'beauty'
            }
        },
        {
            tags: {
                shop: 'hairdresser'
            }
        },
        {
            tags: {
                shop: 'massage'
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
        max: 150
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.2, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
