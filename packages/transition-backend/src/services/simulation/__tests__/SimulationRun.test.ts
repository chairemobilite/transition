/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import SimulationRun from '../SimulationRun';
import { SimulationRunDataAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import Simulation, { SimulationAttributes } from 'transition-common/lib/services/simulation/Simulation';
import { SimulationAlgorithmDescriptorStub } from './SimulationAlgorithmDescriptorStub';

// Mock the algorithm registry
jest.mock('transition-common/lib/services/simulation/algorithm', () => ({
    getAlgorithmDescriptor: jest.fn((algorithmType: string) => {
        if (algorithmType === 'mockAlgorithm') {
            return new SimulationAlgorithmDescriptorStub();
        }
        return undefined;
    }),
    getAllAlgorithmTypes: jest.fn(() => ['mockAlgorithm'])
}));

const simulationAttributes: SimulationAttributes = {
    id: uuidV4(),
    name: 'Simulation1',
    shortname: 'Sim1',
    description: 'This is a description',
    color: '#ff00ff',
    data: {
        routingAttributes: {
            maxTotalTravelTimeSeconds: 1000
        },
        simulationParameters: {
            maxTimeBetweenPassages: 15,
            nbOfVehicles: 9,
            simulatedAgencies: ['arbitrary']
        },
        algorithmConfiguration: {
            type: 'test',
            config: {
                numericOption: 3,
                stringOption: 'foo',
                booleanOption: false
            }
        } as any
    },
    isEnabled: true
};
const simulation = new Simulation(simulationAttributes, false);

const simulationRuntimAttributes = {
    numberOfThreads: 1,
    fitnessSorter: 'maximize',
    functions: {},
    trRoutingStartingPort: 14000
}

const simulationRunAttributes = {
    seed: '235132',
    data: simulationAttributes.data as SimulationRunDataAttributes,
    status: 'pending' as const,
    simulation_id: simulation.getId(),
    results: {},
    options: simulationRuntimAttributes
}

test('Test create from simulation', function() {

    const simulationRun = SimulationRun.createFromSimulation(simulation, simulationRuntimAttributes, _cloneDeep(simulation.attributes.data));
    expect(simulationRun).toBeDefined();
    expect((simulationRun as SimulationRun).attributes.status).toEqual('notStarted');
    expect((simulationRun as SimulationRun).attributes.data).toEqual(simulationAttributes.data);
    expect((simulationRun as SimulationRun).attributes.options).toEqual(simulationRuntimAttributes);

});

test('Test create from simulation, incomplete', function() {

    const incompleteAttributes = _cloneDeep(simulationAttributes);
    delete incompleteAttributes.data.algorithmConfiguration;
    const incompleteSim = new Simulation(incompleteAttributes, true);
    const simulationRun = SimulationRun.createFromSimulation(incompleteSim, simulationRuntimAttributes, _cloneDeep(incompleteSim.attributes.data));
    expect(simulationRun).toBeUndefined();

});

test('static methods should work', function() {
    expect(SimulationRun.getPluralName()).toBe('simulationRuns');
    expect(SimulationRun.getCapitalizedPluralName()).toBe('SimulationRuns');
    expect(SimulationRun.getDisplayName()).toBe('SimulationRun');
    const simulationRun: SimulationRun = new SimulationRun(simulationRunAttributes, false);
    expect(simulationRun.getPluralName()).toBe('simulationRuns');
    expect(simulationRun.getCapitalizedPluralName()).toBe('SimulationRuns');
    expect(simulationRun.getDisplayName()).toBe('SimulationRun');
});
