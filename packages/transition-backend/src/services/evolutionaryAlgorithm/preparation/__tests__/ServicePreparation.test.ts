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
import Schedule, { SchedulePeriodTrip } from 'transition-common/lib/services/schedules/Schedule';
import Service from 'transition-common/lib/services/service/Service';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { LineServices } from '../../internalTypes';
import { EvolutionaryTransitNetworkDesignJobParameters, EvolutionaryTransitNetworkDesignJobType } from '../../../networkDesign/transitNetworkDesign/evolutionary/types';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import jobsDbQueries from '../../../../models/db/jobs.db.queries';
import { TransitNetworkDesignJobWrapper } from '../../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { number } from 'yargs';

const mockedScheduleGeneration = jest.fn().mockReturnValue({ trips: [] }) as jest.MockedFunction<typeof Schedule.prototype.generateForPeriod>;
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
    const minTimeBetweenPassages = 5;
    const defaultJobParameters: EvolutionaryTransitNetworkDesignJobParameters = {
        transitNetworkDesignParameters: {
            maxTimeBetweenPassages,
            minTimeBetweenPassages,
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
    const defaultTripAttributes: Partial<SchedulePeriodTrip> = {
        schedule_period_id: 1,
        path_id: outboundPath.getId(),
        node_arrival_times_seconds: [],
        node_departure_times_seconds: [],
        nodes_can_board: [],
        nodes_can_unboard: []
    };

    const buildInboundOutboundTrips = (overrides: Array<Partial<SchedulePeriodTrip>>): { trips: SchedulePeriodTrip[] } => ({
        trips: overrides.map((override) => Object.assign({}, defaultTripAttributes, override) as SchedulePeriodTrip)
    });

    const buildLoopTrips = (overrides: Array<Partial<SchedulePeriodTrip>>): { trips: SchedulePeriodTrip[] } => ({
        trips: overrides.map((override) => Object.assign({}, defaultTripAttributes, override) as SchedulePeriodTrip)
    });

    const testCases = [
        {
            name: 'Generate services for one line, inbound, outbound, new service',
            lineCollection: new LineCollection([line], {}),
            serviceCollection,
            generatedSchedules: [
                // time between trips too high, inbound/outbound trips
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 1, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2 }
                ]),
                // This schedule is acceptable
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 - 10, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2 }
                ]),
                // minimum time between trips too low
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 - 10, arrival_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 + 2 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() }
                ])
            ],
            expectations: ({ lineServices, services }: { lineServices: LineServices; services: ServiceCollection }) => {
                // the existing service + 1 new generated service
                expect(services.getFeatures().length).toEqual(2);
                expect(services.getFeatures()[1].attributes).toEqual(expect.objectContaining({
                    name: `networkDesign_${line.toString()}_2`,
                    data: { forJob: jobId}
                }));
                expect(lineServices[line.getId()]).toBeDefined();
                expect(Object.keys(lineServices).length).toEqual(1);
                expect(lineServices[line.getId()].length).toEqual(1);
                expect(lineServices[line.getId()][0]).toEqual(expect.objectContaining({
                    service: expect.objectContaining({
                        _attributes: expect.objectContaining({
                            name: `networkDesign_${line.toString()}_2`,
                            data: { forJob: jobId}
                        })
                    }),
                    numberOfVehicles: 2
                }));
            }
        },
        {
            name: 'Generate services for one line, inbound, outbound, existing service',
            lineCollection: new LineCollection([line], {}),
            serviceCollection: new ServiceCollection([new Service({ name: `networkDesign_${line.toString()}_2`, data: { forJob: jobId } }, false)], {}),
            generatedSchedules: [
                // time between trips too high, inbound/outbound trips
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 1, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2 }
                ]),
                // This schedule is acceptable
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 - 10, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2 }
                ]),
                // minimum time between trips too low
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 - 10, arrival_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 + 2 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() }
                ])
            ],
            expectations: ({ lineServices, services }: { lineServices: LineServices; services: ServiceCollection }) => {
                // only one existing service
                expect(services.getFeatures().length).toEqual(1);
                expect(services.getFeatures()[0].attributes).toEqual(expect.objectContaining({
                    name: `networkDesign_${line.toString()}_2`,
                    data: { forJob: jobId}
                }));
                expect(lineServices[line.getId()]).toBeDefined();
                expect(Object.keys(lineServices).length).toEqual(1);
                expect(lineServices[line.getId()].length).toEqual(1);
                expect(lineServices[line.getId()][0]).toEqual(expect.objectContaining({
                    service: expect.objectContaining({
                        _attributes: expect.objectContaining({
                            name: `networkDesign_${line.toString()}_2`,
                            data: { forJob: jobId}
                        })
                    }),
                    numberOfVehicles: 2
                }));
            }
        },
        {
            name: 'Generate services for one line, loop',
            lineCollection: new LineCollection([loopLine], {}),
            serviceCollection,
            generatedSchedules: [
                // time between trips too high, loop trips
                buildLoopTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1, path_id: loopPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 1, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2, path_id: loopPath.getId() }
                ]),
                // This schedule is acceptable
                buildLoopTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1, path_id: loopPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 - 10, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 + 2, path_id: loopPath.getId() }
                ]),
                // minimum time between trips too low
                buildLoopTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1, path_id: loopPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 - 10, arrival_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 + 2, path_id: loopPath.getId() }
                ])
            ],
            expectations: ({ lineServices, services }: { lineServices: LineServices; services: ServiceCollection }) => {
                // 1 existing + 1 new generated feature
                expect(services.getFeatures().length).toEqual(2);
                expect(lineServices[loopLine.getId()]).toBeDefined();
                expect(Object.keys(lineServices).length).toEqual(1);
                expect(lineServices[loopLine.getId()][0]).toBeDefined();
                expect(lineServices[loopLine.getId()].length).toEqual(1);
            }
        },
        {
            name: 'Validate bounds on time between passages',
            lineCollection: new LineCollection([line], {}),
            serviceCollection,
            generatedSchedules: [
                // time between passages is exactly the maximum time between passages, so acceptable
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() },
                    { departure_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60, arrival_time_seconds: 6 * 60 * 60 + maxTimeBetweenPassages * 60 }
                ]),
                // minimum time between passages is exactly the minimum time between passages, so acceptable
                buildInboundOutboundTrips([
                    { departure_time_seconds: 6 * 60 * 60, arrival_time_seconds: 6 * 60 * 60 + 1 },
                    { departure_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60, arrival_time_seconds: 6 * 60 * 60 + minTimeBetweenPassages * 60 },
                    { departure_time_seconds: 6 * 60 * 60 + 10 * 60, arrival_time_seconds: 6 * 60 * 60 + 10 * 60 + 1, path_id: inboundPath.getId() }
                ])
            ],
            expectations: ({ lineServices, services }: { lineServices: LineServices; services: ServiceCollection }) => {
                // One existing feature + 2 new generated features
                expect(services.getFeatures().length).toEqual(3);
                // Find services by their names
                const service1Vehicle = services.getFeatures().find(s => s.attributes.name === `networkDesign_${line.toString()}_1`);
                const service2Vehicle = services.getFeatures().find(s => s.attributes.name === `networkDesign_${line.toString()}_2`);
                expect(service1Vehicle).toBeDefined();
                expect(service2Vehicle).toBeDefined(); 
                expect(service1Vehicle!.attributes).toEqual(expect.objectContaining({
                    name: `networkDesign_${line.toString()}_1`,
                    data: { forJob: jobId}
                }));
                expect(service2Vehicle!.attributes).toEqual(expect.objectContaining({
                    name: `networkDesign_${line.toString()}_2`,
                    data: { forJob: jobId}
                }));

                // Validate line services
                expect(lineServices[line.getId()]).toBeDefined();
                const lineServicesForLine = lineServices[line.getId()];
                expect(lineServicesForLine.length).toEqual(2);
                expect(lineServicesForLine[0]).toEqual(expect.objectContaining({
                    service: expect.objectContaining({
                        _attributes: expect.objectContaining({
                            name: `networkDesign_${line.toString()}_1`,
                            data: { forJob: jobId}
                        })
                    }),
                    numberOfVehicles: 1
                }));
                expect(lineServicesForLine[1]).toEqual(expect.objectContaining({
                    service: expect.objectContaining({
                        _attributes: expect.objectContaining({
                            name: `networkDesign_${line.toString()}_2`,
                            data: { forJob: jobId}
                        })
                    }),
                    numberOfVehicles: 2
                }));
            }
        },
    ];

    test.each(testCases)('$name', async({ lineCollection, serviceCollection, generatedSchedules, expectations }) => {
        generatedSchedules.forEach((schedule) => {
            mockedScheduleGeneration.mockReturnValueOnce(schedule);
        });
        const jobExecutor = await getJobExecutor(defaultJobParameters);
        const { lineServices, services } = await prepareServices(lineCollection, serviceCollection, jobExecutor);

        expect(mockedScheduleGeneration).toHaveBeenCalledTimes(generatedSchedules.length);
        expectations({ lineServices, services });
    });
});
