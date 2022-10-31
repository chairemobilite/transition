/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples
// TODO: deal with silos without floor area (default area or single value?)

const poiWeightCategory: POIWeightCategory = {
    description: 'Farms',
    osmQueryOr: [
        {
            tags: {
                building: 'farm_auxiliary'
            }
        },
        {
            tags: {
                building: 'barn'
            }
        },
        {
            tags: {
                building: 'greenhouse'
            }
        },
        {
            tags: {
                building: 'stable'
            }
        },
        {
            tags: {
                building: 'cowshed'
            }
        },
        {
            tags: {
                building: 'sty'
            }
        },
        {
            tags: {
                building: 'sheepfold'
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
        max: 75
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.007,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
