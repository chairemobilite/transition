/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { lineString as turfLineString } from '@turf/helpers';

import { saveAndUpdateAllNodes, saveAllNodesToCache } from '../../nodes/NodeCollectionUtils';

import { recreateCache } from '../dbToCache';
import { EventManagerMock } from 'chaire-lib-common/lib/test';
import transitLinesDbQueries from '../../../models/db/transitLines.db.queries';
import transitNodesDbQueries from '../../../models/db/transitNodes.db.queries';
import transitPathsDbQueries from '../../../models/db/transitPaths.db.queries';
import transitScenariosDbQueries from '../../../models/db/transitScenarios.db.queries';
import transitAgenciesDbQueries from '../../../models/db/transitAgencies.db.queries';
import transitServicesDbQueries from '../../../models/db/transitServices.db.queries';
import dataSourcesDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import placesDbQueries from '../../../models/db/places.db.queries';

//serviceLocator.socketEventManager = new EventEmitter();

// Mock data sources
const dataSourceAttributes = {
    id: uuidV4(),
    shortname: 'new_test_data_source',
    type: 'transitSmartCardData' as const,
    name: 'new test data source',
    description: "description for new test data source",
    is_frozen: true,
    data: {
      foo: 'bar',
      bar: 'foo'
    }
};
jest.mock('chaire-lib-backend/lib/models/db/dataSources.db.queries', () => ({
    collection: jest.fn().mockImplementation(async () => [dataSourceAttributes])
}));
const mockedDataSourceDbCollection = dataSourcesDbQueries.collection as jest.MockedFunction<typeof dataSourcesDbQueries.collection>;
const mockedDsToCache = jest.fn();
jest.mock('../../../models/capnpCache/dataSources.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => {
            return mockedDsToCache(collection, cachePath);
        })
    }
});

// Mock agencies
const agencyAttributes = {  
    id           : uuidV4(),
    internal_id  : 'internalTestId',
    acronym      : 'ATEST',
    name         : 'Agency test',
    is_frozen    : false,
    is_enabled   : true,
    color        : '#ffffff',
    description  : null,
    simulation_id: null,
    data         : {
      foo: 'bar',
      bar: 'foo'
    }
};
jest.mock('../../../models/db/transitAgencies.db.queries', () => ({
    collection: jest.fn().mockImplementation(async () => [agencyAttributes])
}));
const mockedAgencyDbCollection = transitAgenciesDbQueries.collection as jest.MockedFunction<typeof transitAgenciesDbQueries.collection>;
const mockedAgToCache = jest.fn();
jest.mock('../../../models/capnpCache/transitAgencies.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => {
            return mockedAgToCache(collection, cachePath);
        })
    }
});

// Mock services
const serviceAttributes = {  
    id           : uuidV4(),
    name         : 'Service test',
    internal_id  : 'internalIdTest1',
    is_frozen    : false,
    is_enabled   : true,
    monday       : true,
    tuesday      : true,
    wednesday    : true,
    thursday     : true,
    friday       : true,
    saturday     : false,
    sunday       : false,
    start_date   : '2019-01-01',
    end_date     : '2019-03-09',
    only_dates   : [],
    except_dates : ['2019-02-02'],
    color        : '#ffffff',
    description  : null,
    simulation_id: null,
    scheduled_lines: [],
    data         : {
        foo: 'bar',
        bar: 'foo',
        variables: {}
    }
};
jest.mock('../../../models/db/transitServices.db.queries', () => ({
    collection: jest.fn().mockImplementation(async () => [serviceAttributes])
}));
const mockedServiceDbCollection = transitServicesDbQueries.collection as jest.MockedFunction<typeof transitServicesDbQueries.collection>;
const mockedServiceToCache = jest.fn();
jest.mock('../../../models/capnpCache/transitServices.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => {
            return mockedServiceToCache(collection, cachePath);
        })
    }
});

