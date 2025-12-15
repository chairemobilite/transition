/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import _cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidV4 } from 'uuid';
import EventEmitter from 'events';

import Generation, { generateFirstCandidates } from '../LineAndNumberOfVehiclesGeneration';
import * as AlgoTypes from '../../internalTypes';
import Line from 'transition-common/lib/services/line/Line';
import Service from 'transition-common/lib/services/service/Service';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import CandidateClass from '../../candidate/LineAndNumberOfVehiclesNetworkCandidate';
import { EvolutionaryTransitNetworkDesignJobParameters, EvolutionaryTransitNetworkDesignJobType } from '../../../networkDesign/transitNetworkDesign/evolutionary/types';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import jobsDbQueries from '../../../../models/db/jobs.db.queries';
import { createMockJobExecutor } from '../../../networkDesign/transitNetworkDesign/__tests__/MockTransitNetworkDesignJobWrapper';
import Scenario from 'transition-common/lib/services/scenario/Scenario';

// Setup mocks
const mockPrepareCandidate = jest.fn();
const mockSimulate = jest.fn();
CandidateClass.prototype.prepareScenario = mockPrepareCandidate;
CandidateClass.prototype.simulate = mockSimulate;
CandidateClass.prototype.getScenario = jest.fn().mockReturnValue(new Scenario({ id: uuidV4() }, false));
// Mock random, cloning with seed does not seem to work for those tests
jest.mock('random', () => ({
    float: jest.fn(),
    integer: jest.fn()
}));
const mockedRandomFloat = random.float as jest.MockedFunction<typeof random.float>;
const mockedRandomInt = random.integer as jest.MockedFunction<typeof random.integer>;

// Mock the job loader
jest.mock('../../../../models/db/jobs.db.queries');
const mockJobsDbQueries = jobsDbQueries as jest.Mocked<typeof jobsDbQueries>;

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
const service = new Service({ id: uuidV4() }, false);

const createMockJobExecutorForTest = async (parameters: Partial<EvolutionaryTransitNetworkDesignJobParameters>) => {
    const mockJobAttributes = {
        id: 1,
        name: 'evolutionaryTransitNetworkDesign' as const,
        user_id: 123,
        status: 'pending' as const,
        internal_data: {},
        data: {
            parameters: {
                transitNetworkDesignParameters: {
                    maxTimeBetweenPassages: 30,
                    nbOfVehicles: 7,
                    simulatedAgencies: ['arbitrary'],
                    numberOfLinesMin: 3,
                    numberOfLinesMax: 4
                },
                algorithmConfiguration: {
                    type: 'evolutionaryAlgorithm',
                    config: {
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
                },
                ...parameters
            } as EvolutionaryTransitNetworkDesignJobParameters
        },
        resources: {
            files: {
                transitDemand: 'demand.csv',
                nodeWeight: 'weights.csv'
            }
        }
    };

    mockJobsDbQueries.read.mockResolvedValueOnce(mockJobAttributes);
    const job = await ExecutableJob.loadTask(1);

    const lineCollection = new LineCollection([line1, line2, line3, line4, line5, line6], {});
    const agencyCollection = new AgencyCollection([], {});
    const serviceCollection = new ServiceCollection([service], {});

    const lineServices: AlgoTypes.LineServices = {
        [line1.getId()]: [
            {
                numberOfVehicles: 4,
                service: new Service({ id: uuidV4() }, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4() }, false)
            }
        ],
        [line2.getId()]: [
            {
                numberOfVehicles: 1,
                service: new Service({ id: uuidV4() }, false)
            },
            {
                numberOfVehicles: 3,
                service: new Service({ id: uuidV4() }, false)
            }
        ],
        [line3.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4() }, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4() }, false)
            }
        ],
        [line4.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4() }, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4() }, false)
            }
        ],
        [line5.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4() }, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4() }, false)
            }
        ],
        [line6.getId()]: [
            {
                numberOfVehicles: 2,
                service: new Service({ id: uuidV4() }, false)
            },
            {
                numberOfVehicles: 5,
                service: new Service({ id: uuidV4() }, false)
            }
        ]
    };

    return createMockJobExecutor(job as ExecutableJob<EvolutionaryTransitNetworkDesignJobType>, {
        lineCollection,
        agencyCollection,
        serviceCollection,
        simulatedLineCollection: lineCollection,
        lineServices
    });
};

