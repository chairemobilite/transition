/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { lineString as turfLineString } from '@turf/helpers';

import { saveAndUpdateAllNodes, saveAllNodesToCache } from '../../nodes/NodeCollectionUtils';

import { 
    recreateCache,
    loadAndSaveDataSourcesToCache,
    loadAndSaveAgenciesToCache,
    loadAndSaveServicesToCache,
    loadAndSaveScenariosToCache,
    loadAndSaveLinesToCache,
    loadAndSaveLinesByIdsToCache,
    loadAndSaveNodesToCache,
    loadAndSavePathsToCache
} from '../dbToCache';
import { EventManagerMock } from 'chaire-lib-common/lib/test';
import transitLinesDbQueries from '../../../models/db/transitLines.db.queries';
import transitNodesDbQueries from '../../../models/db/transitNodes.db.queries';
import transitPathsDbQueries from '../../../models/db/transitPaths.db.queries';
import transitScenariosDbQueries from '../../../models/db/transitScenarios.db.queries';
import transitAgenciesDbQueries from '../../../models/db/transitAgencies.db.queries';
import transitServicesDbQueries from '../../../models/db/transitServices.db.queries';
import dataSourcesDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import placesDbQueries from '../../../models/db/places.db.queries';
import Line from 'transition-common/lib/services/line/Line';

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

describe('loadAndSaveDataSourcesToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { cachePathDirectory: undefined, expectedPath: undefined },
        { cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save data sources to cache with cachePathDirectory=$cachePathDirectory', async ({ cachePathDirectory, expectedPath }) => {
        await loadAndSaveDataSourcesToCache({ cachePathDirectory });
        expect(mockedDataSourceDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedDsToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(dataSourceAttributes)})]
        }), expectedPath);
        expect(mockedDsToCache).toHaveBeenCalledTimes(1);
    });
});

describe('loadAndSaveAgenciesToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { cachePathDirectory: undefined, expectedPath: undefined },
        { cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save agencies to cache with cachePathDirectory=$cachePathDirectory', async ({ cachePathDirectory, expectedPath }) => {
        await loadAndSaveAgenciesToCache(cachePathDirectory !== undefined ? { cachePathDirectory } : undefined);
        expect(mockedAgencyDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedAgToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(agencyAttributes)})]
        }), expectedPath);
        expect(mockedAgToCache).toHaveBeenCalledTimes(1);
    });
});

describe('loadAndSaveServicesToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { cachePathDirectory: undefined, expectedPath: undefined },
        { cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save services to cache with cachePathDirectory=$cachePathDirectory', async ({ cachePathDirectory, expectedPath }) => {
        await loadAndSaveServicesToCache(cachePathDirectory !== undefined ? { cachePathDirectory } : undefined);
        expect(mockedServiceDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedServiceToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(serviceAttributes)})]
        }), expectedPath);
        expect(mockedServiceToCache).toHaveBeenCalledTimes(1);
    });
});

describe('loadAndSaveScenariosToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { cachePathDirectory: undefined, expectedPath: undefined },
        { cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save scenarios to cache with cachePathDirectory=$cachePathDirectory', async ({ cachePathDirectory, expectedPath }) => {
        await loadAndSaveScenariosToCache(cachePathDirectory !== undefined ? { cachePathDirectory } : undefined);
        expect(mockedScenarioDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedScenariosToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(scenarioAttributes)})]
        }), expectedPath);
        expect(mockedScenariosToCache).toHaveBeenCalledTimes(1);
    });
});

