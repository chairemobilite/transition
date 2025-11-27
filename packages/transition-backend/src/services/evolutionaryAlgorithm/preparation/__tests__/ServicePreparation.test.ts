/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import { lineString as turfLineString } from '@turf/turf';
import EventEmitter from 'events';

import { prepareServices } from '../ServicePreparation';
import Line from 'transition-common/lib/services/line/Line';
import Path from 'transition-common/lib/services/path/Path';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import Service from 'transition-common/lib/services/service/Service';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { EvolutionaryTransitNetworkDesignJobParameters, EvolutionaryTransitNetworkDesignJobType } from '../../../networkDesign/transitNetworkDesign/evolutionary/types';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import jobsDbQueries from '../../../../models/db/jobs.db.queries';
import { TransitNetworkDesignJobWrapper } from '../../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';

const mockedScheduleGeneration = jest.fn();
Schedule.prototype.generateForPeriod = mockedScheduleGeneration;

const collectionManager = new CollectionManager(undefined, {});

const lineId = uuidV4();
const loopLineId = uuidV4();

const outboundPath = new Path({  
    id          : uuidV4(),
    internal_id : 'InternalId test 1',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : lineId,
    name        : 'South',
    direction   : 'outbound',
    description : null,
    integer_id  : 1,
    geography   : turfLineString([[-73.6, 45.5], [-73.5, 45.6], [-73.5, 45.4]]).geometry,
    nodes       : [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 23, 45, 65, 78],
    data        : {
        defaultAcceleration: 1.0,
        defaultDeceleration: 1.0,
        defaultRunningSpeedKmH: 20,
        routingEngine: 'engine',
        routingMode: 'bus',
        foo: 'bar',
        bar: 'foo',
        operatingTimeWithLayoverTimeSeconds: 50 * 60,
        nodeTypes: [
            "engine",
            "engine",
            "engine",
            "engine",
            "engine",
            "engine"
        ]
    }
}, false);

const inboundPath = new Path({
    id          : uuidV4(),
    internal_id : 'InternalId test 2',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : lineId,
    name        : 'North',
    direction   : 'inbound',
    description : "Description path 2",
    integer_id  : 2,
    geography   : turfLineString([[-73.5, 45.4], [-73.6, 45.5], [-73.7, 45.3]]).geometry,
    nodes       : [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 11, 12, 55],
    data        : {
        defaultAcceleration: 1.5,
        defaultDeceleration: 1.5,
        defaultRunningSpeedKmH: 50,
        routingEngine: 'engine',
        routingMode: 'tram',
        foo2: 'bar2',
        bar2: 'foo2',
        operatingTimeWithLayoverTimeSeconds: 55 * 60,
        nodeTypes: [
        "manual",
        "engine",
        "manual",
        "engine",
        "manual"
        ]
    }
}, false);

const loopPath = new Path({  
    id          : uuidV4(),
    internal_id : 'InternalId test 1',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : loopLineId,
    name        : 'South',
    direction   : 'loop',
    description : null,
    integer_id  : 1,
    geography   : turfLineString([[-73.6, 45.5], [-73.5, 45.6], [-73.5, 45.4]]).geometry,
    nodes       : [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 23, 45, 65, 78],
    data        : {
        defaultAcceleration: 1.0,
        defaultDeceleration: 1.0,
        defaultRunningSpeedKmH: 20,
        routingEngine: 'engine',
        routingMode: 'bus',
        foo: 'bar',
        bar: 'foo',
        operatingTimeWithLayoverTimeSeconds: 50 * 60,
        nodeTypes: [
            "engine",
            "engine",
            "engine",
            "engine",
            "engine",
            "engine"
        ]
    }
}, false);

collectionManager.add('paths', new PathCollection([inboundPath.toGeojson(), outboundPath.toGeojson(), loopPath.toGeojson()], {}));
const line = new Line({  
    id                       : lineId,
    internal_id              : 'InternalId test 1',
    is_frozen                : false,
    is_enabled               : true,
    agency_id                : uuidV4(),
    shortname                : '1',
    longname                 : 'Name',
    mode                     : 'bus' as const,
    category                 : 'C+' as const,
    allow_same_line_transfers: false,
    path_ids                 : [inboundPath.getId(), outboundPath.getId()],
    color                    : '#ffffff',
    description              : null,
    is_autonomous            : false,
    scheduleByServiceId      : { },
    data                     : {
      foo: 'bar',
      bar: 'foo'
    }
}, false, collectionManager);

const loopLine = new Line({  
    id                       : loopLineId,
    internal_id              : 'InternalId test 1',
    is_frozen                : false,
    is_enabled               : true,
    agency_id                : uuidV4(),
    shortname                : '1',
    longname                 : 'Name',
    path_ids                 : [loopPath.getId()],
    mode                     : 'bus' as const,
    category                 : 'C+' as const,
    allow_same_line_transfers: false,
    color                    : '#ffffff',
    description              : null,
    is_autonomous            : false,
    scheduleByServiceId      : { },
    data                     : {
      foo: 'bar',
      bar: 'foo'
    }
}, false, collectionManager);

const existingService = new Service({name: 'existingService' }, false);
const serviceCollection = new ServiceCollection([existingService], {});

// Mock the job loader
jest.mock('../../../../models/db/jobs.db.queries');
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

const getJobExecutor = async (parameters: Partial<EvolutionaryTransitNetworkDesignJobParameters>) => {
    const testJobParameters = _cloneDeep(mockJobAttributes);
    testJobParameters.data.parameters = parameters;
    mockJobsDbQueries.read.mockResolvedValueOnce(testJobParameters);
    const job = await ExecutableJob.loadTask(1);
    return new TransitNetworkDesignJobWrapper(job as ExecutableJob<EvolutionaryTransitNetworkDesignJobType>, { progressEmitter: new EventEmitter(), isCancelled: () => false });
}

