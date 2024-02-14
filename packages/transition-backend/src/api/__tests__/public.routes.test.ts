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
});
