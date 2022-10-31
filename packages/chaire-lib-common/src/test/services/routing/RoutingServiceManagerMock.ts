/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    RoutingService,
    MapMatchingResults,
    MapMatchParameters,
    RouteResults,
    TableFromParameters,
    TableToParameters,
    TableResults
} from '../../../services/routing/RoutingService';
import { RoutingServiceManager } from '../../../services/routing/RoutingServiceManager';

// Types of the RoutingService methods. If the signature changes, this needs to
// be updated here too, otherwise tests may fail (or worse, succeed) without
// explanation.
type mockMapMatchType = jest.MockedFunction<(params: MapMatchParameters) => Promise<MapMatchingResults>>;
type mockRouteType = jest.MockedFunction<(params: MapMatchParameters) => Promise<RouteResults>>;
type mockTableFromType = jest.MockedFunction<(params: TableFromParameters) => Promise<TableResults>>;
type mockTableToType = jest.MockedFunction<(params: TableToParameters) => Promise<TableResults>>;

const createMapMatchMock: () => mockMapMatchType = () => {
    const mockMapMatch: mockMapMatchType = jest.fn();
    mockMapMatch.mockImplementation(async (_params) => {
        return {
            tracepoints: [],
            matchings: []
        };
    });
    return mockMapMatch;
};

const createRouteMock: () => mockRouteType = () => {
    const mockMapMatch: mockRouteType = jest.fn();
    mockMapMatch.mockImplementation(async (_params) => {
        return {
            waypoints: [],
            routes: []
        };
    });
    return mockMapMatch;
};

const createTableFromMock: () => mockTableFromType = () => {
    const mockTableFrom: mockTableFromType = jest.fn();
    mockTableFrom.mockImplementation(async (_params) => {
        return {
            query: '',
            distances: [],
            durations: []
        };
    });
    return mockTableFrom;
};

const createTableToMock: () => mockTableToType = () => {
    const mockTableFrom: mockTableToType = jest.fn();
    mockTableFrom.mockImplementation(async (_params) => {
        return {
            query: '',
            distances: [],
            durations: []
        };
    });
    return mockTableFrom;
};

interface MockRoutingService extends RoutingService {
    route: mockRouteType;
    mapMatch: mockMapMatchType;
    tableFrom: mockTableFromType;
    tableTo: mockTableToType;
}

/**
 * This class mocks the main routing service manager. It creates a few specific
 * routing service objects and adds strong typing so that consumer tests can
 * easily access the mock methods and change the return values as they wish,
 * with type safety.
 */
class RoutingServiceManagerMock implements RoutingServiceManager {
    private _defaultService: MockRoutingService;
    private _routingServices: { [key: string]: MockRoutingService };

    constructor() {
        // FIXME Do not configure in this class, as some apps could add engines,
        // use different services for same engine, etc
        this._defaultService = {
            route: createRouteMock(),
            mapMatch: createMapMatchMock(),
            tableFrom: createTableFromMock(),
            tableTo: createTableToMock()
        };
        const osrmService = {
            route: createRouteMock(),
            mapMatch: createMapMatchMock(),
            tableFrom: createTableFromMock(),
            tableTo: createTableToMock()
        };
        this._routingServices = {
            manual: this._defaultService,
            engine: osrmService,
            engineCustom: osrmService
        };
    }

    public getRoutingServiceForEngine = (engine: string): MockRoutingService => {
        const service = this._routingServices[engine];
        return service ? service : this._defaultService;
    };

    public mockClear() {
        this._defaultService.route.mockClear();
        this._defaultService.mapMatch.mockClear();
        this._routingServices.engine.route.mockClear();
        this._routingServices.engine.mapMatch.mockClear();
    }
}

const routingServiceManagerMock = new RoutingServiceManagerMock();
const enableMocks = () => {
    jest.mock('../../../../lib/services/routing/RoutingServiceManager', () => routingServiceManagerMock);
};

const mockClear = () => {
    routingServiceManagerMock.mockClear();
};

export default {
    enableMocks,
    mockClear,
    routingServiceManagerMock
};
