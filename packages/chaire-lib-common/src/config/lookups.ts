/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// still not sure if we should put semi-colons after non-default exports:
// standard transit schedules are usually based on the 4:00 -> 28:00 period

export const hours = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28
];

export const householdCategories = [
    'none', // !!! none means no value !!!
    'singlePerson',
    'couple',
    'monoparentalFamily',
    'biparentalFamily',
    'other',
    'unknown'
];
export type HouseholdCategories =
    | 'none'
    | 'singlePerson'
    | 'couple'
    | 'monoparentalFamily'
    | 'biparentalFamily'
    | 'other'
    | 'unknown';

export const householdIncomeLevelGroups = [
    'none', // !!! none means no value, not no income !!!
    'veryLow',
    'low',
    'medium',
    'high',
    'veryHigh',
    'unknown'
];
export type HouseholdIncomeLevelGroups = 'none' | 'veryLow' | 'low' | 'medium' | 'high' | 'veryHigh' | 'unknown';

export const drivingLicenseOwnerships = [
    'none', // !!! none means no value, not no license !!!
    'yes',
    'no',
    'unknown'
];
export type DrivingLicenseOwnerships = 'none' | 'yes' | 'no' | 'unknown';

export const ageGroups = [
    'none', // !!! none means no value !!!
    'ag0004',
    'ag0509',
    'ag1014',
    'ag1519',
    'ag2024',
    'ag2529',
    'ag3034',
    'ag3539',
    'ag4044',
    'ag4549',
    'ag5054',
    'ag5559',
    'ag6064',
    'ag6569',
    'ag7074',
    'ag7579',
    'ag8084',
    'ag8589',
    'ag9094',
    'ag95plus',
    'unknown'
];

export type AgeGroups =
    | 'none'
    | 'ag0004'
    | 'ag0509'
    | 'ag1014'
    | 'ag1519'
    | 'ag2024'
    | 'ag2529'
    | 'ag3034'
    | 'ag3539'
    | 'ag4044'
    | 'ag4549'
    | 'ag5054'
    | 'ag5559'
    | 'ag6064'
    | 'ag6569'
    | 'ag7074'
    | 'ag7579'
    | 'ag8084'
    | 'ag8589'
    | 'ag9094'
    | 'ag95plus'
    | 'unknown';

export const ageRangesByAgeGroup = {
    none: null,
    ag0004: [0, 4],
    ag0509: [5, 9],
    ag1014: [10, 14],
    ag1519: [15, 19],
    ag2024: [20, 24],
    ag2529: [25, 29],
    ag3034: [30, 34],
    ag3539: [35, 39],
    ag4044: [40, 44],
    ag4549: [45, 49],
    ag5054: [50, 54],
    ag5559: [55, 59],
    ag6064: [60, 64],
    ag6569: [65, 69],
    ag7074: [70, 74],
    ag7579: [75, 79],
    ag8084: [80, 84],
    ag8589: [85, 89],
    ag9094: [90, 94],
    ag95plus: [95, 99], // not sure what to do with older than 99...
    unknown: null
};

export const genders = [
    'none', // !!! none means no value !!!
    'female',
    'male',
    'custom',
    'unknown'
];

export type Genders = 'none' | 'female' | 'male' | 'custom' | 'unknown';

export const activityCategories = [
    'none', // !!! none means no value, not no activity category !!!
    'home',
    'workSchoolUsual',
    'dropFetchSomeone',
    'other',
    'unknown'
];

export type ActivityCategories = 'none' | 'home' | 'workSchoolUsual' | 'dropFetchSomeone' | 'other' | 'unknown';

export const activities = [
    'none', // !!! none means no value, not no activity !!!
    'home',
    'workUsual',
    'workNonUsual',
    'schoolUsual',
    'schoolNonUsual',
    'shopping',
    'leisure',
    'service',
    'secondaryHome',
    'visitingFriends',
    'dropSomeone',
    'fetchSomeone',
    'restaurant',
    'medical',
    'worship',
    'onTheRoad',
    'other',
    'unknown'
];

export type Activities =
    | 'none'
    | 'home'
    | 'workUsual'
    | 'workNonUsual'
    | 'schoolUsual'
    | 'schoolNonUsual'
    | 'shopping'
    | 'leisure'
    | 'service'
    | 'secondaryHome'
    | 'visitingFriends'
    | 'dropSomeone'
    | 'fetchSomeone'
    | 'restaurant'
    | 'medical'
    | 'worship'
    | 'onTheRoad'
    | 'other'
    | 'unknown';

export const occupations = [
    'none', // !!! none means no value, not no occupation (use atHome instead) !!!
    'fullTimeWorker',
    'partTimeWorker',
    'fullTimeStudent',
    'partTimeStudent',
    'workerAndStudent',
    'retired',
    'atHome',
    'other',
    'nonApplicable',
    'unknown'
];
export type Occupations =
    | 'none'
    | 'fullTimeWorker'
    | 'partTimeWorker'
    | 'fullTimeStudent'
    | 'partTimeStudent'
    | 'workerAndStudent'
    | 'retired'
    | 'atHome'
    | 'other'
    | 'nonApplicable'
    | 'unknown';

export const modes = [
    'none', // !!! none means no value, not no mode !!!
    'walking',
    'cycling',
    'carDriver',
    'carPassenger',
    'motorcycle',
    'transit',
    'paratransit',
    'taxi',
    'schoolBus',
    'otherBus',
    'intercityBus',
    'intercityTrain',
    'plane',
    'ferry',
    'parkAndRide',
    'kissAndRide',
    'bikeAndRide',
    'multimodalOther',
    'other',
    'unknown'
];

export type Modes =
    | 'none'
    | 'walking'
    | 'cycling'
    | 'carDriver'
    | 'carPassenger'
    | 'motorcycle'
    | 'transit'
    | 'paratransit'
    | 'taxi'
    | 'schoolBus'
    | 'otherBus'
    | 'intercityBus'
    | 'intercityTrain'
    | 'plane'
    | 'ferry'
    | 'parkAndRide'
    | 'kissAndRide'
    | 'bikeAndRide'
    | 'multimodalOther'
    | 'other'
    | 'unknown';

export const proximities = ['local', 'near', 'mediumNear', 'medium', 'mediumFar', 'far', 'veryFar'];
export type Proximities = 'local' | 'near' | 'mediumNear' | 'medium' | 'mediumFar' | 'far' | 'veryFar';

export const proximityRelativeAreas = {
    // approximative, based on freeflow driving travel times
    local: 3, // 0 - 3 min.
    near: 15, // 3 - 10 min.
    mediumNear: 8, // 10 - 15 min.
    medium: 8, // 15 - 20 min.
    mediumFar: 30, // 20 - 30 min.
    far: 70, // 30 - 45 min.
    veryFar: 100 // 45 - 65 min.
};
