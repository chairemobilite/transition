/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import _cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidV4 } from 'uuid';

import Generation, { generateFirstCandidates } from '../LineAndNumberOfVehiclesGeneration';
import * as AlgoTypes from '../../internalTypes';
import Line from 'transition-common/lib/services/line/Line';
import Service from 'transition-common/lib/services/service/Service';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import SimulationRun from '../../../simulation/SimulationRun';
import CandidateClass from '../../candidate/LineAndNumberOfVehiclesNetworkCandidate';

// Setup mocks
const mockPrepareCandidate = jest.fn();
const mockSimulate = jest.fn();
CandidateClass.prototype.prepareScenario = mockPrepareCandidate;
CandidateClass.prototype.simulate = mockSimulate;
// Mock random, cloning with seed does not seem to work for those tests
jest.mock('random', () => ({
    float: jest.fn(),
    integer: jest.fn()
}));
const mockedRandomFloat = random.float as jest.MockedFunction<typeof random.float>;
const mockedRandomInt = random.integer as jest.MockedFunction<typeof random.integer>;

const line1 = new Line({  
    id                       : uuidV4(),
    internal_id              : 'InternalId test 1',
    is_frozen                : false,
    is_enabled               : true,
    agency_id                : uuidV4(),
    shortname                : '1',
    longname                 : 'Name',
    mode                     : 'bus' as const,
    category                 : 'C+' as const,
    allow_same_line_transfers: false,
    path_ids                 : [],
    color                    : '#ffffff',
    description              : null,
    is_autonomous            : false,
    scheduleByServiceId      : { },
    data                     : {
      foo: 'bar',
      bar: 'foo'
    }
}, false);
const line2 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);
const line3 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);
const line4 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);
const line5 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);
const line6 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);

// One one service is required, the content is not important for this test.
const service = new Service({ id: uuidV4()}, false);

const simMethodId = 'test';
const simulationRun = new SimulationRun({
    seed: '235132',
    data: {
        routingAttributes: {
            maxTotalTravelTimeSeconds: 1000
        },
        simulationParameters: {
            maxTimeBetweenPassages: 30,
            nbOfVehicles: 7,
            simulatedAgencies: ['arbitrary'],
            numberOfLinesMin: 3,
            numberOfLinesMax: 4
        },
        algorithmConfiguration: {
            type: 'evoluationaryAlgorithm',
            config: {
                populationSizeMin: 3,
                populationSizeMax: 4,
                numberOfElites: 1,
                numberOfRandoms: 0,
                crossoverNumberOfCuts: 1,
                crossoverProbability: 0.3,
                mutationProbability: 0.5,
                tournamentSize: 2,
                tournamentProbability: 0.6,
                shuffleGenes: true
            }
        }
    },
    status: 'pending' as const,
    simulation_id: uuidV4(),
    results: {},
    options: {
        numberOfThreads: 1,
        fitnessSorter: 'maximize',
        functions: {
            [simMethodId]: { weight: 1 }
        },
        trRoutingStartingPort: 14000
    }
}, true);

const options: AlgoTypes.RuntimeAlgorithmData = {
    agencies: [],
    randomGenerator: random,
    simulationRun: simulationRun,
    lineCollection: new LineCollection([line1, line2, line3, line4, line5, line6], {}),
    linesToKeep: [],
    services: new ServiceCollection([service], {}),
    lineServices: {
        [line1.getId()]: [
            {
                numberOfVehicles: 4,
                service: new Service({ id: uuidV4()}, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4()}, false)
            }
        ],
        [line2.getId()]: [
            {
                numberOfVehicles: 1,
                service: new Service({ id: uuidV4()}, false)
            },
            {
                numberOfVehicles: 3,
                service: new Service({ id: uuidV4()}, false)
            }
        ],
        [line3.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4()}, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4()}, false)
            }
        ],
        [line4.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4()}, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4()}, false)
            }
        ],
        [line5.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4()}, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4()}, false)
            }
        ],
        [line6.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4()}, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4()}, false)
            }
        ]
    },
    nonSimulatedServices: [],
    populationSize: 2,
    options: {
        populationSizeMin: 2,
        populationSizeMax: 2,
        numberOfElites: 0,
        numberOfRandoms: 0,
        crossoverNumberOfCuts: 1,
        crossoverProbability: 1,
        mutationProbability: 0,
        tournamentSize: 2,
        tournamentProbability: 1,
        numberOfGenerations: 3,
        shuffleGenes: false,
        keepCandidates: 1,
        keepGenerations: 1
    }
}

describe('Test generation of first candidates', () => {

    test('Test with correct number of vehicles', async () => {
        mockedRandomInt.mockReturnValueOnce(3);
        mockedRandomInt.mockReturnValueOnce(4);
        mockedRandomFloat.mockReturnValue(0.5);
        const candidates = generateFirstCandidates(options);
        expect(candidates.length).toEqual(2);
        const nbLinesFirstCandidate = candidates[0].getChromosome().lines.filter(active => active === true).length;
        expect(nbLinesFirstCandidate).toEqual(3);
        const nbLinesSecondCandidate = candidates[1].getChromosome().lines.filter(active => active === true).length;
        expect(nbLinesSecondCandidate).toEqual(4);
    });
    
});

