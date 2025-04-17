/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import Simulation, { SimulationAttributes } from '../Simulation';
import { SimulationAlgorithmDescriptorStub } from './SimulationAlgorithmStub';

const simulationAttributes1: SimulationAttributes = {
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
        }
    },
    isEnabled: true
};

const simulationAttributes2= {
    id: uuidV4(),
    name: 'Simulation2',
    description: 'descS2',
    color: '#ff0000',
    is_frozen: true
};

const simulationAttributes3= {
    id: uuidV4(),
    name: 'Simulation2',
    shortname: 'ééÈÀëËêÊùÙÇçàÀâÂ~..//|rteroiu45687 sdflsdkj 5637549 <>\\///+=/[](){}&?%$#@!***',
    description: 'descS2',
    color: '#ff0000',
    is_frozen: true
};

const stubAlgorithm = new SimulationAlgorithmDescriptorStub();

test('should construct new simulations', function() {

    const simulation1 = new Simulation(simulationAttributes1, true);
    expect(simulation1.attributes).toEqual({
        ...simulationAttributes1,
        isEnabled: true,
        is_frozen: false
    });
    expect(simulation1.isNew()).toBe(true);

    const simulation2 = new Simulation(simulationAttributes2, false);
    expect(simulation2.isNew()).toBe(false);
    expect(simulation2.attributes.isEnabled).toBe(true);
    expect(simulation2.attributes.data.routingAttributes).toBeDefined();
    expect(simulation2.attributes.data.simulationParameters).toBeDefined();
});

test('should validate', function() {
    const simulation1 = new Simulation(simulationAttributes1, true);
    expect(simulation1.validate()).toBe(true); // missing services
    simulation1.attributes.data.routingAttributes.maxAccessEgressTravelTimeSeconds = 60*60 // Too high, should not validate
    expect(simulation1.validate()).toBe(false);
    const simulation2 = new Simulation(simulationAttributes2, true);
    // No agencies to simulate, the parameters should be initialized, so we can set it and it validates
    expect(simulation2.validate()).toBe(false);
    simulation2.attributes.data.simulationParameters.simulatedAgencies = ['arbitrary'];
    expect(simulation2.validate()).toBe(true);
    simulation2.attributes.name = undefined;
    expect(simulation2.validate()).toBe(false);
    simulation2.attributes.name = 'test';
    expect(simulation2.validate()).toBe(true);
    simulation2.attributes.data.simulationParameters.nbOfVehicles = -3; // Negative, should not validate
    expect(simulation2.validate()).toBe(false);
});

test('should convert to string', function() {
    const simulation1 = new Simulation(simulationAttributes1, true);
    const simulation2 = new Simulation(simulationAttributes2, true);
    const simulation3 = new Simulation(simulationAttributes3, false);
    // Both shortname and long name
    expect(simulation1.toString()).toEqual(`${simulationAttributes1.name} [${simulationAttributes1.shortname}]`);
    simulation1.set('name', undefined);
    // Only shortname
    expect(simulation1.toString()).toEqual(simulationAttributes1.shortname);

    // Only name
    expect(simulation2.toString()).toEqual(simulationAttributes2.name);
    // Nothing, either id or undefined
    simulation2.set('name', undefined);
    expect(simulation2.toString()).toEqual(simulationAttributes2.id);
    expect(simulation2.toString(false)).not.toBeDefined();
    expect(simulation1.toStringSlugify(false)).toEqual(simulationAttributes1.shortname);
    expect(simulation1.toStringSlugify(true)).toEqual(simulationAttributes1.shortname + '_' + simulationAttributes1.id);
    expect(simulation3.toStringSlugify(false)).toEqual('eeEAeEeEuUCcaAaAorrteroiu45687_sdflsdkj_5637549_lessgreaterandpercentdollar');
});

test('should save and delete in memory', function() {
    const simulation = new Simulation(simulationAttributes1, true);
    expect(simulation.isNew()).toBe(true);
    expect(simulation.isDeleted()).toBe(false);
    simulation.saveInMemory();
    expect(simulation.isNew()).toBe(false);
    simulation.deleteInMemory();
    expect(simulation.isDeleted()).toBe(true);
});

test('static methods should work', function() {
    expect(Simulation.getPluralName()).toBe('simulations');
    expect(Simulation.getCapitalizedPluralName()).toBe('Simulations');
    expect(Simulation.getDisplayName()).toBe('Simulation');
    const simulation = new Simulation(simulationAttributes1, true);
    expect(simulation.getPluralName()).toBe('simulations');
    expect(simulation.getCapitalizedPluralName()).toBe('Simulations');
    expect(simulation.getDisplayName()).toBe('Simulation');
});

test('Register algorithm', function() {
    let algorithms = Simulation.getAlgorithms();
    expect(Object.keys(algorithms).length).toEqual(0);

    // Add an algorithm descriptor
    Simulation.registerAlgorithm('test', stubAlgorithm);
    algorithms = Simulation.getAlgorithms();
    expect(Object.keys(algorithms).length).toEqual(1);
    expect(algorithms['test']).toEqual(stubAlgorithm);

    // Add another algorithm descriptor
    const stubAlgorithm2 = new SimulationAlgorithmDescriptorStub();
    Simulation.registerAlgorithm('test2', stubAlgorithm2);
    algorithms = Simulation.getAlgorithms();
    expect(Object.keys(algorithms).length).toEqual(2);
    expect(algorithms['test2']).toEqual(stubAlgorithm2);

});

test('Validate algorithm parameters', function() {
    const simulation = new Simulation(simulationAttributes1, true);

    // Set an undefined algorithm
    const algorithmConfiguration = { type: 'algoSim', config: { stringOption: 'test' } as any };
    simulation.attributes.data.algorithmConfiguration = algorithmConfiguration;
    expect(simulation.validate()).toEqual(false);

    // Add the undefined algorithm
    Simulation.registerAlgorithm('algoSim', stubAlgorithm);
    expect(simulation.validate()).toEqual(true);
   
    // Negative value for numeric option, option's own validate should fail
    algorithmConfiguration.config.numericOption = -3;
    expect(simulation.validate()).toEqual(false);

    algorithmConfiguration.config.numericOption = 4;
    expect(simulation.validate()).toEqual(true);

    // Undefined string option, the descriptor's validate method should fail
    algorithmConfiguration.config.stringOption = undefined;
    expect(simulation.validate()).toEqual(false);

});

test('should construct new simulations and set default algorithm values', function() {

    const attributes = _cloneDeep(simulationAttributes1);
    attributes.data.algorithmConfiguration = {
        type: 'algoSim',
        config: {}
    }
    const simulation1 = new Simulation(attributes, true);
    expect(Object.keys(simulation1.attributes.data.algorithmConfiguration?.config || {}).length).toEqual(Object.keys(stubAlgorithm.getOptions()).length);
    
});
