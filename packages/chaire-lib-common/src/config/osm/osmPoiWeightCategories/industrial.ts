/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Industrial including factories',
    osmQueryOr: [
        {
            tags: {
                man_made: 'works'
            }
        },
        {
            tags: {
                man_made: 'factory'
            }
        },
        {
            tags: {
                craft: 'metal_construction' // TODO, remove from industrial craft
            }
        },
        {
            tags: {
                craft: 'chemicals' // TODO, remove from industrial craft
            }
        },
        {
            tags: {
                amenity: 'post_depot'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'building:floor_area',
    floorArea: {
        average: 4300,
        min: 10,
        max: 40000
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: 0,
        max: 1000
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.026,
        min: 0.02,
        max: 0.04
    }
};

export default poiWeightCategory;
