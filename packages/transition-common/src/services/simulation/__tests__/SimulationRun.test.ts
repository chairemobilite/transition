/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import { EventEmitter } from 'events';
import _cloneDeep from 'lodash/cloneDeep';

import SimulationRun, { SimulationRunDataAttributes } from '../SimulationRun';
import { SimulationAlgorithmDescriptorStub } from './TransitNetworkDesignAlgorithmStub';
import Simulation, { SimulationAttributes } from '../Simulation';

// Mock the algorithm registry
jest.mock('../../networkDesign/transit/algorithm', () => ({
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
        transitNetworkDesignParameters: {
            maxTimeBetweenPassages: 15,
            minTimeBetweenPassages: 5,
            nbOfVehicles: 9,
            numberOfLinesMin: 1,
            numberOfLinesMax: 10,
            simulatedAgencies: ['arbitrary'],
            nonSimulatedServices: [],
            linesToKeep: []
        },
        algorithmConfiguration: {
            // Using 'mockAlgorithm' as mock algorithm type, cast to any for test to compile
            type: 'mockAlgorithm',
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

const simulationRunAttributes = {
    seed: '235132',
    data: simulationAttributes.data as SimulationRunDataAttributes,
    status: 'pending' as const,
    simulation_id: simulation.getId(),
    results: {},
    options: {
        numberOfThreads: 1,
        fitnessSorter: 'maximize',
        functions: {},
        trRoutingStartingPort: 14000
    }
};

test('static methods should work', () => {
    expect(SimulationRun.getPluralName()).toBe('simulationRuns');
    expect(SimulationRun.getCapitalizedPluralName()).toBe('SimulationRuns');
    expect(SimulationRun.getDisplayName()).toBe('SimulationRun');
    const simulationRun: SimulationRun = new SimulationRun(simulationRunAttributes, false);
    expect(simulationRun.getPluralName()).toBe('simulationRuns');
    expect(simulationRun.getCapitalizedPluralName()).toBe('SimulationRuns');
    expect(simulationRun.getDisplayName()).toBe('SimulationRun');
});

test('toString should return the correct string', () => {
    const simulationRun: SimulationRun = new SimulationRun(simulationRunAttributes, false);
    expect(simulationRun.toString(true)).toEqual('sim_' + simulationRunAttributes.simulation_id + '_run_' + simulationRun.getId());
    expect(simulationRun.toString(false)).toEqual('run_' + simulationRun.getId());
    expect(simulationRun.toString()).toEqual('run_' + simulationRun.getId());
});

describe('Delete simulation run', () => {
    const socketStub = new EventEmitter();

    test('Default cascade value', async () => {

        const simulationRun: SimulationRun = new SimulationRun(simulationRunAttributes, false);

        socketStub.once('simulationRun.delete',  async (id: string, cascade: boolean, callback) => {
            expect(id).toEqual(simulationRun.id);
            expect(cascade).toEqual(false);
            callback({ id });
        });

        await simulationRun.delete(socketStub);
        expect(simulationRun.isDeleted()).toEqual(true);
    });

    test('With cascade value true', async () => {

        const simulationRun: SimulationRun = new SimulationRun(simulationRunAttributes, false);

        socketStub.once('simulationRun.delete',  async (id: string, cascade: boolean, callback) => {
            expect(id).toEqual(simulationRun.id);
            expect(cascade).toEqual(true);
            callback({ id });
        });

        await simulationRun.delete(socketStub, true);
        expect(simulationRun.isDeleted()).toEqual(true);
    });

    test('With cascade value false', async () => {

        const simulationRun: SimulationRun = new SimulationRun(simulationRunAttributes, false);

        socketStub.once('simulationRun.delete',  async (id: string, cascade: boolean, callback) => {
            expect(id).toEqual(simulationRun.id);
            expect(cascade).toEqual(false);
            callback({ id });
        });

        await simulationRun.delete(socketStub, false);
        expect(simulationRun.isDeleted()).toEqual(true);
    });
});
