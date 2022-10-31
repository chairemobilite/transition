/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TestUtils from 'chaire-lib-common/lib/test/TestUtils';

import { BaseOdTrip } from '../BaseOdTrip';

describe('Attribute preparation', () => {
    test ('All attribs', () => {
        const attribs = {
            origin_geography: TestUtils.makePoint([-73, 45]).geometry,
            destination_geography: TestUtils.makePoint([-73.5, 45.5]).geometry,
            timeOfTrip: 28800,
            timeType: 'departure' as const
        }
        const odTrip = new BaseOdTrip(attribs);
        expect(odTrip.attributes).toEqual({ 
            ...attribs,
            id: expect.anything(),
            geography: { 
                type: 'MultiPoint',
                coordinates: [attribs.origin_geography.coordinates, attribs.destination_geography.coordinates]
            },
            data: {},
            is_frozen: false
        });
    });

    test ('Default attributes', () => {
        const attribs = {
            origin_geography: TestUtils.makePoint([-73, 45]).geometry,
            destination_geography: TestUtils.makePoint([-73.5, 45.5]).geometry
        }
        const odTrip = new BaseOdTrip(attribs);
        expect(odTrip.attributes).toEqual({ 
            ...attribs,
            timeOfTrip: 0,
            timeType: 'departure',
            id: expect.anything(),
            geography: { 
                type: 'MultiPoint',
                coordinates: [attribs.origin_geography.coordinates, attribs.destination_geography.coordinates]
            },
            data: {},
            is_frozen: false
        });
    });
})