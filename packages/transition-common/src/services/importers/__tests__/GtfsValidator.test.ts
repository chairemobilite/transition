/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GtfsValidator from '../GtfsValidator';

test('Test initialization', () => {
    const gtfsValidator = new GtfsValidator({});

    const attributes = gtfsValidator.getAttributes();
    expect(attributes.isPrepared).toBe(false);
    expect(attributes.isUploaded).toBe(false);
    expect(attributes.periodsGroupShortname).toBeUndefined();
});

test('Test validate', () => {
    const gtfsValidator = new GtfsValidator({});

    expect(gtfsValidator.validate()).toBe(false);
    expect(gtfsValidator.getErrors()).toEqual(['main:errors:ZipFileIsRequired']);
});

test('Test validate periodGroup', () => {
    const gtfsValidator = new GtfsValidator({});

    expect(gtfsValidator.validatePeriodsGroup()).toBe(false);
    expect(gtfsValidator.getErrors()).toEqual(['main:errors:ZipFileIsRequired', 'transit:gtfs:errors:PeriodsGroupIsRequired']);
});