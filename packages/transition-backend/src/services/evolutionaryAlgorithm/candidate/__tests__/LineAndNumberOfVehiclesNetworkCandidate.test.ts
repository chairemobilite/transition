/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import _cloneDeep from 'lodash/cloneDeep';
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import NetworkCandidate from '../LineAndNumberOfVehiclesNetworkCandidate';
import * as AlgoTypes from '../../internalTypes';
import Line from 'transition-common/lib/services/line/Line';
import Service from 'transition-common/lib/services/service/Service';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';

import Scenario from 'transition-common/lib/services/scenario/Scenario';
import { TransitNetworkDesignJobWrapper } from '../../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { EvolutionaryTransitNetworkDesignJobParameters, EvolutionaryTransitNetworkDesignJobType } from '../../../networkDesign/transitNetworkDesign/evolutionary/types';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import jobsDbQueries from '../../../../models/db/jobs.db.queries';

const socketMock = new EventEmitter();
const mockSimulateScenario = jest.fn();

// Mock random, cloning with seed does not seem to work for those tests
jest.mock('random', () => ({
    float: jest.fn()
}));
const mockedRandomFloat = random.float as jest.MockedFunction<typeof random.float>;

const line1 = new Line({
    id: uuidV4(),
    internal_id: 'InternalId test 1',
    is_frozen: false,
    is_enabled: true,
    agency_id: uuidV4(),
    shortname: '1',
    longname: 'Name',
    mode: 'bus' as const,
    category: 'C+' as const,
    allow_same_line_transfers: false,
    path_ids: [],
    color: '#ffffff',
    description: null,
    is_autonomous: false,
    scheduleByServiceId: {},
    data: {
        foo: 'bar',
        bar: 'foo'
    }
}, false);
const line2 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);
const line3 = new Line(Object.assign({}, line1.attributes, { id: uuidV4() }), false);

// One one service is required, the content is not important for this test.
const service = new Service({ id: uuidV4() }, false);

const defaultJobParameters: EvolutionaryTransitNetworkDesignJobParameters = {
    transitNetworkDesignParameters: {
        maxTimeBetweenPassages: 30,
        minTimeBetweenPassages: 0,
        nbOfVehicles: 7,
        numberOfLinesMin: 0,
        numberOfLinesMax: 0,
        nonSimulatedServices: [],
        simulatedAgencies: ['arbitrary'],
        linesToKeep: []
    },
    algorithmConfiguration: {
        type: 'evolutionaryAlgorithm',
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
            shuffleGenes: false,
            keepGenerations: 0,
            keepCandidates: 0,
            numberOfGenerations: 5
        }
    },
    simulationMethod: {
        type: 'OdTripSimulation',
        config: {
            demandAttributes: {
                type: 'csv',
                fileAndMapping: {
                    csvFile: {
                        location: 'upload',
                        filename: '',
                        uploadFilename: ''
                    },
                    fieldMappings: {}
                },
                csvFields: []
            },
            transitRoutingAttributes: {
                minWaitingTimeSeconds: undefined,
                maxTransferTravelTimeSeconds: undefined,
                maxAccessEgressTravelTimeSeconds: undefined,
                maxWalkingOnlyTravelTimeSeconds: undefined,
                maxFirstWaitingTimeSeconds: undefined,
                maxTotalTravelTimeSeconds: undefined,
                walkingSpeedMps: undefined,
                walkingSpeedFactor: undefined
            },
            evaluationOptions: {
                sampleRatio: 0,
                odTripFitnessFunction: '',
                fitnessFunction: ''
            }
        }
    }
};

// Mock the job loader
jest.mock('../../../models/db/jobs.db.queries');
const mockJobsDbQueries = jobsDbQueries as jest.Mocked<typeof jobsDbQueries>;
const jobId = 1;
const mockJobAttributes = {
    id: jobId,
    name: 'evolutionaryTransitNetworkDesign' as const,
    user_id: 123,
    status: 'pending' as const,
    internal_data: {},
    data: {
        parameters: {
            
        } as Partial<EvolutionaryTransitNetworkDesignJobParameters>
    },
    resources: {
        files: {
            input: 'something.csv'
        }
    }
};
let job: ExecutableJob<EvolutionaryTransitNetworkDesignJobType>;

const options: AlgoTypes.RuntimeAlgorithmData = {
    agencies: [],
    randomGenerator: random,
    lineCollection: new LineCollection([line1, line2, line3], {}),
    linesToKeep: [],
    services: new ServiceCollection([service], {}),
    lineServices: {
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
        ]
    },
    nonSimulatedServices: [],
    populationSize: 0,
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

