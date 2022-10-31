/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Light industrial and crafts (construction companies and alike with limited number of clients)',
    osmQueryOr: [
        {
            tags: {
                craft: undefined // TODO, add not metal_construction adn not chemicals, which belongs to industrial
            }
        },
        {
            tags: {
                office: 'construction'
            }
        },
        {
            tags: {
                office: 'construction_company'
            }
        },
        {
            tags: {
                amenity: 'animal_training'
            }
        },
        {
            tags: {
                amenity: 'animal_shelter'
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
        max: 200
    },
    tripDestinationsTripsPerSqMetersPerWeekday: {
        average: 0.1,
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
