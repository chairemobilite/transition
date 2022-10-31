/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const PRIVATE_ACCESS = 'private';
const CUSTOMERS_ACCESS = 'customers';
const NO_ACCESS = 'no';

/** This function contains custom filters for points of interest. This is where
 * should be added all the corner cases of tag interaction for a single point of
 * interest. */
export const isPoiToProcess = ({ tags }: { tags?: { [key: string]: string[] | undefined } }) => {
    if (tags === undefined) {
        return true;
    }
    if (tags.building?.includes('shelter')) {
        return !(
            tags.access?.includes(PRIVATE_ACCESS) ||
            tags.access?.includes(CUSTOMERS_ACCESS) ||
            tags.shelter_type?.includes('public_transport') ||
            tags.shelter_type?.includes('shopping_cart') ||
            tags.shelter_type?.includes('bicycle_parking')
        );
    }
    if (
        tags.leisure?.includes('swimming_pool') ||
        tags.leisure?.includes('playground') ||
        tags.leisure?.includes('pitch') ||
        tags.amenity?.includes('swimming_pool') ||
        tags.leisure?.includes('slipway') ||
        tags.leisure?.includes('track') ||
        tags.leisure?.includes('garden')
    ) {
        return !tags.access?.includes(PRIVATE_ACCESS);
    }
    return tags.access?.includes(NO_ACCESS) ? false : true;
};

export default {
    tags: [
        {
            craft: undefined
        },
        {
            office: undefined
        },
        {
            shop: undefined
        },
        {
            tourism: undefined
        },
        {
            healthcare: undefined
        },
        {
            amenity: undefined
        },
        {
            camping: 'reception'
        },
        {
            industrial: undefined
        },
        {
            emergency: 'ambulance_station'
        },
        {
            emergency: 'lifeguard_base'
        },
        {
            telecom: 'data_center'
        },
        {
            waterway: 'dock'
        },
        {
            waterway: 'boatyard'
        },
        {
            waterway: 'fuel'
        },
        {
            historic: undefined
        },
        {
            leisure: undefined
        },
        {
            man_made: undefined
        },
        {
            military: undefined
        },
        {
            power: 'plant'
        },
        {
            power: 'substation'
        },
        {
            public_transport: 'station'
        },
        {
            railway: 'station'
        },
        {
            railway: 'roundhouse'
        },
        {
            railway: 'wash'
        },
        {
            railway: 'vehicle_depot'
        },
        {
            landuse: 'cemetery'
        },
        {
            landuse: 'quarry'
        },
        {
            landuse: 'recreation_ground'
        },
        {
            landuse: 'winter_sports'
        },
        {
            landuse: 'landfill'
        },
        {
            landuse: 'depot'
        },
        {
            landuse: 'allotments'
        },
        {
            golf: 'clubhouse'
        }
    ]
};