describe('loadAndSaveLinesToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { saveIndividualLines: false },
        { saveIndividualLines: true }
    ])('should load and save lines collection to cache with saveIndividualLines=$saveIndividualLines', async ({ saveIndividualLines }) => {
        await loadAndSaveLinesToCache({ saveIndividualLines });
        // collection should be called with empty parameters
        expect(mockedLineDbCollection).toHaveBeenCalledWith();
        expect(mockedLinesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]
        }), undefined);
        expect(mockedLinesToCache).toHaveBeenCalledTimes(1);
        if (!saveIndividualLines) {
            expect(mockedLinesWithSchedules).not.toHaveBeenCalled();
            expect(mockedObjectsToCache).not.toHaveBeenCalled();
        } else {
            expect(mockedLinesWithSchedules).toHaveBeenCalledWith([expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]);
            expect(mockedObjectsToCache).toHaveBeenCalledWith(
                [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})],
                undefined
            );
        }
    });

    test.each([
        { saveIndividualLines: false, cachePathDirectory: undefined, expectedPath: undefined },
        { saveIndividualLines: true, cachePathDirectory: undefined, expectedPath: undefined },
        { saveIndividualLines: true, cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save lines with cachePathDirectory and saveIndividualLines=$saveIndividualLines', async ({ saveIndividualLines, cachePathDirectory, expectedPath }) => {
        const params: any = { saveIndividualLines };
        if (cachePathDirectory !== undefined) {
            params.cachePathDirectory = cachePathDirectory;
        }
        await loadAndSaveLinesToCache(params);
        // collection should be called with empty parameters
        expect(mockedLineDbCollection).toHaveBeenCalledWith();
        expect(mockedLinesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]
        }), expectedPath);
        if (saveIndividualLines) {
            expect(mockedObjectsToCache).toHaveBeenCalledWith(
                [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})],
                expectedPath
            );
        } else {
            expect(mockedObjectsToCache).not.toHaveBeenCalled();
        }
    });

    test('should save lines in chunks when collection is large', async () => {
        // Prepare test data with many lines
        const lineIds = Array.from({ length: 250 }, () => uuidV4());
        const linesAttributes = lineIds.map((lineId) => ({...lineAttributes, id: lineId}));
        const lines = linesAttributes.map((attributes) => new Line(attributes, false));
        mockedLineDbCollection.mockResolvedValueOnce(linesAttributes);

        // Save with individual lines
        await loadAndSaveLinesToCache({ saveIndividualLines: true });
        expect(mockedLineDbCollection).toHaveBeenCalledWith();
        // Should be called 3 times: 100 + 100 + 50
        expect(mockedLinesWithSchedules).toHaveBeenCalledTimes(3);
        // Verify the calls were made with correct chunks (100 + 100 + 50)
        expect(mockedLinesWithSchedules).toHaveBeenNthCalledWith(1, lines.slice(0, 100));
        expect(mockedLinesWithSchedules).toHaveBeenNthCalledWith(2, lines.slice(100, 200));
        expect(mockedLinesWithSchedules).toHaveBeenNthCalledWith(3, lines.slice(200, 250));
        expect(mockedObjectsToCache).toHaveBeenCalledTimes(3);
    });
});

describe('loadAndSaveLinesByIdsToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { cachePathDirectory: undefined, expectedPath: undefined },
        { cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save specific lines by IDs to cache with cachePathDirectory=$cachePathDirectory', async ({ cachePathDirectory, expectedPath }) => {
        const lineIds = [uuidV4(), uuidV4()];
        const params: any = { lineIds };
        if (cachePathDirectory !== undefined) {
            params.cachePathDirectory = cachePathDirectory;
        }
        await loadAndSaveLinesByIdsToCache(params);
        expect(mockedLineDbCollection).toHaveBeenCalledWith(lineIds);
        expect(mockedLinesWithSchedules).toHaveBeenCalledWith([expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})]);
        expect(mockedObjectsToCache).toHaveBeenCalledWith(
            [expect.objectContaining({_attributes: expect.objectContaining(lineAttributes)})],
            expectedPath
        );
    });

    test('should not save anything when lineIds is empty', async () => {
        await loadAndSaveLinesByIdsToCache({ lineIds: [], cachePathDirectory: undefined });
        expect(mockedLineDbCollection).not.toHaveBeenCalled();
        expect(mockedLinesWithSchedules).not.toHaveBeenCalled();
        expect(mockedObjectsToCache).not.toHaveBeenCalled();
    });

    test('should save lines in chunks when many lineIds are provided', async () => {
        // Prepare test data with many lines
        const lineIds = Array.from({ length: 250 }, () => uuidV4());
        const linesAttributes = lineIds.map((lineId) => ({...lineAttributes, id: lineId}));
        const lines = linesAttributes.map((attributes) => new Line(attributes, false));
        mockedLineDbCollection.mockResolvedValueOnce(linesAttributes);

        await loadAndSaveLinesByIdsToCache({ lineIds, cachePathDirectory: undefined });
        expect(mockedLineDbCollection).toHaveBeenCalledWith(lineIds);
        // Should be called 3 times: 100 + 100 + 50
        expect(mockedLinesWithSchedules).toHaveBeenCalledTimes(3);
        // Verify the calls were made with correct chunks (100 + 100 + 50)
        expect(mockedLinesWithSchedules).toHaveBeenNthCalledWith(1, lines.slice(0, 100));
        expect(mockedLinesWithSchedules).toHaveBeenNthCalledWith(2, lines.slice(100, 200));
        expect(mockedLinesWithSchedules).toHaveBeenNthCalledWith(3, lines.slice(200, 250));
        expect(mockedObjectsToCache).toHaveBeenCalledTimes(3);
    });
});

describe('loadAndSaveNodesToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { refreshTransferrableNodes: false, cachePathDirectory: undefined, expectedPath: undefined },
        { refreshTransferrableNodes: true, cachePathDirectory: undefined, expectedPath: undefined },
        { refreshTransferrableNodes: false, cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save nodes to cache with refreshTransferrableNodes=$refreshTransferrableNodes and cachePathDirectory=$cachePathDirectory', async ({ refreshTransferrableNodes, cachePathDirectory, expectedPath }) => {
        const params: any = { refreshTransferrableNodes };
        if (cachePathDirectory !== undefined) {
            params.cachePathDirectory = cachePathDirectory;
        }
        await loadAndSaveNodesToCache(params);
        expect(mockedNodesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), expectedPath);
        if (refreshTransferrableNodes) {
            expect(mockedSaveAndUpdateAllNodes).toHaveBeenCalledTimes(1);
            expect(mockedSaveAllNodesToCache).not.toHaveBeenCalled();
        } else {
            expect(mockedSaveAndUpdateAllNodes).not.toHaveBeenCalled();
            expect(mockedSaveAllNodesToCache).toHaveBeenLastCalledWith(
                expect.anything(),
                expect.anything(),
                expectedPath
            );
        }
    });

    test('should load and save nodes to cache without parameters', async () => {
        await loadAndSaveNodesToCache();
        expect(mockedNodesToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: nodeAttributes,
                geometry: nodeGeography
            })]
        }), undefined);
        expect(mockedSaveAllNodesToCache).toHaveBeenCalledTimes(1);
        expect(mockedSaveAndUpdateAllNodes).not.toHaveBeenCalled();
    });
});

describe('loadAndSavePathsToCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { cachePathDirectory: undefined, expectedPath: undefined },
        { cachePathDirectory: '/custom/cache/path', expectedPath: '/custom/cache/path' }
    ])('should load and save paths to cache with cachePathDirectory=$cachePathDirectory', async ({ cachePathDirectory, expectedPath }) => {
        const params: any = {};
        if (cachePathDirectory !== undefined) {
            params.cachePathDirectory = cachePathDirectory;
        }
        await loadAndSavePathsToCache(params);
        expect(mockedPathToCache).toHaveBeenCalledWith(expect.objectContaining({
            _features: [expect.objectContaining({
                type: 'Feature' as const,
                properties: pathAttributes,
                geometry: pathGeography
            })]
        }), expectedPath);
        expect(mockedPathToCache).toHaveBeenCalledTimes(1);
    });
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
