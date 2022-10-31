/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Clinics (High volume)',
    osmQueryOr: [
        {
            tags: {
                amenity: 'clinic'
            }
        },
        {
            tags: {
                amenity: 'doctors'
            }
        },
        {
            tags: {
                healthcare: 'clinic'
            }
        },
        {
            tags: {
                healthcare: 'doctor'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 280,
        min: 10,
        max: 800
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 10,
        max: 500
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.98,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
