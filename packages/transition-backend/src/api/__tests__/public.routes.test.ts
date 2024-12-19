/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import express, { RequestHandler } from 'express';
import publicRoutes from '../public.routes';
import passport from 'passport'
import request from 'supertest';
import transitObjectDataHandlers from '../../services/transitObjects/TransitObjectsDataHandler';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import tokensDbQueries from 'chaire-lib-backend/lib/models/db/tokens.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { calculateAccessibilityMap, calculateRoute } from '../../services/routingCalculation/RoutingCalculator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import { TestUtils } from 'chaire-lib-common/lib/test';
import TrRoutingServiceBackend from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';

jest.mock('../../services/routingCalculation/RoutingCalculator');
jest.mock('transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting');
jest.mock('transition-common/lib/services/transitRouting/TransitRouting');
jest.mock('chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend', () => ({
    summary: jest.fn()
}));
jest.mock('passport');

const mockSummary = TrRoutingServiceBackend.summary as jest.MockedFunction<typeof TrRoutingServiceBackend.summary>;

const app = express();
app.use(express.json() as RequestHandler);
publicRoutes(app, passport);

beforeEach(() => {
    jest.clearAllMocks();

    (passport.authenticate as jest.Mock).mockImplementation(() => {
        return (req, res, next) => {
            next();
        };
    });
});

describe('Testing POST /token endpoint', () => {
    test('POST /token', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;

        const body = {
            usernameOrEmail: 'testuser',
            password: 'testpassword'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(200);
        expect(tokensDbQueries.getOrCreate).toHaveBeenCalledWith(body.usernameOrEmail);
    });

    test('POST /token, should return 500 when DB error', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => { throw new TrError('This is an error', 'ERRORCODE') }) as any;

        const body = {
            usernameOrEmail: 'testuser',
            password: 'testpassword'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(500);
        expect(tokensDbQueries.getOrCreate).toHaveBeenCalledWith(body.usernameOrEmail);
    });

    test('POST /token, should return 400 with empty user', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;
        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback();
            }
        });

        const body = {
            usernameOrEmail: '',
            password: 'testpassword'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(400);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });

    test('POST /token, should return 400 with missing user', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;
        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback();
            }
        });

        const body = {
            password: 'testpassword'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(400);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });

    test('POST /token, should return 400 with empty password', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;
        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback();
            }
        });

        const body = {
            usernameOrEmail: 'testuser',
            password: ''
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(400);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });

    test('POST /token, should return 400 with missing password', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;
        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback();
            }
        });

        const body = {
            usernameOrEmail: 'testuser'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(400);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });

    test('POST /token, should return 401 when unknown user', async () => {
        const error = 'UnknownUser';

        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;
        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error);
            }
        });

        const body = {
            usernameOrEmail: 'testuser',
            password: 'testpassword'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(401);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });

    test('POST /token, should return 401 when password does not match', async () => {
        const error = 'PasswordsDontMatch';

        tokensDbQueries.getOrCreate = jest.fn(() => Promise.resolve()) as any;
        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error);
            }
        });

        const body = {
            usernameOrEmail: 'testuser',
            password: 'testpassword'
        };
        const response = await request(app)
            .post('/token')
            .send(body);

        expect(response.status).toStrictEqual(401);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });
});

