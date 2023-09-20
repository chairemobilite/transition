/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';

import {
    base as baseAttributes,
    transit as transitAttributes,
    steps as stepAttributes
} from '../../../config/trRoutingAttributes';
import { getDefaultCsvAttributes, getDefaultStepsAttributes } from '../ResultAttributes';

describe('getDefaultCsvAttributes', () => {
    test('No modes', () => {
        const csvAttributes = getDefaultCsvAttributes([]);
        expect(csvAttributes).toEqual(baseAttributes);

        // Make sure the received attributes are modifiable and unique, by modifying the object and making sure a new object is identical to the original
        const originalAttributes = _cloneDeep(csvAttributes);
        csvAttributes.uuid = 'blabla';
        const csvAttributes2 = getDefaultCsvAttributes([]);
        expect(csvAttributes2.uuid).not.toEqual(csvAttributes.uuid);
        expect(csvAttributes2).toEqual(originalAttributes);
    });

    test('Single non-transit mode', () => {
        const modes = ['walking' as const];
        const csvAttributes = getDefaultCsvAttributes(modes);
        expect(csvAttributes).toEqual(expect.objectContaining(baseAttributes));
        expect(Object.keys(csvAttributes).length).toEqual(Object.keys(baseAttributes).length + 2);
        expect(csvAttributes[`only${modes[0].charAt(0).toUpperCase() + modes[0].slice(1)}TravelTimeSeconds`]).toBeNull();
        expect(csvAttributes[`only${modes[0].charAt(0).toUpperCase() + modes[0].slice(1)}DistanceMeters`]).toBeNull();

    });

    test('Multiple non-transit modes', () => {
        const modes = ['walking' as const, 'cycling' as const];
        const csvAttributes = getDefaultCsvAttributes(modes);
        expect(csvAttributes).toEqual(expect.objectContaining(baseAttributes));
        expect(Object.keys(csvAttributes).length).toEqual(Object.keys(baseAttributes).length + 4);
        expect(csvAttributes[`only${modes[0].charAt(0).toUpperCase() + modes[0].slice(1)}TravelTimeSeconds`]).toBeNull();
        expect(csvAttributes[`only${modes[0].charAt(0).toUpperCase() + modes[0].slice(1)}DistanceMeters`]).toBeNull();
        expect(csvAttributes[`only${modes[1].charAt(0).toUpperCase() + modes[1].slice(1)}TravelTimeSeconds`]).toBeNull();
        expect(csvAttributes[`only${modes[1].charAt(0).toUpperCase() + modes[1].slice(1)}DistanceMeters`]).toBeNull();

    });

    test('Only transit mode', () => {
        const modes = ['transit' as const];
        const csvAttributes = getDefaultCsvAttributes(modes);
        expect(csvAttributes).toEqual(expect.objectContaining(baseAttributes));
        expect(csvAttributes).toEqual(expect.objectContaining(transitAttributes));
        expect(Object.keys(csvAttributes).length).toEqual(Object.keys(baseAttributes).length + Object.keys(transitAttributes).length);
    });

    test('Transit and other mode', () => {
        const modes = ['walking' as const, 'cycling' as const, 'transit' as const];
        const csvAttributes = getDefaultCsvAttributes(modes);
        expect(csvAttributes).toEqual(expect.objectContaining(baseAttributes));
        expect(csvAttributes).toEqual(expect.objectContaining(transitAttributes));
        expect(Object.keys(csvAttributes).length).toEqual(Object.keys(baseAttributes).length + Object.keys(transitAttributes).length + 4);
        expect(csvAttributes[`only${modes[0].charAt(0).toUpperCase() + modes[0].slice(1)}TravelTimeSeconds`]).toBeNull();
        expect(csvAttributes[`only${modes[0].charAt(0).toUpperCase() + modes[0].slice(1)}DistanceMeters`]).toBeNull();
        expect(csvAttributes[`only${modes[1].charAt(0).toUpperCase() + modes[1].slice(1)}TravelTimeSeconds`]).toBeNull();
        expect(csvAttributes[`only${modes[1].charAt(0).toUpperCase() + modes[1].slice(1)}DistanceMeters`]).toBeNull();

    });
});

describe('getDefaultStepsAttributes', () => {
    test('Default', () => {
        const csvAttributes = getDefaultStepsAttributes();
        expect(csvAttributes).toEqual(stepAttributes);

        // Make sure the received attributes are modifiable and unique, by modifying the object and making sure a new object is identical to the original
        const originalAttributes = _cloneDeep(csvAttributes);
        csvAttributes.uuid = 'blabla';
        const csvAttributes2 = getDefaultStepsAttributes();
        expect(csvAttributes2.uuid).not.toEqual(csvAttributes.uuid);
        expect(csvAttributes2).toEqual(originalAttributes);
    });

});
