/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Industrial quarry',
    osmQueryOr: [
        {
            tags: {
                landuse: 'quarry'
            }
        }
    ],
    tripDestinationsTripsMethods: ['area'],
    areaTag: 'polygon:area',
    floorArea: {
        average: undefined,
        min: undefined,
        max: undefined
    },
    ITELandUseCodes: [], // TODO
    activities: [], // TODO
    tripDestinationsPerWeekday: {
        min: undefined,
        max: undefined
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0, // TODO estimate a trip generation method/estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
