/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import DataSource from '../DataSource';

const dataSourceCompleteAttributes = {
    id: uuidV4(),
    name: 'Datasource1',
    data: {},
    shortname: 'DS1',
    description: 'description',
    type: 'odTrips',
    is_frozen: false
};

const dataSourceMinimalAttributes= {
    id: uuidV4()
};

test('should construct new scenarios', function() {

    const scenario1 = new DataSource(dataSourceCompleteAttributes, true);
    expect(scenario1.getAttributes()).toEqual(dataSourceCompleteAttributes);
    expect(scenario1.isNew()).toBe(true);

    const scenario2 = new DataSource(dataSourceMinimalAttributes, false);
    expect(scenario2.isNew()).toBe(false);

});

test('static methods should work', function() {
    expect(DataSource.getPluralName()).toBe('dataSources');
    expect(DataSource.getCapitalizedPluralName()).toBe('DataSources');
    expect(DataSource.getDisplayName()).toBe('DataSource');
    const scenario = new DataSource(dataSourceCompleteAttributes, true);
    expect(scenario.getPluralName()).toBe('dataSources');
    expect(scenario.getCapitalizedPluralName()).toBe('DataSources');
    expect(scenario.getDisplayName()).toBe('DataSource');
});