const getJobExecutor = async (parameters: Partial<EvolutionaryTransitNetworkDesignJobParameters>) => {
    const testJobParameters = _cloneDeep(mockJobAttributes);
    testJobParameters.data.parameters = parameters;
    mockJobsDbQueries.read.mockResolvedValueOnce(testJobParameters);
    job = await ExecutableJob.loadTask(1);
    return new TransitNetworkDesignJobWrapper(job as ExecutableJob<EvolutionaryTransitNetworkDesignJobType>, { progressEmitter: new EventEmitter(), isCancelled: () => false });
}

describe('Test candidate preparation', () => {

    test('Test with correct number of vehicles', async () => {
        mockedRandomFloat.mockReturnValueOnce(0.1);
        // 7 vehicles, lvl 1 for line 1, lvl 0 for line 3
        const testParameters = _cloneDeep(defaultJobParameters);
        testParameters.transitNetworkDesignParameters.nbOfVehicles = 7;
        const jobExecutor = await getJobExecutor(testParameters);

        const networkCandidate = new NetworkCandidate({ lines: [true, false, true], name: 'test' }, jobExecutor);
        await networkCandidate.prepareScenario(socketMock);
        const scenario = networkCandidate.getScenario();
        expect(scenario).toBeDefined();
        expect((scenario as Scenario).attributes.services).toEqual([
            (options.lineServices[line1.getId()] as any)[1].service.getId(),
            (options.lineServices[line3.getId()] as any)[0].service.getId()
        ]);
    });

    test('Test with too few vehicles', async () => {
        // 5 vehicles: startup service should have at least 6
        simulationRun.attributes.data.transitNetworkDesignParameters.nbOfVehicles = 5;
        const networkCandidate = new NetworkCandidate({ lines: [true, false, true], name: 'test' }, options);
        await expect(networkCandidate.prepareScenario(socketMock))
            .rejects
            .toThrow('Impossible to assign minimal level of service for this combination');
        const scenario = networkCandidate.getScenario();
        expect(scenario).not.toBeDefined();
    });

    test('Test with too many vehicles', async () => {
        // 12 vehicles: This combination has a max of 10
        mockedRandomFloat.mockReturnValueOnce(0.1);
        mockedRandomFloat.mockReturnValueOnce(0.1);
        mockedRandomFloat.mockReturnValueOnce(0.1);
        mockedRandomFloat.mockReturnValueOnce(0.1);
        mockedRandomFloat.mockReturnValueOnce(0.6);
        simulationRun.attributes.data.transitNetworkDesignParameters.nbOfVehicles = 12;
        const networkCandidate = new NetworkCandidate({ lines: [true, false, true], name: 'test' }, options);
        await networkCandidate.prepareScenario(socketMock);
        const scenario = networkCandidate.getScenario();
        expect(scenario).toBeDefined();
        expect((scenario as Scenario).attributes.services).toEqual([
            (options.lineServices[line1.getId()] as any)[1].service.getId(),
            (options.lineServices[line3.getId()] as any)[1].service.getId()
        ]);
    });

});

describe('Simulate scenario and serialize result', () => {

    let networkCandidate: NetworkCandidate;
    // Set the lines' schedules by services, which is supposed to exist when simulating candidates
    options.lineCollection.getFeatures().forEach(line => {
        options.lineServices[line.getId()]
            .forEach(lineService => line.attributes.scheduleByServiceId[lineService.service.getId()] = {
                service_id: lineService.service.getId()
            } as any);
    })

    beforeEach(async () => {
        mockSimulateScenario.mockClear();
        // 7 vehicles, lvl 1 for line 1, lvl 0 for line 2
        mockedRandomFloat.mockReturnValue(0.1);
        simulationRun.attributes.data.transitNetworkDesignParameters.nbOfVehicles = 7;
        networkCandidate = new NetworkCandidate({ lines: [true, false, true], name: 'test' }, options);
        await networkCandidate.prepareScenario(socketMock);
    })

    test('Test successful simulation and serialization', async () => {
        // Mock result
        const result = {
            totalFitness: Number.NaN,
            results: {}
        };
        mockSimulateScenario.mockResolvedValueOnce(result);
        await networkCandidate.simulate();

        expect(mockSimulateScenario).toHaveBeenCalledTimes(1);
        expect(networkCandidate.getResult()).toEqual(result);

        expect(networkCandidate.serialize()).toEqual({
            maxNumberOfVehicles: 7,
            numberOfLines: 2,
            numberOfVehicles: 7,
            lines: {
                [line1.getId()]: {
                    shortname: line1.attributes.shortname,
                    nbVehicles: (options.lineServices[line1.getId()])[1].numberOfVehicles
                },
                [line3.getId()]: {
                    shortname: line3.attributes.shortname,
                    nbVehicles: (options.lineServices[line3.getId()])[0].numberOfVehicles
                }
            },
            result
        })
    });

});