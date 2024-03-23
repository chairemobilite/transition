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
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { calculateAccessibilityMap, calculateRoute } from '../../services/routingCalculation/RoutingCalculator';
import * as Status from 'chaire-lib-common/lib/utils/Status';

jest.mock('../../services/routingCalculation/RoutingCalculator');

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
        const pathsGeojson = 'pathsGeojson';

        transitObjectDataHandlers.paths.geojsonCollection! = jest.fn().mockResolvedValue(
            Status.createOk({
                type: 'geojson',
                geojson: pathsGeojson
            })
        );

        const response = await request(app).get('/api/paths');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(pathsGeojson);
        expect(transitObjectDataHandlers.paths.geojsonCollection!).toBeCalled();
    });

    test('GET /api/nodes', async () => {
        const nodesGeojson = 'nodesGeojson';
        
        transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn().mockResolvedValue(
            Status.createOk({
                type: 'geojson',
                geojson: nodesGeojson
            })
        );

        const response = await request(app).get('/api/nodes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(nodesGeojson);
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

    test('POST /api/accessibility, without geojson', async () => {
        const attributes = { attribute: 'value' };
        const result = 'result';

        (calculateAccessibilityMap as jest.Mock).mockResolvedValue(result);

        const response = await request(app)
            .post('/api/accessibility?withGeojson=false')
            .send(attributes);

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(calculateAccessibilityMap).toBeCalledWith(attributes, false);
    });

    test('POST /api/accessibility, with geojson', async () => {
        const attributes = { attribute: 'value' };
        const result = 'result';

        (calculateAccessibilityMap as jest.Mock).mockResolvedValue(result);

        const response = await request(app)
            .post('/api/accessibility?withGeojson=true')
            .send(attributes);

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(calculateAccessibilityMap).toBeCalledWith(attributes, true);
    });

    test('POST /api/accessibility, with error', async () => {
        (calculateAccessibilityMap as jest.Mock).mockImplementation(() => {
            throw new Error();
        });

        const response = await request(app).post('/api/accessibility');

        expect(response.status).toStrictEqual(500);
        expect(calculateAccessibilityMap).toBeCalled();
    });

    test('POST /api/route, without geojson', async () => {
        const attributes = { attribute: 'value' };
        const result = 'result';

        (calculateRoute as jest.Mock).mockResolvedValue(result);

        const response = await request(app)
            .post('/api/route?withGeojson=false')
            .send(attributes);

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(calculateRoute).toBeCalledWith(attributes, false);
    });

    test('POST /api/route, with geojson', async () => {
        const attributes = { attribute: 'value' };
        const result = 'result';

        (calculateRoute as jest.Mock).mockResolvedValue(result);

        const response = await request(app)
            .post('/api/route?withGeojson=true')
            .send(attributes);

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(result);
        expect(calculateRoute).toBeCalledWith(attributes, true);
    });

    test('POST /api/route, with error', async () => {
        (calculateRoute as jest.Mock).mockImplementation(() => {
            throw new Error();
        });

        const response = await request(app).post('/api/route');

        expect(response.status).toStrictEqual(500);
        expect(calculateRoute).toBeCalled();
    });
});
