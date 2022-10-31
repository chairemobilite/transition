/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * These tags associated with an area needs an associated main building
 * inside with a valid main entrance:
 * Most of the time, the building tag of the main building inside must
 * match the amenity tag, but in the future, we may add specific building
 * tags that do not match the area tag
 */

export default {
    amenity: {
        kindergarten: {
            buildingQuery: {
                building: 'kindergarten'
            }
        },
        school: {
            buildingQuery: {
                building: 'school'
            }
        },
        college: {
            buildingQuery: {
                building: 'college'
            }
        },
        university: {
            buildingQuery: {
                building: 'university'
            }
        },
        hospital: {
            buildingQueryOr: [
                {
                    building: 'hospital'
                },
                {
                    building: undefined,
                    healthcare: 'hospital'
                }
            ]
        }
    }
};