// Mock scenarios
const scenarioAttributes = {  
    id             : uuidV4(),
    name           : 'Scenario test',
    is_frozen      : false,
    is_enabled     : true,
    services       : [uuidV4(), uuidV4()],
    only_agencies  : [uuidV4(), uuidV4()],
    only_lines     : [uuidV4(), uuidV4(), uuidV4()],
    only_nodes     : [uuidV4()],
    only_modes     : [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    except_agencies: [],
    except_lines   : [],
    except_nodes   : [],
    except_modes   : [],
    color          : '#ffffff',
    description    : null,
    simulation_id  : null,
    data           : {
        foo: 'bar',
        bar: 'foo'
    }
};
jest.mock('../../../models/db/transitScenarios.db.queries', () => ({
    collection: jest.fn().mockImplementation(async () => [scenarioAttributes])
}));
const mockedScenarioDbCollection = transitScenariosDbQueries.collection as jest.MockedFunction<typeof transitScenariosDbQueries.collection>;
const mockedScenariosToCache = jest.fn();
jest.mock('../../../models/capnpCache/transitScenarios.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => {
            return mockedScenariosToCache(collection, cachePath);
        })
    }
});

// Mock lines
const lineAttributes = {  
    id: uuidV4(),
    internal_id : 'InternalId test 1',
    is_frozen: false,
    is_enabled: true,
    agency_id: uuidV4(),
    shortname: '1',
    longname: 'Name',
    module: 'bus' as const,
    category: 'C+' as const,
    allow_same_line_transfers: false,
    color: '#ffffff',
    description: null,
    is_autonomous: false,
    scheduleByServiceId: { },
    data: {
        foo: 'bar',
        bar: 'foo'
    }
};
jest.mock('../../../models/db/transitLines.db.queries', () => ({
    collection: jest.fn().mockImplementation(async () => [lineAttributes]),
    // This method adds schedules to lines, we don't really need them here, just do nothing
    collectionWithSchedules: jest.fn().mockResolvedValue(undefined)
}));
const mockedLineDbCollection = transitLinesDbQueries.collection as jest.MockedFunction<typeof transitLinesDbQueries.collection>;
const mockedLinesWithSchedules = transitLinesDbQueries.collectionWithSchedules as jest.MockedFunction<typeof transitLinesDbQueries.collectionWithSchedules>;
const mockedLinesToCache = jest.fn();
const mockedObjectsToCache = jest.fn();
jest.mock('../../../models/capnpCache/transitLines.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => 
            mockedLinesToCache(collection, cachePath)
        ),
        objectsToCache: jest.fn().mockImplementation(async (collection, cachePath) => 
            mockedObjectsToCache(collection, cachePath)
        )
    }
});

// Mock nodes
const nodeAttributes = {  
    id: uuidV4(),
    code: '0001',
    name: 'NewNode 1',
    internal_id: 'Test1',
    integer_id: 1,
    color: '#ffff00',
    is_enabled: true,
    is_frozen: false,
    description: 'New node description',
    default_dwell_time_seconds: 25,
    routing_radius_meters: 50,
    data: {
        foo: 'bar',
        transferableNodes: {
            nodesIds: [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
            walkingTravelTimesSeconds: [125, 582, 654, 497, 115],
            walkingDistancesMeters: [145, 574, 944, 579, 157]
        }
    }
};
const nodeGeography = { type: 'Point' as const, coordinates: [-73.6, 45.5] };
const nodeGeojson = {
    type: 'FeatureCollection' as const,
    features: [{
        type: 'Feature' as const,
        properties: nodeAttributes,
        geometry: nodeGeography
    }]
};
jest.mock('../../../models/db/transitNodes.db.queries', () => ({
    geojsonCollection: jest.fn().mockImplementation(async () => nodeGeojson)
}));
const mockedNodeDbGeojsonCollection = transitNodesDbQueries.geojsonCollection as jest.MockedFunction<typeof transitNodesDbQueries.geojsonCollection>;

jest.mock('../../../models/db/places.db.queries', () => ({
    geojsonCollection: jest.fn().mockResolvedValue({ type: 'FeatureCollection', features: []})
}));
const mockedPlaceDbGeojsonCollection = placesDbQueries.geojsonCollection as jest.MockedFunction<typeof placesDbQueries.geojsonCollection>;
jest.mock('../../nodes/NodeCollectionUtils');
const mockedSaveAndUpdateAllNodes = saveAndUpdateAllNodes as jest.MockedFunction<typeof saveAndUpdateAllNodes>;
const mockedSaveAllNodesToCache = saveAllNodesToCache as jest.MockedFunction<typeof saveAllNodesToCache>;
const mockedNodesToCache = jest.fn();
jest.mock('../../../models/capnpCache/transitNodes.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => {
            return mockedNodesToCache(collection, cachePath);
        })
    }
});