beforeEach(() => {
    mockedScheduleGeneration.mockClear();
})

describe('Test with a single line', () => {

    const maxTimeBetweenPassages = 15;
    const defaultJobParameters: EvolutionaryTransitNetworkDesignJobParameters = {
        transitNetworkDesignParameters: {
            maxTimeBetweenPassages,
            minTimeBetweenPassages: 5,
            nbOfVehicles: 9,
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
    
    const defaultTripAttributes = {
        schedule_id: uuidV4(),
        schedule_period_id: uuidV4(),
        path_id: outboundPath.getId(),
        node_arrival_times_seconds: [],
        node_departure_times_seconds: [],
        nodes_can_board: [],
        nodes_can_unboard: []
    };

    test('Generate services for one line, inbound, outbound, new service', async() => {
        const lineCollection = new LineCollection([line], {});

        // time between trips too high, inbound/outbound trips
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 10 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1,
                path_id: inboundPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 1,
                arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2
            })
        ] });
        // This schedule is acceptable
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 10 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1,
                path_id: inboundPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 - 10,
                arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2
            })
        ] });
        // minimum time between trips too low
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 5 * 60 - 10,
                arrival_time_seconds: 6 * 60 * 60 + 5 * 60 + 2
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 10 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1,
                path_id: inboundPath.getId()
            })
        ] });

        const jobExecutor = await getJobExecutor(defaultJobParameters);
        const { lineServices, services } = await prepareServices(lineCollection, serviceCollection, jobExecutor);
        expect(mockedScheduleGeneration).toHaveBeenCalledTimes(3);
        // one existing service + 1 new
        expect(services.getFeatures().length).toEqual(2);
        expect(services.getFeatures()[1].attributes).toEqual(expect.objectContaining({
            name: `networkDesign_${line.toString()}_2`,
            monday: true,
            data: { forJob: jobId }
        }));

        expect(lineServices[line.getId()]).toBeDefined();
        expect(Object.keys(lineServices).length).toEqual(1);

        expect(lineServices[line.getId()][0]).toBeDefined();
        expect(lineServices[line.getId()].length).toEqual(1);
        expect(lineServices[line.getId()][0].service.attributes).toEqual(expect.objectContaining({
            name: `networkDesign_${line.toString()}_2`,
            monday: true,
            data: { forJob: jobId }
        }));
    });

    test('Generate services for one line, inbound, outbound, service already exists', async() => {
        const lineCollection = new LineCollection([line], {});
        const existingService = new Service({name: `networkDesign_${line.toString()}_2`, data: { forJob: jobId } }, false);
        const serviceCollection = new ServiceCollection([existingService], {});

        // time between trips too high, inbound/outbound trips
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 10 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1,
                path_id: inboundPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 1,
                arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2
            })
        ] });
        // This schedule is acceptable
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 10 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1,
                path_id: inboundPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 - 10,
                arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2
            })
        ] });
        // minimum time between trips too low
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 5 * 60 - 10,
                arrival_time_seconds: 6 * 60 * 60 + 5 * 60 + 2
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 10 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1,
                path_id: inboundPath.getId()
            })
        ] });

        const jobExecutor = await getJobExecutor(defaultJobParameters);
        const { lineServices, services } = await prepareServices(lineCollection, serviceCollection, jobExecutor);
        expect(mockedScheduleGeneration).toHaveBeenCalledTimes(3);
        // one existing service
        expect(services.getFeatures().length).toEqual(1);

        expect(lineServices[line.getId()]).toBeDefined();
        expect(Object.keys(lineServices).length).toEqual(1);

        expect(lineServices[line.getId()][0]).toBeDefined();
        expect(lineServices[line.getId()].length).toEqual(1);
        expect(lineServices[line.getId()][0].service).toEqual(existingService);
    });

    test('Generate services for one line, loop', async() => {
        const lineCollection = new LineCollection([loopLine], {});

        // time between trips too high, loop trips
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1,
                path_id: loopPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 1,
                arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2,
                path_id: loopPath.getId()
            })
        ] });
        // This schedule is acceptable
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1,
                path_id: loopPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 - 10,
                arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2,
                path_id: loopPath.getId()
            })
        ] });
        // minimum time between trips too low (< 5 minutes)
        mockedScheduleGeneration.mockReturnValueOnce({ trips: [
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60,
                arrival_time_seconds: 6 * 60 * 60 + 1,
                path_id: loopPath.getId()
            }),
            Object.assign({}, defaultTripAttributes, {
                departure_time_seconds: 6 * 60 * 60 + 5 * 60 - 10,
                arrival_time_seconds: 6 * 60 * 60 + 5 * 60 + 2,
                path_id: loopPath.getId()
            })
        ] });

        const jobExecutor = await getJobExecutor(defaultJobParameters);
        const { lineServices, services } = await prepareServices(lineCollection, serviceCollection, jobExecutor);
        expect(mockedScheduleGeneration).toHaveBeenCalledTimes(3);
        // One existing service + 1 new
        expect(services.getFeatures().length).toEqual(2);
        
        expect(lineServices[loopLine.getId()]).toBeDefined();
        expect(Object.keys(lineServices).length).toEqual(1);

        expect(lineServices[loopLine.getId()][0]).toBeDefined();
        expect(lineServices[loopLine.getId()].length).toEqual(1);
    });
});
