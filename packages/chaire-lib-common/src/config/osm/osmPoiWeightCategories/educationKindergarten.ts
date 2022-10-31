/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Kindergarten and nurseries',
    osmQueryOr: [
        {
            tags: {
                amenity: 'kindergarten'
            }
        }
    ],
    tripDestinationsTripsMethods: ['capacity'],
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
    capacityTag: 'capacity',
    tripDestinationsTripsPerCapacityPerWeekday: {
        average: 2.1, // most parents do two trips to kindergarten
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