describe('Test simulation and results', () => {

    beforeEach(() => {
        mockSimulate.mockClear();
    });

    test('Test successful simulation, sorted descending', async () => {
        simulationRun.attributes.options.fitnessSorter = 'maximize';
        mockedRandomInt.mockReturnValueOnce(3);
        mockedRandomInt.mockReturnValueOnce(4);
        mockedRandomFloat.mockReturnValue(0.5);
        const candidates = generateFirstCandidates(options);
        candidates.forEach((candidate, index) => {
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: 1000 + index * 100,
                results: {
                    [simMethodId]: { fitness: 1000 + index * 100 }
                }
            });
            candidate.serialize = jest.fn().mockReturnValue({
                lines: {},
                result: {
                    totalFitness: 1000 + index * 100,
                    results: {}
                }
            });
        })
        const generation = new Generation(candidates, options);
        await generation.simulate();
        expect(mockSimulate).toHaveBeenCalledTimes(candidates.length);
        const serialized = generation.serializeBestResult();
        expect(serialized).toEqual({
            lines: {},
            result: {
                totalFitness: 1000 + 100 * (candidates.length - 1),
                results: {}
            }
        });
    });

    test('Test successful simulation, sorted ascending', async () => {
        simulationRun.attributes.options.fitnessSorter = 'minimize';
        mockedRandomInt.mockReturnValueOnce(3);
        mockedRandomInt.mockReturnValueOnce(4);
        mockedRandomFloat.mockReturnValue(0.5);
        const candidates = generateFirstCandidates(options);
        candidates.forEach((candidate, index) => {
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: 1000 + index * 100,
                results: {
                    [simMethodId]: { fitness: 1000 + index * 100 }
                }
            });
            candidate.serialize = jest.fn().mockReturnValue({
                lines: {},
                result: {
                    totalFitness: 1000 + index * 100,
                    results: {}
                }
            });
        })
        const generation = new Generation(candidates, options);
        await generation.simulate();
        expect(mockSimulate).toHaveBeenCalledTimes(candidates.length);
        const serialized = generation.serializeBestResult();
        expect(serialized).toEqual({
            lines: {},
            result: {
                totalFitness: 1000,
                results: {}
            }
        });
    });
    
});

