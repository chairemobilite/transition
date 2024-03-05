/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express, { RequestHandler } from 'express';
import publicRoutes from '../public.routes';
import passport from 'passport'
import request from 'supertest';
import transitObjectDataHandlers from '../../services/transitObjects/TransitObjectsDataHandler';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import tokensDbQueries from 'chaire-lib-backend/lib/models/db/tokens.db.queries';
import trRoutingService from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';
import * as TrRoutingApi from 'chaire-lib-common/lib/api/TrRouting';
import osrm from 'osrm';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import osrmService from 'chaire-lib-backend/lib/utils/osrm/OSRMService';

// Mock passport (therefore ignoring authentication)
jest.mock('passport');
(passport.authenticate as jest.Mock).mockImplementation(() => {
    return (req, res, next) => {
        next();
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

test('Passport middleware setup', () => {
    publicRoutes(express(), passport);
    expect(passport.authenticate).toBeCalledTimes(2);
    expect(passport.authenticate).toBeCalledWith('local-login', {'failWithError': true, 'failureMessage': true});
    expect(passport.authenticate).toBeCalledWith('bearer-strategy', { session: false });
});

describe('Testing endpoints', () => {
    const app = express();
    app.use(express.json() as RequestHandler);
    publicRoutes(app, passport);

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

    test('GET /api/paths', async () => {
        transitObjectDataHandlers.paths.geojsonCollection! = jest.fn();

        const response = await request(app).get('/api/paths');

        expect(response.status).toStrictEqual(200);
        expect(transitObjectDataHandlers.paths.geojsonCollection!).toBeCalled();
    });

    test('GET /api/nodes', async () => {
        transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn();

        const response = await request(app).get('/api/nodes');

        expect(response.status).toStrictEqual(200);
        expect(transitObjectDataHandlers.nodes.geojsonCollection!).toBeCalled();
    });

    test('GET /api/scenarios', async () => {
        transitObjectDataHandlers.scenarios.collection! = jest.fn();

        const response = await request(app).get('/api/scenarios');
        
        expect(response.status).toStrictEqual(200);
        expect(transitObjectDataHandlers.scenarios.collection!).toBeCalledWith(null);
    });

    test('GET /api/routing-modes', async () => {
        osrmProcessManager.availableRoutingModes = jest.fn(() => Promise.resolve([]));

        const response = await request(app).get('/api/routing-modes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(['transit']);
        expect(osrmProcessManager.availableRoutingModes).toBeCalled();
    });

    describe('Testing endpoints', () => {
        const trRoutingServiceResult: TrRoutingApi.TrRoutingV2.RouteResponse = {
            status: 'success',
            query: {
                origin: [45, 45],
                destination: [45, 45],
                timeOfTrip: 1800,
                timeType: 0
            },
            result: {
                routes: [],
                totalRoutesCalculated: 1
            }
        }
        const routeResults: Status.Status<osrm.RouteResults> = {
            status: 'ok',
            result: {
                waypoints: [{
                    distance: 45,
                    name: "test",
                    location: [45, 45],
                    hint: "test"
                }],
                routes: []
            }
        }
        
        test('GET /api/route/:withGeometry? without optimal parameter', async () => {
            trRoutingService.route = jest.fn()
            osrmService.route = jest.fn()
    
            const response = await request(app).get('/api/route');
    
            expect(response.status).toStrictEqual(200);
            // expect(response.body).toStrictEqual(['transit']);
            expect(trRoutingService.route).toBeCalled();
            expect(osrmService.route).toBeCalled();
    
        });
    
        test('GET /api/route/:withGeometry? optimal parameter true', async () => {
            trRoutingService.route = jest.fn()
            osrmService.route = jest.fn()
    
            const response = await request(app).get('/api/route/true');
    
            expect(response.status).toStrictEqual(200);
            // expect(response.body).toStrictEqual(['transit']);
            expect(trRoutingService.route).toBeCalled();
            expect(osrmService.route).toBeCalled();
    
        }); 

        test('GET /api/route/:withGeometry? optimal parameter false', async () => {
            trRoutingService.route = jest.fn(() => Promise.resolve(trRoutingServiceResult))
            osrmService.route = jest.fn(() => Promise.resolve(routeResults))
    
            const response = await request(app).get('/api/route/false');
    
            expect(response.status).toStrictEqual(200);
            // expect(response.body).toStrictEqual(['transit']);
            expect(trRoutingService.route).toBeCalled();
            expect(osrmService.route).not.toBeCalled();
    
        }); 

    });
});
