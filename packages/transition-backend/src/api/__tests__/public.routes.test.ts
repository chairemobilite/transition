import supertest from 'supertest';
import express from 'express';
import publicRoutes from '../public.routes';
import passport from 'passport'



jest.mock('passport')

const mockApp = express();

describe("Name", () => {
beforeEach(() => jest.clearAllMocks());
    test('Bypass Authentication - Return value', async () => {


        const passStub = jest.fn().mockImplementation((strategy, options) => {
            return (req, res, next) => {
                next();
            };
        });
        
        passport.authenticate = passStub
        
        publicRoutes(mockApp, passport)

    const response = await supertest(mockApp).get("/api/")

    expect(response.status).toEqual(200);
    expect(response.text).toEqual('The public API endpoint works!')
    expect(passStub).toBeCalledWith('api-strategy', {"failWithError": true, "failureMessage": true})
    });
});