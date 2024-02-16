/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import request from 'supertest';
import express from 'express';
import publicRoutes from '../public.routes';
import passport from 'passport';
import transitObjectDataHandlers from '../../services/transitObjects/TransitObjectsDataHandler';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';

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

test('Authentication setup', () => {
    publicRoutes(express(), passport);
    expect(passport.authenticate).toBeCalledWith('api-strategy', {"failWithError": true, "failureMessage": true});
});

describe('Testing endpoints', () => {
    const app = express();
    publicRoutes(app, passport);

    test('POST /api', async () => {
        const response = await request(app).post('/api');

        expect(response.status).toStrictEqual(200);
        expect(response.text).toStrictEqual('The public API endpoint works!');
    });

    test('POST /api/paths', async () => {
        transitObjectDataHandlers.paths.geojsonCollection! = jest.fn();

        const response = await request(app).post('/api/paths');

        expect(response.status).toStrictEqual(200);
        expect(transitObjectDataHandlers.paths.geojsonCollection!).toBeCalled();
    });

    test('POST /api/nodes', async () => {
        transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn();

        const response = await request(app).post('/api/nodes');

        expect(response.status).toStrictEqual(200);
        expect(transitObjectDataHandlers.nodes.geojsonCollection!).toBeCalled();
    });

    test('POST /api/scenarios', async () => {
        transitObjectDataHandlers.scenarios.collection! = jest.fn();

        const response = await request(app).post('/api/scenarios');
        
        expect(response.status).toStrictEqual(200);
        expect(transitObjectDataHandlers.scenarios.collection!).toBeCalledWith(null);
    });

    test('POST /api/routing-modes', async () => {
        osrmProcessManager.availableRoutingModes = jest.fn(() => Promise.resolve([]));

        const response = await request(app).post('/api/routing-modes');

        expect(response.status).toStrictEqual(200);
        expect(response.body).toStrictEqual(['transit']);
        expect(osrmProcessManager.availableRoutingModes).toBeCalled();
    });
});