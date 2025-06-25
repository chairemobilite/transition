/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import request from 'supertest';
import express from 'express';
import config from '../../config/server.config';
import captchaRoutes, { validateCaptchaToken } from '../captcha.routes';
import { TestUtils } from 'chaire-lib-common/lib/test';

// Store the original value to restore it after tests
const originalCaptchaType = config.captchaComponentType;

// Create mock functions to track calls
const createChallengeMock = jest.fn().mockImplementation(() => ({
    challenge: [['example', 'challenge']],
    token: 'exampleToken',
    expires: Date.now() + 3600000 // 1 hour from now
}));

const redeemChallengeMock = jest.fn().mockImplementation(({ token, solutions }) => {
    if (token === 'validToken' && Array.isArray(solutions) && solutions.length > 0) {
        return Promise.resolve({
            success: true,
            token: 'redeemedToken',
            expires: Date.now() + 3600000
        });
    }
    return Promise.resolve({
        success: false,
        message: 'Invalid token or solutions'
    });
});

const validateTokenMock = jest.fn().mockImplementation(token => {
    return Promise.resolve({ success: token === 'validToken' });
});

// Mock Cap.js server as a proper class constructor
jest.mock('@cap.js/server', () => {
    // Create a mock class with the expected API
    class MockCap {
        constructor() {

        }

        createChallenge() {
            return createChallengeMock();
        }

        async redeemChallenge(params) {
            return redeemChallengeMock(params);
        }

        async validateToken(token) {
            return validateTokenMock(token);
        }
    }

    // Return the mock class as the default export
    return {
        __esModule: true,
        default: MockCap
    };
});

// Helper function to wait for async operations
const waitForSetup = async () => {
    // Wait for any pending promises to resolve
    await TestUtils.flushPromises();
    // Additional delay to ensure initialization completes
    await new Promise(resolve => setTimeout(resolve, 50));
};

// Reset all mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
});

describe('Captcha Routes Tests', () => {
    // Reset global state after each major test group
    afterAll(() => {
        // Restore original config
        config.captchaComponentType = originalCaptchaType;
    });

    describe('Cap.js Captcha', () => {
        let app;
        let middlewareApp;

        beforeAll(async () => {
            
            // Setup routes for capjs captcha
            config.captchaComponentType = 'capjs'; 
            
            // Setup main app
            app = express();
            app.use(express.json());
            const router = express.Router();
            captchaRoutes(router);
            app.use(router);
            
            // Setup middleware app
            middlewareApp = express();
            middlewareApp.use(express.json());
            middlewareApp.post(
                '/protected',
                validateCaptchaToken(),
                (req, res) => res.status(200).json({ success: true })
            );
            
            // Wait for routes and validation function to be initialized
            await waitForSetup();
        });

        describe('POST /captcha/challenge', () => {
            it('should call createChallenge and return its result', async () => {
                const response = await request(app).post('/captcha/challenge');
                
                // Verify the API response
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('challenge');
                expect(response.body).toHaveProperty('token');
                
                // Verify createChallenge was called correctly
                expect(createChallengeMock).toHaveBeenCalledTimes(1);
                expect(createChallengeMock).toHaveBeenCalledWith();
            });
        });

        describe('POST /captcha/redeem', () => {
            it('should call redeemChallenge with correct parameters for valid request', async () => {
                const validToken = 'validToken';
                const validSolutions = ['solution1', 'solution2'];
                
                const response = await request(app)
                    .post('/captcha/redeem')
                    .send({ token: validToken, solutions: validSolutions });
                
                // Verify the API response
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
                
                // Verify redeemChallenge was called correctly
                expect(redeemChallengeMock).toHaveBeenCalledTimes(1);
                expect(redeemChallengeMock).toHaveBeenCalledWith({ 
                    token: validToken, 
                    solutions: validSolutions 
                });
            });

            it('should not call redeemChallenge when missing token or solutions', async () => {
                const response = await request(app).post('/captcha/redeem').send({});
                
                // Verify the API response
                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('success', false);
                
                // Verify redeemChallenge was not called
                expect(redeemChallengeMock).not.toHaveBeenCalled();
            });

            it('should call redeemChallenge with invalid token', async () => {
                const invalidToken = 'invalidToken';
                const validSolutions = ['solution1', 'solution2'];
                
                const response = await request(app)
                    .post('/captcha/redeem')
                    .send({ token: invalidToken, solutions: validSolutions });
                
                // Verify the API response
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', false);
                
                // Verify redeemChallenge was called with correct parameters
                expect(redeemChallengeMock).toHaveBeenCalledTimes(1);
                expect(redeemChallengeMock).toHaveBeenCalledWith({ 
                    token: invalidToken, 
                    solutions: validSolutions 
                });
            });
        });

        describe('Captcha Middleware with Cap.js', () => {
            it('should call validateToken with correct token when validating', async () => {
                const validToken = 'validToken';
                const response = await request(middlewareApp)
                    .post('/protected')
                    .send({ captchaToken: validToken });
                
                // Verify the API response
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
                
                // Verify validateToken was called correctly
                expect(validateTokenMock).toHaveBeenCalledTimes(1);
                expect(validateTokenMock).toHaveBeenCalledWith(validToken);
            });

            it('should call validateToken with invalid token', async () => {
                const invalidToken = 'invalidToken';
                const response = await request(middlewareApp)
                    .post('/protected')
                    .send({ captchaToken: invalidToken });
                
                // Verify the API response
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('success', false);
                
                // Verify validateToken was called correctly
                expect(validateTokenMock).toHaveBeenCalledTimes(1);
                expect(validateTokenMock).toHaveBeenCalledWith(invalidToken);
            });

            it('should not call validateToken when no token is provided', async () => {
                const response = await request(middlewareApp).post('/protected').send({});
                
                // Verify the API response
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('message', 'Captcha token not provided');
                
                // Verify validateToken was not called
                expect(validateTokenMock).not.toHaveBeenCalled();
            });
        });
    });

    // Run simple captcha tests after cap.js tests have completed
    describe('Simple Captcha', () => {
        let app;
        let middlewareApp;

        beforeAll(async () => {
            
            // Setup routes for simple captcha
            config.captchaComponentType = 'simple';
            
            // Setup main app
            app = express();
            app.use(express.json());
            const router = express.Router();
            captchaRoutes(router);
            app.use(router);
            
            // Setup middleware app
            middlewareApp = express();
            middlewareApp.use(express.json());
            middlewareApp.post(
                '/protected',
                validateCaptchaToken(),
                (req, res) => res.status(200).json({ success: true })
            );
            
            // Wait for routes and validation function to be initialized
            await waitForSetup();
        });

        describe('Routes for simple captcha', () => {
            it('should not define /captcha/challenge route', async () => {
                const response = await request(app).post('/captcha/challenge');
                expect(response.status).toBe(404);
            });

            it('should not define /captcha/redeem route', async () => {
                const response = await request(app).post('/captcha/redeem');
                expect(response.status).toBe(404);
            });
        });

        describe('Captcha Middleware with Simple Captcha', () => {
            it('should always allow access with any token for simple captcha', async () => {
                const anyToken = 'any-token-will-work';
                const response = await request(middlewareApp)
                    .post('/protected')
                    .send({ captchaToken: anyToken });
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
            });
        });
    });
});