/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export const queryResidentialBuildings = {
    tags: {
        building: [
            'residential',
            'detached',
            'house',
            'semidetached_house',
            'terrace',
            'apartments',
            'bungalow',
            'cabin',
            'dormitory',
            'ger',
            'houseboat',
            'static_caravan',
            'farm'
        ]
    }
};

export const defaultNumberOfFlats = {
    // null means we need building:flats (trigger an error if empty), no default value
    residential: null,
    detached: 1,
    house: 1,
    semidetached_house: null,
    terrace: null,
    apartments: null,
    bungalow: 1,
    cabin: 1,
    dormitory: null,
    ger: 1,
    houseboat: 1,
    static_caravan: 1,
    farm: 1
};
