/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export const queryResidentialZones = {
    tags: {
        landuse: 'residential'
    }
};

export const queryZonesWithResidences = [
    {
        tags: {
            landuse: [
                'commercial', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'retail', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'industrial', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'religious', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'churchyard', // deprecated in osm ! a building with "building:flats" or "flats" tag must be defined for this area
                'farmyard', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'military' // ! a building with "building:flats" or "flats" tag must be defined for this area
            ]
        }
    },
    {
        tags: {
            amenity: [
                'school', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'college', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'university', // ! a building with "building:flats" or "flats" tag must be defined for this area
                'kindergarten' // ! a building with "building:flats" or "flats" tag must be defined for this area
            ]
        }
    }
];
