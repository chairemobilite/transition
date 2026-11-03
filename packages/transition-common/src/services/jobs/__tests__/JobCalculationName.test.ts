/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getJobCalculationName, toCalculationNameSlug } from '../JobCalculationName';

describe('getJobCalculationName', () => {
    test.each([
        {
            title: 'batch route with name',
            name: 'batchRoute',
            data: { parameters: { transitRoutingAttributes: { calculationName: ' Scenario A ' } } },
            expected: 'Scenario A'
        },
        {
            title: 'batch access map with name',
            name: 'batchAccessMap',
            data: { parameters: { batchAccessMapAttributes: { calculationName: 'Access map' } } },
            expected: 'Access map'
        },
        {
            title: 'batch route without name',
            name: 'batchRoute',
            data: { parameters: { transitRoutingAttributes: {} } },
            expected: undefined
        },
        {
            title: 'blank name',
            name: 'batchRoute',
            data: { parameters: { transitRoutingAttributes: { calculationName: '   ' } } },
            expected: undefined
        },
        {
            title: 'non-string name',
            name: 'batchRoute',
            data: { parameters: { transitRoutingAttributes: { calculationName: 3 } } },
            expected: undefined
        },
        {
            title: 'unsupported job type',
            name: 'otherJob',
            data: { parameters: { transitRoutingAttributes: { calculationName: 'name' } } },
            expected: undefined
        }
    ])('$title', ({ name, data, expected }) => {
        expect(getJobCalculationName({ name, data })).toEqual(expected);
    });
});

describe('toCalculationNameSlug', () => {
    test.each([
        { title: 'simple name', calculationName: 'Scenario A', expected: 'Scenario_A' },
        { title: 'invalid file characters', calculationName: 'a/b:c*d?e', expected: 'abcde' },
        { title: 'accents', calculationName: 'Réseau été', expected: 'Reseau_ete' },
        { title: 'truncated to 20 characters', calculationName: 'abcdefghijklmnopqrstuvwxyz', expected: 'abcdefghijklmnopqrst' },
        { title: 'no trailing separator after truncation', calculationName: 'abcdefghijklmnopqrs tuv', expected: 'abcdefghijklmnopqrs' },
        { title: 'only invalid characters', calculationName: '/:*?', expected: '' }
    ])('$title', ({ calculationName, expected }) => {
        expect(toCalculationNameSlug(calculationName)).toEqual(expected);
    });
});
