/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Clinics (Low volume)',
    osmQueryOr: [
        {
            tags: {
                healthcare: 'dentist'
            }
        },
        {
            tags: {
                amenity: 'dentist'
            }
        },
        {
            tags: {
                healthcare: 'optometrist'
            }
        },
        {
            tags: {
                healthcare: 'occupational_therapist'
            }
        },
        {
            tags: {
                healthcare: 'laboratory'
            }
        },
        {
            tags: {
                healthcare: 'alternative'
            }
        },
        {
            tags: {
                healthcare: 'physiotherapist'
            }
        },
        {
            tags: {
                healthcare: 'psychotherapist'
            }
        },
        {
            tags: {
                healthcare: 'podiatrist'
            }
        },
        {
            tags: {
                healthcare: 'audiologist'
            }
        },
        {
            tags: {
                amenity: 'veterinary'
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
        max: 250
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.5,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