// Mock paths
const pathAttributes = {  
    id          : uuidV4(),
    internal_id : 'InternalId test 1',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : uuidV4(),
    name        : 'South',
    direction   : 'outbound',
    description : null,
    integer_id  : 1,
    nodes       : [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 23, 45, 65, 78],
    data        : {
        defaultAcceleration: 1.0,
        defaultDeceleration: 1.0,
        defaultRunningSpeedKmH: 20,
        maxRunningSpeedKmH: 100,
        routingEngine: 'engine',
        routingMode: 'bus',
        foo: 'bar',
        bar: 'foo',
        nodeTypes: [
            "engine",
            "engine",
            "engine",
            "engine",
            "engine",
            "engine"
        ]
    }
};
const pathGeography = turfLineString([[-73.6, 45.5], [-73.5, 45.6], [-73.5, 45.4]]).geometry;
const pathGeojson = {
    type: 'FeatureCollection' as const,
    features: [{
        type: 'Feature' as const,
        properties: pathAttributes,
        geometry: pathGeography
    }]
};
jest.mock('../../../models/db/transitPaths.db.queries', () => ({
    geojsonCollection: jest.fn().mockImplementation(async () => pathGeojson)
}));
const mockedPathDbGeojsonCollection = transitPathsDbQueries.geojsonCollection as jest.MockedFunction<typeof transitPathsDbQueries.geojsonCollection>;
const mockedPathToCache = jest.fn();
jest.mock('../../../models/capnpCache/transitPaths.cache.queries', () => {
    return {
        collectionToCache: jest.fn().mockImplementation(async (collection, cachePath) => {
            return mockedPathToCache(collection, cachePath);
        })
    }
});

