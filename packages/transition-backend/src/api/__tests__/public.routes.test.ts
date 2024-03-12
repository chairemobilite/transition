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
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';

// Required to test POST /api/accessibility endpoint
jest.mock('transition-common/lib/services/nodes/NodeCollection');

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

    test('POST /token, should return 500 when DB error', async () => {
        tokensDbQueries.getOrCreate = jest.fn(() => {throw new TrError('This is an error', 'ERRORCODE')} ) as any;

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

    test('GET /api/paths', async () => {
        const result = 'pathsResult';

        transitObjectDataHandlers.paths.geojsonCollection! = jest.fn().mockResolvedValue(result);

        const response = await request(app).get('/api/paths');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.paths.geojsonCollection!).toBeCalled();
    });

    test('GET /api/nodes', async () => {
        const result = 'nodesResult';
        
        transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn().mockResolvedValue(result);

        const response = await request(app).get('/api/nodes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.nodes.geojsonCollection!).toBeCalled();
    });

    test('GET /api/scenarios', async () => {
        const result = 'scenariosResult';

        transitObjectDataHandlers.scenarios.collection! = jest.fn().mockResolvedValue(result);

        const response = await request(app).get('/api/scenarios');
        
        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.scenarios.collection!).toBeCalledWith(null);
    });

    test('GET /api/routing-modes', async () => {
        osrmProcessManager.availableRoutingModes = jest.fn().mockResolvedValue([]);

        const response = await request(app).get('/api/routing-modes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(['transit']);
        expect(osrmProcessManager.availableRoutingModes).toBeCalled();
    });

    test('POST /api/accessibility, without geometry', async () => {
        const routingResult = 'routingResult';
        
        trRoutingProcessManager.status = jest.fn(() => Promise.resolve({
            status: 'started'
        } as any));
        TransitAccessibilityMapCalculator.calculate = jest.fn(() => Promise.resolve({
            routingResult: routingResult
        } as any));

        const response = await request(app).post('/api/accessibility/false');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual({resultByNode: routingResult});
        expect(TransitAccessibilityMapCalculator.calculate).toBeCalled();
    });

    test('POST /api/accessibility, with geometry', async () => {
        const result = {
            polygons: 'polygons',
            strokes: 'strokes',
            resultByNode: 'resultByNode',
        };
        
        trRoutingProcessManager.status = jest.fn(() => Promise.resolve({
            status: 'started'
        } as any));
        transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn(() => Promise.resolve({
            geojson: {
                features: 'features'
            }
        }));
        TransitAccessibilityMapCalculator.calculateWithPolygons = jest.fn(() => Promise.resolve(result as any));

        const response = await request(app).post('/api/accessibility/true');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(transitObjectDataHandlers.nodes.geojsonCollection).toBeCalled();
        expect(TransitAccessibilityMapCalculator.calculateWithPolygons).toBeCalled();
    });

    test('POST /api/accessibility, with error', async () => {
        trRoutingProcessManager.status = jest.fn(() => Promise.resolve({
            status: 'started'
        } as any));
        TransitAccessibilityMapCalculator.calculate = jest.fn(() => {
            throw new Error();
        });

        const response = await request(app).post('/api/accessibility/false');

        expect(response.status).toStrictEqual(500);
        expect(TransitAccessibilityMapCalculator.calculate).toBeCalled();
    });
});
