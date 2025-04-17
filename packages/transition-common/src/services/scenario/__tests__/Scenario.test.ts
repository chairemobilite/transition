/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import Scenario from '../Scenario';

const scenarioAttributes1 = {
    id: uuidV4(),
    name: 'Scenario1',
    data: {},
    services: [],
    only_agencies: [],
    except_agencies: [],
    only_lines: [],
    except_lines: [],
    only_nodes: [],
    except_nodes: [],
    only_modes: [],
    except_modes: [],
    is_frozen: false
};

const scenarioAttributes2= {
    id: uuidV4(),
    name: 'Scenario2',
    services: [uuidV4(), uuidV4()],
    only_agencies: [uuidV4()],
    except_agencies: [],
    only_lines: [uuidV4(), uuidV4()],
    except_lines: [],
    only_nodes: [uuidV4()],
    except_nodes: [],
    only_modes: [uuidV4(), uuidV4(), uuidV4()],
    except_modes: [],
    description: 'descS2',
    color: '#ff0000',
    data: {
        foo: 'bar',
    },
    is_frozen: true
};

const scenarioAttributes3= {
    id: uuidV4(),
    name: 'Scenario3',
    services: [uuidV4()],
    only_agencies: [],
    except_agencies: [uuidV4(), uuidV4()],
    only_lines: [],
    except_lines: [uuidV4()],
    only_nodes: [],
    except_nodes: [uuidV4(), uuidV4()],
    only_modes: [],
    except_modes: [uuidV4(), uuidV4(), uuidV4()],
    description: 'descS3',
    data: {
        foo: 'bar2',
    },
    is_frozen: false
};

test('should construct new scenarios', function() {

    const scenario1 = new Scenario(scenarioAttributes1, true);
    expect(scenario1.attributes).toEqual(scenarioAttributes1);
    expect(scenario1.isNew()).toBe(true);

    const scenario2 = new Scenario(scenarioAttributes2, false);
    expect(scenario2.isNew()).toBe(false);

});

test('should validate', function() {
    const scenario1 = new Scenario(scenarioAttributes1, true);
    expect(scenario1.validate()).toBe(false); // missing services
    const scenario2 = new Scenario(scenarioAttributes2, true);
    expect(scenario2.validate()).toBe(true);
    scenario2.set('name', undefined);
    expect(scenario2.validate()).toBe(false);
    scenario2.set('name', 'test');
    expect(scenario2.validate()).toBe(true);
});

test('should convert to string', function() {
    const scenario1a = new Scenario(scenarioAttributes1, true);
    expect(scenario1a.toString()).toBe(scenarioAttributes1.name);
    scenario1a.set('name', undefined);
    expect(scenario1a.toString()).toBe(scenarioAttributes1.id);
    const scenario1b = new Scenario(scenarioAttributes1, true);
    expect(scenario1b.toString(true)).toBe(`Scenario1 ${scenarioAttributes1.id}`);
    scenario1b.set('name', undefined);
    expect(scenario1b.toString(true)).toBe(scenarioAttributes1.id);
});

test('should save and delete in memory', function() {
    const scenario = new Scenario(scenarioAttributes1, true);
    expect(scenario.isNew()).toBe(true);
    expect(scenario.isDeleted()).toBe(false);
    scenario.saveInMemory();
    expect(scenario.isNew()).toBe(false);
    scenario.deleteInMemory();
    expect(scenario.isDeleted()).toBe(true);
});

test('static methods should work', function() {
    expect(Scenario.getPluralName()).toBe('scenarios');
    expect(Scenario.getCapitalizedPluralName()).toBe('Scenarios');
    expect(Scenario.getDisplayName()).toBe('Scenario');
    const scenario = new Scenario(scenarioAttributes1, true);
    expect(scenario.getPluralName()).toBe('scenarios');
    expect(scenario.getCapitalizedPluralName()).toBe('Scenarios');
    expect(scenario.getDisplayName()).toBe('Scenario');
});