describe('Test sort candidates after results', () => {

    beforeEach(() => {
        simulationRun.attributes.options.fitnessSorter = 'maximize';
    });

    test('Test sort with one method', async () => {
        // Create candidates, chromosomes does not matter here, we'll just need the results
        const candidates = [
            new CandidateClass({ lines: [true, false], name: 'test1'}, options),
            new CandidateClass({ lines: [true, false], name: 'test2'}, options),
            new CandidateClass({ lines: [true, false], name: 'test3'}, options),
            new CandidateClass({ lines: [true, false], name: 'test4'}, options),
        ];
        const originalCandidates = _cloneDeep(candidates);
        // With fitness modifier, we maximize, so index 2 should be first, then 0, then 1 then 3
        candidates.forEach((candidate, index) => {
            const fitnessModifier = index % 2 === 0 ? index * 100 : -index * 100;
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: Number.NaN,
                results: {
                    [simMethodId]: { fitness: 1000 + fitnessModifier }
                }
            });
        });
        const generation = new Generation(candidates, options);
        generation.sortCandidates();
        const actualCandidates = candidates.map(candidate => candidate.getChromosome().name);
        expect(actualCandidates).toEqual([
            originalCandidates[2].getChromosome().name, 
            originalCandidates[0].getChromosome().name, 
            originalCandidates[1].getChromosome().name, 
            originalCandidates[3].getChromosome().name
        ]);
        const actualCandidateFitnesses = candidates.map(candidate => candidate.getResult().totalFitness);
        expect(actualCandidateFitnesses).toEqual([1, 2, 3, 4]);
    });

    test('Test sort with multiple methods of equal weight', async () => {
        // Add a second method and prepare options
        const simMethod2 = 'simMethod2';
        const optionsWithNewMethod = _cloneDeep(options);
        const simulationRunAttribs = _cloneDeep(simulationRun.attributes);
        simulationRunAttribs.options.functions[simMethodId] = { weight: 0.5 };
        simulationRunAttribs.options.functions[simMethod2] = { weight: 0.5 };
        const simulationRunWith2Methods = new SimulationRun(simulationRunAttribs, false);
        optionsWithNewMethod.simulationRun = simulationRunWith2Methods;

        // Create candidates, chromosomes does not matter here, we'll just need the results
        const candidates = [
            new CandidateClass({ lines: [true, false], name: 'test1'}, options),
            new CandidateClass({ lines: [true, false], name: 'test2'}, options),
            new CandidateClass({ lines: [true, false], name: 'test3'}, options),
            new CandidateClass({ lines: [true, false], name: 'test4'}, options),
        ];
        const originalCandidates = _cloneDeep(candidates);
        
        // For sim method 1, we use a fitness modifier, ranks should be [2, 0, 1, 3]
        // For sim method 2, we add a value given the index, so ranks should be [3, 2, 1, 0]
        // Total score for each candidate is [(2 ^ 0.5) * (4 ^ 0.5), (3 ^ 0.5) * (3 ^ 0.5), (1 ^ 0.5) * (2 ^ 0.5), (4 ^ 0.5) * (1 ^ 0.5)] 
        // ==> [2.83, 3, 1.41, 2], final sort order should thus be [2, 3, 0, 1]
        candidates.forEach((candidate, index) => {
            const fitnessModifier = index % 2 === 0 ? index * 100 : -index * 100;
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: Number.NaN,
                results: {
                    [simMethodId]: { fitness: 1000 + fitnessModifier },
                    [simMethod2]: { fitness: 1000 + index * 100 }
                }
            });
        });
        const generation = new Generation(candidates, optionsWithNewMethod);
        generation.sortCandidates();
        const actualCandidates = candidates.map(candidate => candidate.getChromosome().name);
        expect(actualCandidates).toEqual([
            originalCandidates[2].getChromosome().name, 
            originalCandidates[3].getChromosome().name, 
            originalCandidates[0].getChromosome().name, 
            originalCandidates[1].getChromosome().name
        ]);
        
        const actualCandidateFitnesses = candidates.map(candidate => candidate.getResult().totalFitness);
        expect(actualCandidateFitnesses[0]).toBeCloseTo(1.41, 2);
        expect(actualCandidateFitnesses[1]).toBeCloseTo(2, 2);
        expect(actualCandidateFitnesses[2]).toBeCloseTo(2.83, 2);
        expect(actualCandidateFitnesses[3]).toBeCloseTo(3, 2);
    });

    test('Test sort with multiple methods of unequal weight', async () => {
        // Same asprevious test, only the weights change
        // Add a second method and prepare options
        const simMethod2 = 'simMethod2';
        const optionsWithNewMethod = _cloneDeep(options);
        const simulationRunAttribs = _cloneDeep(simulationRun.attributes);
        simulationRunAttribs.options.functions[simMethodId] = { weight: 0.8 };
        simulationRunAttribs.options.functions[simMethod2] = { weight: 0.2 };
        const simulationRunWith2Methods = new SimulationRun(simulationRunAttribs, false);
        optionsWithNewMethod.simulationRun = simulationRunWith2Methods;

        // Create candidates, chromosomes does not matter here, we'll just need the results
        const candidates = [
            new CandidateClass({ lines: [true, false], name: 'test1'}, options),
            new CandidateClass({ lines: [true, false], name: 'test2'}, options),
            new CandidateClass({ lines: [true, false], name: 'test3'}, options),
            new CandidateClass({ lines: [true, false], name: 'test4'}, options),
        ];
        const originalCandidates = _cloneDeep(candidates);
        
        // For sim method 1, we use a fitness modifier, ranks should be [2, 0, 1, 3]
        // For sim method 2, we add a value given the index, so ranks should be [3, 2, 1, 0]
        // Total score for each candidate is [(2 ^ 0.8) * (4 ^ 0.2), (3 ^ 0.8) * (3 ^ 0.2), (1 ^ 0.8) * (2 ^ 0.2), (4 ^ 0.8) * (1 ^ 0.2)] 
        // ==> [2.297, 3, 1.15, 3.03], final sort order should thus be [2, 0, 1, 3]
        candidates.forEach((candidate, index) => {
            const fitnessModifier = index % 2 === 0 ? index * 100 : -index * 100;
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: Number.NaN,
                results: {
                    [simMethodId]: { fitness: 1000 + fitnessModifier },
                    [simMethod2]: { fitness: 1000 + index * 100 }
                }
            });
        });
        const generation = new Generation(candidates, optionsWithNewMethod);
        generation.sortCandidates();
        const actualCandidates = candidates.map(candidate => candidate.getChromosome().name);
        expect(actualCandidates).toEqual([
            originalCandidates[2].getChromosome().name, 
            originalCandidates[0].getChromosome().name, 
            originalCandidates[1].getChromosome().name, 
            originalCandidates[3].getChromosome().name
        ]);
        const actualCandidateFitnesses = candidates.map(candidate => candidate.getResult().totalFitness);
        expect(actualCandidateFitnesses[0]).toBeCloseTo(1.15, 2);
        expect(actualCandidateFitnesses[1]).toBeCloseTo(2.297, 2);
        expect(actualCandidateFitnesses[2]).toBeCloseTo(3, 2);
        expect(actualCandidateFitnesses[3]).toBeCloseTo(3.03, 2);
    });

});