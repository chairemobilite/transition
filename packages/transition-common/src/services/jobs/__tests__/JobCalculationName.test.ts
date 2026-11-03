/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getJobCalculationName } from '../JobCalculationName';

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