describe('Recreate cache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('no refresh nodes, no schedules', async () => {
        await recreateCache({refreshTransferrableNodes: false, saveLines: false});
        expect(mockedDataSourceDbCollection).toHaveBeenCalled();
        expect(mockedDsToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(dataSourceAttributes)})]
        }), undefined);
        expect(mockedAgencyDbCollection).toHaveBeenCalled();
        expect(mockedAgToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(agencyAttributes)})]
        }), undefined);
        expect(mockedServiceDbCollection).toHaveBeenCalled();
        expect(mockedServiceToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(serviceAttributes)})]
        }), undefined);
        expect(mockedScenarioDbCollection).toHaveBeenCalled();
        expect(mockedScenariosToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(scenarioAttributes)})]
        }), undefined);
        expect(mockedPathDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedPathToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: pathAttributes,
                geometry: pathGeography
            })]
        }), undefined);
        expect(mockedLineDbCollection).toHaveBeenCalled();
        expect(mockedLinesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]
        }), undefined);
        expect(mockedLinesWithSchedules).not.toHaveBeenCalled();
        expect(mockedObjectsToCache).not.toHaveBeenCalled();

        expect(mockedNodeDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedNodesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), undefined);
        expect(mockedSaveAndUpdateAllNodes).not.toHaveBeenCalled();
        expect(mockedSaveAllNodesToCache).toHaveBeenLastCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), expect.anything(), undefined);
    });

    test('refresh nodes, no schedules', async () => {
        await recreateCache({refreshTransferrableNodes: true, saveLines: false});
        expect(mockedDataSourceDbCollection).toHaveBeenCalled();
        expect(mockedDsToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(dataSourceAttributes)})]
        }), undefined);
        expect(mockedAgencyDbCollection).toHaveBeenCalled();
        expect(mockedAgToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(agencyAttributes)})]
        }), undefined);
        expect(mockedServiceDbCollection).toHaveBeenCalled();
        expect(mockedServiceToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(serviceAttributes)})]
        }), undefined);
        expect(mockedScenarioDbCollection).toHaveBeenCalled();
        expect(mockedScenariosToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(scenarioAttributes)})]
        }), undefined);
        expect(mockedPathDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedPathToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: pathAttributes,
                geometry: pathGeography
            })]
        }), undefined);
        expect(mockedLineDbCollection).toHaveBeenCalled();
        expect(mockedLinesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]
        }), undefined);
        expect(mockedLinesWithSchedules).not.toHaveBeenCalled();
        expect(mockedObjectsToCache).not.toHaveBeenCalled();

        expect(mockedNodeDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedNodesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), undefined);
        expect(mockedSaveAndUpdateAllNodes).toHaveBeenLastCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), expect.anything(), EventManagerMock.eventManagerMock, expect.anything(), undefined);
        expect(mockedSaveAllNodesToCache).not.toHaveBeenCalled();
    });

    test('no refresh nodes, refresh schedules', async () => {
        await recreateCache({refreshTransferrableNodes: false, saveLines: true});
        expect(mockedDataSourceDbCollection).toHaveBeenCalled();
        expect(mockedDsToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(dataSourceAttributes)})]
        }), undefined);
        expect(mockedAgencyDbCollection).toHaveBeenCalled();
        expect(mockedAgToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(agencyAttributes)})]
        }), undefined);
        expect(mockedServiceDbCollection).toHaveBeenCalled();
        expect(mockedServiceToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(serviceAttributes)})]
        }), undefined);
        expect(mockedScenarioDbCollection).toHaveBeenCalled();
        expect(mockedScenariosToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(scenarioAttributes)})]
        }), undefined);
        expect(mockedPathDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedPathToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: pathAttributes,
                geometry: pathGeography
            })]
        }), undefined);

        // The line collection was spliced by the method to test, so we can't check the value, but the important in this test is the rest
        expect(mockedLineDbCollection).toHaveBeenCalled();
        expect(mockedLinesToCache).toHaveBeenCalledTimes(1);
        expect(mockedLinesWithSchedules).toHaveBeenCalledWith([expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]);
        expect(mockedObjectsToCache).toHaveBeenCalledWith(
            [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})],
            undefined
        );

        expect(mockedNodeDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedNodesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), undefined);
        expect(mockedSaveAndUpdateAllNodes).not.toHaveBeenCalled();
        expect(mockedSaveAllNodesToCache).toHaveBeenLastCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), expect.anything(), undefined);
    });

    test('refresh nodes and schedules', async () => {
        await recreateCache({refreshTransferrableNodes: true, saveLines: true});
        expect(mockedDataSourceDbCollection).toHaveBeenCalled();
        expect(mockedDsToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(dataSourceAttributes)})]
        }), undefined);
        expect(mockedAgencyDbCollection).toHaveBeenCalled();
        expect(mockedAgToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(agencyAttributes)})]
        }), undefined);
        expect(mockedServiceDbCollection).toHaveBeenCalled();
        expect(mockedServiceToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(serviceAttributes)})]
        }), undefined);
        expect(mockedScenarioDbCollection).toHaveBeenCalled();
        expect(mockedScenariosToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(scenarioAttributes)})]
        }), undefined);
        expect(mockedPathDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedPathToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: pathAttributes,
                geometry: pathGeography
            })]
        }), undefined);

        // The line collection was spliced by the method to test, so we can't check the value, but the important in this test is the rest
        expect(mockedLineDbCollection).toHaveBeenCalled();
        expect(mockedLinesToCache).toHaveBeenCalledTimes(1);
        expect(mockedLinesWithSchedules).toHaveBeenCalledWith([expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]);
        expect(mockedObjectsToCache).toHaveBeenCalledWith(
            [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})],
            undefined
        );

        expect(mockedNodeDbGeojsonCollection).toHaveBeenCalled();
        expect(mockedNodesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), undefined);
        expect(mockedSaveAndUpdateAllNodes).toHaveBeenCalledTimes(1);
        expect(mockedSaveAndUpdateAllNodes).toHaveBeenLastCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), expect.anything(), EventManagerMock.eventManagerMock, expect.anything(), undefined);
        expect(mockedSaveAllNodesToCache).not.toHaveBeenCalled();
    });
});