describe('Testing passport bearer-strategy middleware', () => {
    test('Should return 401 when token is expired', async () => {
        const error = 'DatabaseTokenExpired';

        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error);
            }
        });

        const response = await request(app).get('/api/v1');

        expect(response.status).toEqual(401);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });

    test('Should return 401 when token is invalid', async () => {
        const error1 = 'DatabaseNoUserMatchesProvidedToken';
        const error2 = 'DatabaseNoUserMatchesToken';
        const error3 = 'InvalidToken';

        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error1);
            }
        });

        const response1 = await request(app).get('/api/v1');

        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error2);
            }
        });

        const response2 = await request(app).get('/api/v1');

        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error3);
            }
        });

        const response3 = await request(app).get('/api/v1');

        expect(response1.status).toEqual(401);
        expect(response2.status).toEqual(401);
        expect(response3.status).toEqual(401);
        expect(passport.authenticate).toHaveBeenCalledTimes(3);
    });

    test('Should return 500 when other error is encountered', async () => {
        const error = 'testerror';

        (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
            return () => {
                callback(error);
            }
        });

        const response = await request(app).get('/api/v1');

        expect(response.status).toEqual(500);
        expect(passport.authenticate).toHaveBeenCalledTimes(1);
    });
});

describe('Testing API endpoints', () => {
    test('GET /api/v1/paths', async () => {
        const pathFeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[1, 2], [3, 4]]
                },
                properties: {
                    id: 'path1',
                    name: 'path1',
                    mode: 'mode1',
                    agency: 'agency1',
                    line: 'line1',
                    nodes: [],
                    line_id: 'line1',
                    data: { data: 'foo' },
                    direction: 'direction1'
                }
            }]
        };

        const expected = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: pathFeatureCollection.features[0].geometry,
                properties: {
                    id: 'path1',
                    name: 'path1',
                    mode: 'mode1',
                    nodes: [],
                    line_id: 'line1',
                    direction: 'direction1'
                }
            }]
        };

        transitObjectDataHandlers.paths.geojsonCollection! = jest.fn().mockResolvedValue(
            Status.createOk({
                type: 'geojson',
                geojson: pathFeatureCollection
            })
        );
        const response = await request(app).get('/api/v1/paths');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(expected);
        expect(transitObjectDataHandlers.paths.geojsonCollection!).toHaveBeenCalledWith();
    });

    test('GET /api/v1/nodes', async () => {
        const nodesFeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 'node1',
                geometry: {
                    type: 'LineString',
                    coordinates: [[1, 2], [3, 4]]
                },
                properties: {
                    id: 'node1',
                    name: 'node1',
                    code: 'nodecode',
                    is_enabled: true,
                    data: { data: 'foo' }
                }
            }]
        };

        const expected = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: nodesFeatureCollection.features[0].geometry,
                id: nodesFeatureCollection.features[0].id,
                properties: {
                    id: 'node1',
                    name: 'node1',
                    code: 'nodecode',
                    stops: []
                }
            }]
        };

        transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn().mockResolvedValue(
            Status.createOk({
                type: 'geojson',
                geojson: nodesFeatureCollection
            })
        );

        const response = await request(app).get('/api/v1/nodes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(expected);
        expect(transitObjectDataHandlers.nodes.geojsonCollection!).toHaveBeenCalledWith();
    });

    test('GET /api/v1/scenarios', async () => {
        const result = [{
            id: 'sc1',
            name: 'scenario1',
            services: ['s1', 's2'],
            only_agencies: [],
            except_agencies: [],
            only_lines: [],
            except_lines: [],
            only_modes: [],
            except_modes: [],
        }, {
            id: 'sc2',
            name: 'scenario2',
            services: ['s1', 's2'],
            only_agencies: ['ag1', 'ag2'],
            except_agencies: [],
            only_lines: [],
            except_lines: [],
            only_modes: [],
            except_modes: [],
        }];

        transitObjectDataHandlers.scenarios.collection! = jest.fn().mockResolvedValue({
            collection: result
        });

        const response = await request(app).get('/api/v1/scenarios');
        
        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.scenarios.collection!).toHaveBeenCalledWith(null);
    });

    test('GET /api/v1/agencies', async () => {
        const collection = [{
            id: 'ag1',
            name: 'agency1',
            acronym: 'AG1',
            line_ids: ['lineId1', 'lineId2'],
            data: { data: 'foo'}
        }, {
            id: 'ag2',
            name: 'agency2',
            acronym: 'AG2',
            line_ids: ['lineId3', 'lineId4'],
            data: { },
            description: 'A description'
        }]
        const result = [{
            id: collection[0].id,
            name: collection[0].name,
            acronym: collection[0].acronym
        }, {
            id: collection[1].id,
            name: collection[1].name,
            acronym: collection[1].acronym,
            description: collection[1].description
        }];

        transitObjectDataHandlers.agencies.collection! = jest.fn().mockResolvedValue({
            collection
        });

        const response = await request(app).get('/api/v1/agencies');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.agencies.collection!).toHaveBeenCalledWith(null);
    });

    test('GET /api/v1/services', async () => {
        const collection = [{
            id: 'serv1',
            name: 'Service 1',
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false
        }, {
            id: 'serv1',
            name: 'Service 1',
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
            start_date: '2024-02-01',
            end_date: '2024-12-19'
        }]

        const result = [{
            id: collection[0].id,
            name: collection[0].name
        }, {
            id: collection[1].id,
            name: collection[1].name
        }];

        transitObjectDataHandlers.services.collection! = jest.fn().mockResolvedValue({
            collection
        });

        const response = await request(app).get('/api/v1/services');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.services.collection!).toHaveBeenCalledWith(null);
    });

    test('GET /api/v1/lines', async () => {
     
        const collection = [{
            id: 'lineId1',
            shortname: 'Line 1',
            longname: 'Line 1 Long Name',
            agency_id: 'ag1',
            mode: 'bus',
            path_ids: ['path1'],
            category: 'C',
            allow_same_line_transfers: true,
            is_autonomous: false
        }, {
            id: 'lineId2',
            shortname: 'Line 2',
            longname: 'Line 2 Long Name',
            agency_id: 'ag2',
            mode: 'bus',
            path_ids: ['path2', 'path3'],
            category: 'B',
            allow_same_line_transfers: false,
            is_autonomous: false
        }]

        const result = [{
            id: collection[0].id,
            name: collection[0].shortname,
            longname: collection[0].longname,
            agency_id: collection[0].agency_id,
            mode: collection[0].mode,
            category: collection[0].category
        }, {
            id: collection[1].id,
            name: collection[1].shortname,
            longname: collection[1].longname,
            agency_id: collection[1].agency_id,
            mode: collection[1].mode,
            category: collection[1].category
        }];

        transitObjectDataHandlers.lines.collection! = jest.fn().mockResolvedValue({
            collection
        });

        const response = await request(app).get('/api/v1/lines');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.lines.collection!).toHaveBeenCalledWith(null);
    });

    test('POST /api/v1/summary', async () => {
        const attributes = { 
            originGeojson: TestUtils.makePoint([1, 2]),
            destinationGeojson: TestUtils.makePoint([3, 4]),
            scenarioId: 'ID',
            arrivalTimeSecondsSinceMidnight: 0,
        };

        const result = {
            status: 'query_error' as const,
            errorCode: 'INVALID_DESTINATION' as const
        };

        mockSummary.mockResolvedValueOnce(result);

        const response = await request(app).post('/api/v1/summary').send(attributes);
        
        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(mockSummary).toHaveBeenCalled();
    });

    test('GET /api/v1/routing-modes', async () => {
        osrmProcessManager.availableRoutingModes = jest.fn().mockResolvedValue(['walking', 'driving']);
        const response = await request(app).get('/api/v1/routing-modes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(['walking', 'driving', 'transit']);
        expect(osrmProcessManager.availableRoutingModes).toHaveBeenCalled();
    });

    describe('/api/v1/accessibility', () => {

        const mockedCalculateAccessibilityMap = calculateAccessibilityMap as jest.MockedFunction<typeof calculateAccessibilityMap>;

        const resultByNode = {
            type: 'nodes' as const,
            nodes: [{
                departureTime: '10:00',
                departureTimeSeconds: 36000,
                id: 'n1',
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 900
            }, {
                departureTime: '10:01',
                departureTimeSeconds: 36060,
                id: 'n2',
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 960
            }]
        };

        test('POST /api/v1/accessibility, without geojson', async () => {
            const calculationResult = { resultByNode };

            const location = [-73.567, 45.501];
            const scenarioId = 'sc1';
            const attributes = {
                locationGeojson: { type:'Feature',geometry:{type:'Point',coordinates: location } },
                scenarioId
            };

            const expectedOutput = {
                result: {
                    nodes: resultByNode.nodes
                },
                query: {
                    // Default values for most of the query
                    maxTotalTravelTimeSeconds: 900,
                    numberOfPolygons: 1,
                    deltaSeconds: 0,
                    deltaIntervalSeconds: 60,
                    locationGeojson: { type: 'Feature', geometry: { type: 'Point', coordinates: _cloneDeep(location) }, properties: {} },
                    minWaitingTimeSeconds: 180,
                    maxAccessEgressTravelTimeSeconds: 900,
                    maxTransferTravelTimeSeconds: 900,
                    walkingSpeedMps: 5.0 / 3.6,
                    scenarioId,
                }
            };

            const mockTransitAccessibilityMapRouting = {
                validate: () => true
            };

            mockedCalculateAccessibilityMap.mockResolvedValue(calculationResult);
            (TransitAccessibilityMapRouting as any).mockImplementation(() => mockTransitAccessibilityMapRouting);

            const response = await request(app)
                .post('/api/v1/accessibility?withGeojson=false')
                .send(attributes);

            expect(response.status).toStrictEqual(200);
            expect(response.body).toStrictEqual(expectedOutput);
            expect(calculateAccessibilityMap).toHaveBeenCalledWith(mockTransitAccessibilityMapRouting, false);
            expect(TransitAccessibilityMapRouting).toHaveBeenCalled();
        });

        test('POST /api/v1/accessibility, with geojson', async () => {
            const calculationResult = {
                resultByNode,
                polygons: {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Polygon', coordinates: [[0,0], [1,1], [1,0], [0,0]]},
                        properties: {
                            durationSeconds: 900,
                            areaSqM: 1000,
                            otherProperty: 'foo'
                        }
                    }]
                },
                strokes: { type: 'FeatureCollection', features: [] }
            };

            const location = [-73.567, 45.501];
            const scenarioId = 'sc1';
            const attributes = {
                locationGeojson: { type:'Feature',geometry:{ type:'Point', coordinates: _cloneDeep(location) } },
                scenarioId
            };

            const expectedOutput = {
                result: {
                    nodes: resultByNode.nodes,
                    polygons: {
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: _cloneDeep(calculationResult.polygons.features[0].geometry),
                            properties: {
                                durationSeconds: 900,
                                areaSqM: 1000
                            }
                        }]
                    }
                },
                query: {
                    // Default values for most of the query
                    maxTotalTravelTimeSeconds: 900,
                    numberOfPolygons: 1,
                    deltaSeconds: 0,
                    deltaIntervalSeconds: 60,
                    locationGeojson: { type: 'Feature', geometry: { type: 'Point', coordinates: _cloneDeep(location) }, properties: {} },
                    minWaitingTimeSeconds: 180,
                    maxAccessEgressTravelTimeSeconds: 900,
                    maxTransferTravelTimeSeconds: 900,
                    walkingSpeedMps: 5.0 / 3.6,
                    scenarioId,
                }
            };

            const mockTransitAccessibilityMapRouting = {
                validate: () => true
            };

            mockedCalculateAccessibilityMap.mockResolvedValue(calculationResult);
            (TransitAccessibilityMapRouting as any).mockImplementation(() => mockTransitAccessibilityMapRouting);

            const response = await request(app)
                .post('/api/v1/accessibility?withGeojson=true')
                .send(attributes);

            expect(response.status).toStrictEqual(200);
            expect(response.body).toStrictEqual(expectedOutput);
            expect(mockedCalculateAccessibilityMap).toHaveBeenCalledWith(mockTransitAccessibilityMapRouting, true);
            expect(TransitAccessibilityMapRouting).toHaveBeenCalled();
        });

        test('POST /api/v1/accessibility, without locationGeojson', async () => {
            const scenarioId = 'sc1';
            const attributes = {
                scenarioId
            };

            const response = await request(app)
                .post('/api/v1/accessibility')
                .send(attributes);

            expect(response.status).toStrictEqual(400);
            expect(mockedCalculateAccessibilityMap).not.toHaveBeenCalled();
        });

        test('POST /api/v1/accessibility, routing validation fails', async () => {
            const location = [-73.567, 45.501];
            const scenarioId = 'sc1';
            const attributes = {
                locationGeojson: { type:'Feature',geometry:{type:'Point',coordinates: _cloneDeep(location) } },
                scenarioId
            };

            const mockTransitAccessibilityMapRouting = {
                validate: () => false,
                errors: []
            };

            (TransitAccessibilityMapRouting as any).mockImplementation(() => mockTransitAccessibilityMapRouting);

            const response = await request(app)
                .post('/api/v1/accessibility?withGeojson=true')
                .send(attributes);

            expect(response.status).toStrictEqual(400);
            expect(mockedCalculateAccessibilityMap).not.toHaveBeenCalled();
        });

        test('POST /api/v1/accessibility, with error', async () => {
            const location = [-73.567, 45.501];
            const scenarioId = 'sc1';
            const attributes = {
                locationGeojson: { type:'Feature',geometry:{type:'Point',coordinates: location } },
                scenarioId
            };

            const mockTransitAccessibilityMapRouting = {
                validate: () => true
            };

            mockedCalculateAccessibilityMap.mockRejectedValue('error calculating accessibility map');
            (TransitAccessibilityMapRouting as any).mockImplementation(() => mockTransitAccessibilityMapRouting);

            const response = await request(app)
                .post('/api/v1/accessibility')
                .send(attributes);

            expect(response.status).toStrictEqual(500);
            expect(calculateAccessibilityMap).toHaveBeenCalled();
        });
    });

    describe('/api/v1/route', () => {
        const mockedCalculateRoute = calculateRoute as jest.MockedFunction<typeof calculateRoute>;

        const result = {
            walking: {
                routingMode: 'walking' as const,
                origin: TestUtils.makePoint([1, 2]),
                destination: TestUtils.makePoint([3, 4]),
                paths: [ {
                   distance: 150,
                   duration: 60,
                   legs: [],
                   geometry: { type: 'LineString' as const, coordinates: [[1, 2], [3, 4]] }
                }]
            }
        };

        const attributes = {
            originGeojson: TestUtils.makePoint([1, 2]),
            destinationGeojson: TestUtils.makePoint([3, 4]),
            routingModes: ['walking']
        };

        beforeEach(() => {
            jest.clearAllMocks();
        })

        test('POST /api/v1/route, without geojson', async () => {
            const expectedOutput = {
                result: {
                    walking: {
                        paths: [{
                            geometry: _cloneDeep(result.walking.paths[0].geometry),
                            distanceMeters: result.walking.paths[0].distance,
                            travelTimeSeconds: result.walking.paths[0].duration
                        }]
                    }
                },
                query: {
                    routingModes: ['walking'],
                    originGeojson: { ...attributes.originGeojson, properties: { location: 'origin' } },
                    destinationGeojson: { ...attributes.destinationGeojson, properties: { location: 'destination' } },
                    // Default values for most of the query
                    withAlternatives: false
                }
            }

            mockedCalculateRoute.mockResolvedValueOnce(result);

            const response = await request(app).post('/api/v1/route?withGeojson=false').send(_cloneDeep(attributes));

            expect(response.status).toStrictEqual(200);
            expect(response.body).toStrictEqual(expectedOutput);
            expect(mockedCalculateRoute).toHaveBeenCalledWith(expect.objectContaining({ ...attributes, timeSecondsSinceMidnight: 0, timeType: 'departure' }), false);
        });

        test('POST /api/v1/route, with geojson', async () => {

            const resultWithGeojson = {
                walking: {
                    ...result.walking,
                    pathsGeojson: [
                        {
                            type: 'FeatureCollection' as const,
                            features: [
                                { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: [[1, 2], [3, 4]] }, properties: {} }
                            ]
                        }
                    ]
                }
            };

            const expectedOutput = {
                result: {
                    walking: {
                        paths: [{
                            geometry: _cloneDeep(result.walking.paths[0].geometry),
                            distanceMeters: result.walking.paths[0].distance,
                            travelTimeSeconds: result.walking.paths[0].duration
                        }],
                        pathsGeojson: _cloneDeep(resultWithGeojson.walking.pathsGeojson)
                    }
                },
                query: {
                    routingModes: ['walking'],
                    originGeojson: { ...attributes.originGeojson, properties: { location: 'origin' } },
                    destinationGeojson: { ...attributes.destinationGeojson, properties: { location: 'destination' } },
                    // Default values for most of the query
                    withAlternatives: false
                }
            }

            mockedCalculateRoute.mockResolvedValueOnce(resultWithGeojson);

            const response = await request(app).post('/api/v1/route?withGeojson=true').send(_cloneDeep(attributes));

            expect(response.status).toStrictEqual(200);
            expect(response.body).toStrictEqual(expectedOutput);
            expect(mockedCalculateRoute).toHaveBeenCalledWith(expect.objectContaining({ ...attributes, timeSecondsSinceMidnight: 0, timeType: 'departure' }), true);
        });

        test('POST /api/v1/route, without origin/destination', async () => {
            const mockTransitRouting = {
                originDestinationToGeojson: () => ({
                    features: {
                        length: 0
                    }
                })
            };

            (TransitRouting as any).mockImplementation(() => mockTransitRouting);

            const response = await request(app).post('/api/v1/route').send({ routingModes: ['walking']});

            expect(response.status).toStrictEqual(400);
            expect(mockedCalculateRoute).not.toHaveBeenCalled();
        });

        test('POST /api/v1/route, routing validation fails', async () => {
            const mockTransitRouting = {
                originDestinationToGeojson: () => ({
                    features: {
                        length: 2
                    }
                }),
                validate: () => false,
                errors: []
            };

            (TransitRouting as any).mockImplementation(() => mockTransitRouting);

            const response = await request(app).post('/api/v1/route').send({...attributes, withAlternatives: 'not a bool'});

            expect(response.status).toStrictEqual(400);
            expect(mockedCalculateRoute).not.toHaveBeenCalled();
        });

        test('POST /api/v1/route, with error', async () => {
            const mockTransitRouting = {
                originDestinationToGeojson: () => ({
                    features: {
                        length: 2
                    }
                }),
                validate: () => true
            };

            mockedCalculateRoute.mockRejectedValueOnce('error calculating route');
            (TransitRouting as any).mockImplementation(() => mockTransitRouting);

            const response = await request(app).post('/api/v1/route').send(_cloneDeep(attributes));

            expect(response.status).toStrictEqual(500);
            expect(mockedCalculateRoute).toHaveBeenCalled();
        });
    });

    test('/api/v1/version endpoint', async () => {

        const response = await request(app).get('/api/versions');

        expect(response.status).toStrictEqual(200);
        // Hard-code the return value to make sure we update this test when we update the version and don't simply mock something
        // It's also a reminder to update the version in the API.yml file and make sure it matches ;-)
        expect(response.body).toStrictEqual(['1.1']);
    });

    test('404 for unexisting endpoints', async () => {

        const response = await request(app).get('/api/v1/doesNotExist');

        expect(response.status).toStrictEqual(404);
    });
});