describe('Test generation of first candidates', () => {

    test('Test with correct number of vehicles', async () => {
        mockedRandomInt.mockReturnValueOnce(3);
        mockedRandomInt.mockReturnValueOnce(4);
        mockedRandomFloat.mockReturnValue(0.5);

        const jobExecutor = await createMockJobExecutorForTest({});
        // Set the population size, which should have randomly been set already
        jobExecutor.job.attributes.internal_data.populationSize = 2;

        const candidates = generateFirstCandidates(jobExecutor);
        expect(candidates.length).toEqual(2);
        const nbLinesFirstCandidate = candidates[0].getChromosome().lines.filter((active) => active === true).length;
        expect(nbLinesFirstCandidate).toEqual(3);
        const nbLinesSecondCandidate = candidates[1].getChromosome().lines.filter((active) => active === true).length;
        expect(nbLinesSecondCandidate).toEqual(4);
    });

});

describe('Test simulation and results', () => {


    beforeEach(() => {
        mockSimulate.mockClear();
    });

    test('Test successful simulation, sorted descending, with AccessibilityMapSimulation', async () => {
        const simultionMethodAccessibility = {
            type: 'AccessibilityMapSimulation' as const,
            config: {
                dataSourceId: 'someDataSourceId',
                sampleRatio: 0.05
            }
        };

        mockedRandomInt.mockReturnValueOnce(3);
        mockedRandomInt.mockReturnValueOnce(4);
        mockedRandomFloat.mockReturnValue(0.5);

        const jobExecutor = await createMockJobExecutorForTest({ simulationMethod: simultionMethodAccessibility });
        // Set the population size, which should have randomly been set already
        jobExecutor.job.attributes.internal_data.populationSize = 2;

        // Generate the first candidates
        const candidates = generateFirstCandidates(jobExecutor);
        candidates.forEach((candidate, index) => {
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: 1000 + index * 100,
                results: {
                    AccessibilityMapSimulation: { fitness: 1000 + index * 100 }
                }
            });
            candidate.serialize = jest.fn().mockReturnValue({
                lines: {},
                result: {
                    totalFitness: 1000 + index * 100,
                    results: {}
                }
            });
        });
        const generation = new Generation(candidates, jobExecutor, 1);
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

    test('Test successful simulation, sorted ascending, with OdTripSimulation', async () => {
        const simulationMethodConfigurationOdTrip = {
            type: 'OdTripSimulation' as const,
            config: {
                demandAttributes: {
                    type: 'csv' as const,
                    fileAndMapping: {
                        csvFile: { location: 'upload' as const, filename: 'demand.csv', uploadFilename: 'demand.csv' },
                        fieldMappings: {
                            id: 'id',
                            originLat: 'origin_lat',
                            originLon: 'origin_lon',
                            destinationLat: 'destination_lat',
                            destinationLon: 'destination_lon',
                            projection: 'EPSG:4326'
                        }
                    },
                    csvFields: []
                },
                transitRoutingAttributes: {
                    minWaitingTimeSeconds: 180,
                    maxTransferTravelTimeSeconds: 900,
                    maxAccessEgressTravelTimeSeconds: 900,
                    maxWalkingOnlyTravelTimeSeconds: 3600,
                    maxFirstWaitingTimeSeconds: 900,
                    maxTotalTravelTimeSeconds: 3600,
                    walkingSpeedMps: 1.3,
                    walkingSpeedFactor: 1,
                },
                evaluationOptions: {
                    sampleRatio: 0.05,
                    odTripFitnessFunction: 'travelTimeCost',
                    fitnessFunction: 'hourlyUserPlusOperatingCosts'
                }
            }
        };

        mockedRandomInt.mockReturnValueOnce(3);
        mockedRandomInt.mockReturnValueOnce(4);
        mockedRandomFloat.mockReturnValue(0.5);

        const jobExecutor = await createMockJobExecutorForTest({ simulationMethod: simulationMethodConfigurationOdTrip });
        // Set the population size, which should have randomly been set already
        jobExecutor.job.attributes.internal_data.populationSize = 2;

        // Generate the first candidates
        const candidates = generateFirstCandidates(jobExecutor);
        candidates.forEach((candidate, index) => {
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: 1000 + index * 100,
                results: {
                    OdTripSimulation: { fitness: 1000 + index * 100 }
                }
            });
            candidate.serialize = jest.fn().mockReturnValue({
                lines: {},
                result: {
                    totalFitness: 1000 + index * 100,
                    results: {}
                }
            });
        });
        const generation = new Generation(candidates, jobExecutor, 1);
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

    test('Test sort with OdTripSimulation, should minimize', async () => {
        const simulationMethod = {
            type: 'OdTripSimulation' as const,
            config: {
                demandAttributes: {
                    type: 'csv' as const,
                    fileAndMapping: {
                        csvFile: { location: 'upload' as const, filename: 'demand.csv', uploadFilename: 'demand.csv' },
                        fieldMappings: {
                            id: 'id',
                            originLat: 'origin_lat',
                            originLon: 'origin_lon',
                            destinationLat: 'destination_lat',
                            destinationLon: 'destination_lon',
                            projection: 'EPSG:4326'
                        }
                    },
                    csvFields: []
                },
                transitRoutingAttributes: {
                    minWaitingTimeSeconds: 180,
                    maxTransferTravelTimeSeconds: 900,
                    maxAccessEgressTravelTimeSeconds: 900,
                    maxWalkingOnlyTravelTimeSeconds: 3600,
                    maxFirstWaitingTimeSeconds: 900,
                    maxTotalTravelTimeSeconds: 3600,
                    walkingSpeedMps: 1.3,
                    walkingSpeedFactor: 1,
                },
                evaluationOptions: {
                    sampleRatio: 0.05,
                    odTripFitnessFunction: 'travelTimeCost',
                    fitnessFunction: 'hourlyUserPlusOperatingCosts'
                }
            }
        };

        const simMethodId = 'OdTripSimulation';
        const jobExecutor = await createMockJobExecutorForTest({ simulationMethod });
        // Create candidates, chromosomes does not matter here, we'll just need the results
        const candidates = [
            new CandidateClass({ lines: [true, false], name: 'test1' }, jobExecutor),
            new CandidateClass({ lines: [true, false], name: 'test2' }, jobExecutor),
            new CandidateClass({ lines: [true, false], name: 'test3' }, jobExecutor),
            new CandidateClass({ lines: [true, false], name: 'test4' }, jobExecutor),
        ];
        const originalCandidates = _cloneDeep(candidates);
        // With fitness modifier, even candidates have higher fitness than even, so index 3 should be first, then 1, then 0, then 2
        candidates.forEach((candidate, index) => {
            const fitnessModifier = index % 2 === 0 ? index * 100 : -index * 100;
            candidate.getResult = jest.fn().mockReturnValue({
                totalFitness: Number.NaN,
                results: {
                    [simMethodId]: { fitness: 1000 + fitnessModifier }
                }
            });
        });
        const generation = new Generation(candidates, jobExecutor);
        generation.sortCandidates();
        const actualCandidates = candidates.map((candidate) => candidate.getChromosome().name);
        expect(actualCandidates).toEqual([
            originalCandidates[3].getChromosome().name,
            originalCandidates[1].getChromosome().name,
            originalCandidates[0].getChromosome().name,
            originalCandidates[2].getChromosome().name
        ]);
        const actualCandidateFitnesses = candidates.map((candidate) => candidate.getResult().totalFitness);
        expect(actualCandidateFitnesses).toEqual([1, 2, 3, 4]);
    });

});
