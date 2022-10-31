/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { POIWeightCategory } from '../POIWeightCategoryType';

//TODO detail and separate into multiple weight categories for better precision from more samples

const poiWeightCategory: POIWeightCategory = {
    description: 'Shops with low number of clients',
    osmQueryOr: [
        {
            tags: {
                shop: 'medical_supply'
            }
        },
        {
            tags: {
                shop: 'art'
            }
        },
        {
            tags: {
                shop: 'craft'
            }
        },
        {
            tags: {
                shop: 'religion'
            }
        },
        {
            tags: {
                shop: 'bicycle_rental'
            }
        },
        {
            tags: {
                shop: 'boat_rental'
            }
        },
        {
            tags: {
                shop: 'car_rental'
            }
        },
        {
            tags: {
                amenity: 'car_rental'
            }
        },
        {
            tags: {
                amenity: 'helicopter_rental'
            }
        },
        {
            tags: {
                amenity: 'charity'
            }
        },
        {
            tags: {
                amenity: 'construction_equipment'
            }
        },
        {
            tags: {
                amenity: 'pyrotechnics'
            }
        },
        {
            tags: {
                shop: 'laboratory_equipment'
            }
        },
        {
            tags: {
                shop: 'vehicle_inspection'
            }
        },
        {
            tags: {
                shop: 'ferry_terminal'
            }
        },
        {
            tags: {
                shop: 'laundry'
            }
        },
        {
            tags: {
                shop: 'bicycle'
            }
        },
        {
            tags: {
                shop: 'copyshop'
            }
        },
        {
            tags: {
                shop: 'dry_cleaning'
            }
        },
        {
            tags: {
                shop: 'tattoo'
            }
        },
        {
            tags: {
                shop: 'pet_grooming'
            }
        },
        {
            tags: {
                shop: 'computer'
            }
        },
        {
            tags: {
                shop: 'pest_control'
            }
        },
        {
            tags: {
                shop: 'pawnbroker'
            }
        },
        {
            tags: {
                shop: 'bed'
            }
        },
        {
            tags: {
                shop: 'bathroom_furnishing'
            }
        },
        {
            tags: {
                shop: 'houseware'
            }
        },
        {
            tags: {
                shop: 'musical_instrument'
            }
        },
        {
            tags: {
                shop: 'appliance'
            }
        },
        {
            tags: {
                shop: 'jewelry'
            }
        },
        {
            tags: {
                shop: 'travel_agency'
            }
        },
        {
            tags: {
                shop: 'lamps'
            }
        },
        {
            tags: {
                shop: 'gas'
            }
        },
        {
            tags: {
                shop: 'pet'
            }
        },
        {
            tags: {
                shop: 'tyres'
            }
        },
        {
            tags: {
                shop: 'kitchen'
            }
        },
        {
            tags: {
                shop: 'fabric'
            }
        },
        {
            tags: {
                shop: 'frame'
            }
        },
        {
            tags: {
                shop: 'radiotechnics'
            }
        },
        {
            tags: {
                shop: 'vacuum_cleaner'
            }
        },
        {
            tags: {
                shop: 'swimming_pool'
            }
        },
        {
            tags: {
                shop: 'paint'
            }
        },
        {
            tags: {
                shop: 'rental'
            }
        },
        {
            tags: {
                shop: 'carpet'
            }
        },
        {
            tags: {
                shop: 'locksmith'
            }
        },
        {
            tags: {
                shop: 'mattress'
            }
        },
        {
            tags: {
                shop: 'tiles'
            }
        },
        {
            tags: {
                shop: 'money_lender'
            }
        },
        {
            tags: {
                shop: 'windows'
            }
        },
        {
            tags: {
                shop: 'lighting'
            }
        },
        {
            tags: {
                shop: 'electrical'
            }
        },
        {
            tags: {
                shop: 'erotic'
            }
        },
        {
            tags: {
                shop: 'psychic'
            }
        },
        {
            tags: {
                shop: 'doors'
            }
        },
        {
            tags: {
                shop: 'fireplace'
            }
        },
        {
            tags: {
                shop: 'cleaning_products'
            }
        },
        {
            tags: {
                shop: 'scuba_diving'
            }
        },
        {
            tags: {
                shop: 'tailor'
            }
        },
        {
            tags: {
                shop: 'boat'
            }
        },
        {
            tags: {
                shop: 'antiques'
            }
        },
        {
            tags: {
                shop: 'flooring'
            }
        },
        {
            tags: {
                shop: 'wheelchairs'
            }
        },
        {
            tags: {
                shop: 'perfumery'
            }
        },
        {
            tags: {
                shop: 'lawn_mower'
            }
        },
        {
            tags: {
                shop: 'farm_equipment'
            }
        },
        {
            tags: {
                shop: 'caravan'
            }
        },
        {
            tags: {
                shop: 'trade'
            }
        },
        {
            tags: {
                shop: 'country_store'
            }
        },
        {
            tags: {
                shop: 'hairdresser_supply'
            }
        },
        {
            tags: {
                shop: 'massage_equipment'
            }
        },
        {
            tags: {
                shop: 'distribution'
            }
        },
        {
            tags: {
                shop: 'fire_safety'
            }
        },
        {
            tags: {
                shop: 'cleaning'
            }
        },
        {
            tags: {
                shop: 'curtain'
            }
        },
        {
            tags: {
                shop: 'tool_hire'
            }
        },
        {
            tags: {
                shop: 'groundskeeping' // shop selling a variety of tools for the maintenance of turf, shrubbery and trees
            }
        },
        {
            tags: {
                shop: 'piers'
            }
        },
        {
            tags: {
                shop: 'fishing'
            }
        },
        {
            tags: {
                shop: 'sewing'
            }
        },
        {
            tags: {
                shop: 'small_engine'
            }
        },
        {
            tags: {
                shop: 'window_blind'
            }
        },
        {
            tags: {
                shop: 'heating_equipment'
            }
        },
        {
            tags: {
                shop: 'industrial_equipment'
            }
        },
        {
            tags: {
                shop: 'optician'
            }
        },
        {
            tags: {
                shop: 'model'
            }
        },
        {
            tags: {
                shop: 'military_surplus'
            }
        },
        {
            tags: {
                shop: 'trophy'
            }
        },
        {
            tags: {
                shop: 'trophee'
            }
        },
        {
            tags: {
                shop: 'trophees'
            }
        },
        {
            tags: {
                shop: 'lifts'
            }
        },
        {
            tags: {
                shop: 'agrarian'
            }
        },
        {
            tags: {
                shop: 'barbecue'
            }
        },
        {
            tags: {
                shop: 'printer_ink'
            }
        },
        {
            tags: {
                shop: 'e-cigarette'
            }
        },
        {
            tags: {
                shop: 'garden_furniture'
            }
        },
        {
            tags: {
                shop: 'furniture'
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
        average: 0.1, // TODO get a better estimate
        min: undefined,
        max: undefined
    }
};

export default poiWeightCategory;
