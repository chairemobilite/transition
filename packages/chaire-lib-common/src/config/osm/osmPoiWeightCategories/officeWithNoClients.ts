/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Generic office with no clients',
    osmQueryOr: [
        {
            tags: {
                office: 'aerospace'
            }
        },
        {
            tags: {
                office: 'cleaning'
            }
        },
        {
            tags: {
                office: 'distributor'
            }
        },
        {
            tags: {
                office: 'environment'
            }
        },
        {
            tags: {
                office: 'educational_institution'
            }
        },
        {
            tags: {
                office: 'research'
            }
        },
        {
            tags: {
                office: 'energy_supplier'
            }
        },
        {
            tags: {
                office: 'financial'
            }
        },
        {
            tags: {
                office: 'fishing'
            }
        },
        {
            tags: {
                office: 'food_broker'
            }
        },
        {
            tags: {
                office: 'gas'
            }
        },
        {
            tags: {
                office: 'import_export'
            }
        },
        {
            tags: {
                office: 'insurance'
            }
        },
        {
            tags: {
                office: 'it'
            }
        },
        {
            tags: {
                office: 'machining'
            }
        },
        {
            tags: {
                office: 'metrology'
            }
        },
        {
            tags: {
                office: 'moving_company'
            }
        },
        {
            tags: {
                office: 'company'
            }
        },
        {
            tags: {
                office: 'newspaper'
            }
        },
        {
            tags: {
                office: 'public_works'
            }
        },
        {
            tags: {
                office: 'rail'
            }
        },
        {
            tags: {
                office: 'telecommunication'
            }
        },
        {
            tags: {
                office: 'utility'
            }
        },
        {
            tags: {
                office: 'water_utility'
            }
        },
        {
            tags: {
                office: 'finance'
            }
        },
        {
            tags: {
                office: 'electricity'
            }
        },
        {
            tags: {
                office: 'distribution'
            }
        },
        {
            tags: {
                office: 'airlines'
            }
        },
        {
            tags: {
                office: 'airline'
            }
        },
        {
            tags: {
                office: 'moving'
            }
        },
        {
            tags: {
                office: 'forestry'
            }
        },
        {
            tags: {
                office: 'harbour_master'
            }
        },
        {
            tags: {
                office: 'yes'
            }
        }
    ],
    /*

        office=research
    therapist

    */
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
        max: 200
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.05,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
