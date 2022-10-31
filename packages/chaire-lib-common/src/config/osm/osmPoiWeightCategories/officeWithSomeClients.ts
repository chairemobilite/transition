/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Generic office with limited number of clients',
    osmQueryOr: [
        {
            tags: {
                office: 'guide'
            }
        },
        {
            tags: {
                office: 'religion'
            }
        },
        {
            tags: {
                office: 'ngo'
            }
        },
        {
            tags: {
                office: 'quango'
            }
        },
        {
            tags: {
                office: 'political_party'
            }
        },
        {
            tags: {
                office: 'accountant'
            }
        },
        {
            tags: {
                office: 'foundation'
            }
        },
        {
            tags: {
                office: 'financial_advisor'
            }
        },
        {
            tags: {
                office: 'notary'
            }
        },
        {
            tags: {
                office: 'consulting'
            }
        },
        {
            tags: {
                office: 'architect'
            }
        },
        {
            tags: {
                office: 'estate_agent'
            }
        },
        {
            tags: {
                office: 'lawyer'
            }
        },
        {
            tags: {
                office: 'tax_advisor'
            }
        },
        {
            tags: {
                office: 'consultancy'
            }
        },
        {
            tags: {
                office: 'advertising_agency'
            }
        },
        {
            tags: {
                office: 'graphic_design'
            }
        },
        {
            tags: {
                office: 'employment_agency'
            }
        },
        {
            tags: {
                office: 'association'
            }
        },
        {
            tags: {
                office: 'urbanist'
            }
        },
        {
            tags: {
                office: 'charity'
            }
        },
        {
            tags: {
                office: 'bailiff'
            }
        },
        {
            tags: {
                office: 'security'
            }
        },
        {
            tags: {
                office: 'appraisal'
            }
        },
        {
            tags: {
                office: 'coworking'
            }
        },
        {
            tags: {
                office: 'coworking'
            }
        },
        {
            tags: {
                office: 'geodesist'
            }
        },
        {
            tags: {
                office: 'lanscaping'
            }
        },
        {
            tags: {
                office: 'life_coaching'
            }
        },
        {
            tags: {
                office: 'surveyor'
            }
        },
        {
            tags: {
                amenity: 'townhall'
            }
        },
        {
            tags: {
                information: 'office'
            }
        }
    ],
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
    tripDestinationsTripsMethods: ['area'],
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.1,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
