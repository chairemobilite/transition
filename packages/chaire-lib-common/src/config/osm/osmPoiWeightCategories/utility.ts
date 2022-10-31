/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Utility',
    osmQueryOr: [
        {
            tags: {
                building: 'service'
            }
        },
        {
            tags: {
                building: 'garages'
            }
        },
        {
            tags: {
                building: 'transformer_tower'
            }
        },
        {
            tags: {
                building: 'water_tower'
            }
        },
        {
            tags: {
                building: 'bunker'
            }
        },
        {
            tags: {
                man_made: 'lighthouse'
            }
        },
        {
            tags: {
                man_made: 'pumping_station'
            }
        },
        {
            tags: {
                man_made: 'watermill'
            }
        },
        {
            tags: {
                man_made: 'wastewater_plant'
            }
        },
        {
            tags: {
                man_made: 'water_works'
            }
        },
        {
            tags: {
                man_made: 'windmill'
            }
        },
        {
            tags: {
                man_made: 'monitoring_station'
            }
        },
        {
            tags: {
                man_made: 'communications_tower'
            }
        },
        {
            tags: {
                man_made: 'petroleum_well'
            }
        },
        {
            tags: {
                power: 'plant'
            }
        },
        {
            tags: {
                power: 'substation'
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
        min: 0,
        max: 100
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.01, // TODO: separate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
