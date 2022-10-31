/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'knex';
import mockKnex from 'mock-knex';
import express, { RequestHandler } from 'express';
import request from 'supertest';
import session from 'supertest-session';

import authRoutes from '../auth.routes';
import { resetPasswordEmail } from '../../services/auth/userEmailNotifications';
import User from '../../services/auth/user';
import config from '../../config/server.config';

jest.mock('../../config/server.config', () => ({
    auth: {}
}));
jest.mock('../../services/auth/userEmailNotifications');
const mockedResetPwdEmail = resetPasswordEmail as jest.Mocked<typeof resetPasswordEmail>;
const mockResetPassword = jest.fn();
User.resetPassword = mockResetPassword;

let authResponse: {
    error: any,
    user: any,
    statusCode?: number
} = {
    error: null,
    user: false
}
const authMockImplementation = (req, res, next) => {
    const response = authResponse;
    if (response.user) {
        req.user = response.user;
    }
    if (response.statusCode) {
        res.status(response.statusCode);
    }
    next(response.error, response.user);
};
const authMockFunctions = {
    'local-login': jest.fn().mockImplementation(authMockImplementation),
    'local-signup': jest.fn().mockImplementation(authMockImplementation),
    'passwordless-enter-login': jest.fn().mockImplementation(authMockImplementation),
    'passwordless-login': jest.fn().mockImplementation(authMockImplementation),
    'anonymous-login': jest.fn().mockImplementation(authMockImplementation)
}

jest.mock('passport', () => {
    return {
        authenticate: jest.fn().mockImplementation((authType, options, callback) => {
            if (callback) {
                callback('This is an error', null)
            }
            return authMockFunctions[authType] ? authMockFunctions[authType] : jest.fn().mockImplementation(authMockImplementation);
        }),
        use: jest.fn(),
        serializeUser: jest.fn(),
        deserializeUser: jest.fn()
    }
});
const validUsername = 'test';
const password = 'testtest';
const validEmail = 'test@test.org';
const validUser = {
    id: 5,
    username: validUsername,
    email: validEmail,
    is_confirmed: true,
    is_valid: true
};

// Mock DB and email notifications module
jest.mock('../../config/shared/db.config', () => {
    const connection = knex({ client: 'pg', debug: false});
    mockKnex.mock(connection, 'knex@0.10');
    return connection;
});

const tracker = mockKnex.getTracker();
tracker.install();

let updatedUser: any = null;
const resetPasswordToken = 'b7319eab283aa67195913d66804e739a9519483c';
// Query results
tracker.on('query', (query) => {
    if (query.method === 'update') {
        updatedUser = {
            id: validUser.id,
            username: query.bindings[0],
            email: query.bindings[1],
            is_confirmed: query.bindings[2],
            is_valid: query.bindings[3],
            password_reset_token: resetPasswordToken
        };
        query.response([updatedUser]);
    } else if (query.bindings.includes(validEmail)) {
        query.response([validUser]);
    } else {
        query.response(null);
    }
});

const app = express();
// FIXME Since upgrading @types/node, the types are wrong and we get compilation error. It is documented for example https://github.com/DefinitelyTyped/DefinitelyTyped/issues/53584 the real fix would require upgrading a few packages and may have side-effects. Simple casting works for now.
app.use(express.json({ limit: '500mb' }) as RequestHandler);
app.use(express.urlencoded({extended: true}) as RequestHandler);
authRoutes(app);

beforeEach(() => {
    authResponse = {
        error: null,
        user: false
    }
    mockResetPassword.mockClear();
    Object.keys(authMockFunctions).forEach(authType => authMockFunctions[authType].mockClear());
})

test('Login, valid user', async () => {
    authResponse = {
        error: null,
        user: { username: validUsername }
    };
    const res = await session(app)
        .post('/login')
        .send({ usernameOrEmail: validUsername, password })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.status).toEqual('Login successful!');
    expect(res.body.user).toEqual({ username: validUsername });
    expect(authMockFunctions['local-login']).toHaveBeenCalledTimes(1);
})

test('Login, invalid user', async () => {
    authResponse = {
        error: 'UnknownUser',
        user: false
    };
    const res = await session(app)
        .post('/login')
        .send({ usernameOrEmail: validUsername, password })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.status).toEqual('User not authenticated');
    expect(res.body.error).toEqual('UnknownUser');
    expect(res.body.user).toEqual(undefined);
    expect(authMockFunctions['local-login']).toHaveBeenCalledTimes(1);
})

test('Login, unconfirmed user', async () => {
    authResponse = {
        error: 'Unauthorized',
        user: false,
        statusCode: 401
    };
    const res = await session(app)
        .post('/login')
        .send({ usernameOrEmail: validUsername, password })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401);
    expect(res.body.status).toEqual('User not authenticated');
    expect(res.body.error).toEqual('Unauthorized');
    expect(res.body.user).toEqual(undefined);
    expect(authMockFunctions['local-login']).toHaveBeenCalledTimes(1);
})

test('Signup, valid user', async () => {
    authResponse = {
        error: null,
        user: { username: validUsername }
    };
    const res = await session(app)
        .post('/register')
        .send({ usernameOrEmail: validUsername, password })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.status).toEqual('Registration successful!');
    expect(res.body.user).toEqual({ username: validUsername });
    expect(authMockFunctions['local-signup']).toHaveBeenCalledTimes(1);
})

test('Signup, user exists', async () => {
    authResponse = {
        error: 'UserExists',
        user: false
    };
    const res = await session(app)
        .post('/register')
        .send({ usernameOrEmail: validUsername, password })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.status).toEqual('User not authenticated');
    expect(res.body.error).toEqual('UserExists');
    expect(authMockFunctions['local-signup']).toHaveBeenCalledTimes(1);
})

test('Signup, unconfirmed user', async () => {
    authResponse = {
        error: 'Unauthorized',
        user: false,
        statusCode: 401
    };
    const res = await session(app)
        .post('/register')
        .send({ usernameOrEmail: validUsername, password })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401);
    expect(res.body.status).toEqual('User not authenticated');
    expect(res.body.error).toEqual('Unauthorized');
    expect(res.body.user).toEqual(undefined);
    expect(authMockFunctions['local-signup']).toHaveBeenCalledTimes(1);
});

test('Forgot password, user exists', async () => {
    expect(mockedResetPwdEmail).not.toHaveBeenCalled();
    const res = await request(app)
        .post('/forgot', { email: validEmail })
        .send({ email: validEmail })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.emailExists).toEqual(true);

    // FIXME: For some reason here expect(mockedResetPwdEmail).toHaveBeenCalledWith(expect.objectContaining({attributes: updatedUser})) does not work, it says it receives a json, while the actual argument is the right object.
    expect(mockedResetPwdEmail).toHaveBeenCalledTimes(1);
    expect((mockedResetPwdEmail as any).mock.calls).toHaveLength(1);
    const args = (mockedResetPwdEmail as any).mock.calls[0];
    expect(args[0]).toMatchObject({attributes: updatedUser});
});

test('Forgot password, user does not exist', async () => {
    expect(mockedResetPwdEmail).toHaveBeenCalledTimes(1);
    const res = await request(app)
        .post('/forgot')
        .set('Accept', 'application/json')
        .send({ email: 'invalid@test.org' })
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.emailExists).toEqual(false);
    expect(mockedResetPwdEmail).toHaveBeenCalledTimes(1);
});

test('Reset password, post without password', async () => {
    mockResetPassword.mockImplementation(() => 'Confirmed');
    const token = 'ThisIsAnArbitraryToken';
    const res = await request(app)
        .post(`/reset/${token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.status).toEqual('Confirmed');
    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    expect(mockResetPassword).toHaveBeenCalledWith(token, undefined);
});

test('Reset password, post without password with exception', async () => {
    mockResetPassword.mockImplementation(() => {
        throw 'Some error occurred';
    });
    const token = 'ThisIsAnArbitraryToken';
    const res = await request(app)
        .post(`/reset/${token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(500);
    expect(res.body.status).toEqual('Error');
    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    expect(mockResetPassword).toHaveBeenCalledWith(token, undefined);
});

test('Reset password, post with password', async () => {
    mockResetPassword.mockImplementation(() => 'PasswordChanged');
    const newPassword = 'newPassword';
    const token = 'ThisIsAnArbitraryToken';
    const res = await request(app)
        .post(`/reset/${token}`)
        .set('Accept', 'application/json')
        .send({ newPassword: newPassword })
        .expect('Content-Type', /json/)
        .expect(200);
    expect(res.body.status).toEqual('PasswordChanged');
    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    expect(mockResetPassword).toHaveBeenCalledWith(token, newPassword);
});

test('Reset password, post with exception', async () => {
    mockResetPassword.mockImplementation(() => {
        throw 'Some error occurred';
    });
    const newPassword = 'newPassword';
    const token = 'ThisIsAnArbitraryToken';
    const res = await request(app)
        .post(`/reset/${token}`)
        .set('Accept', 'application/json')
        .send({ newPassword: newPassword })
        .expect('Content-Type', /json/)
        .expect(500);
    expect(res.body.status).toEqual('Error');
    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    expect(mockResetPassword).toHaveBeenCalledWith(token, newPassword);
});

describe('Passwordless and anonymous auth routes, unsupported', () => {
    test('Test the passwordless first route', async () => {
        const res = await request(app)
            .post(`/pwdless`)
            .set('Accept', 'application/json')
            .send({ destination: 'test@foo.bar' })
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(404);
    });

    test('Test the passwordless verification route', async () => {
        const res = await request(app)
            .get(`/pwdless/verify?token=sometoken`)
            .set('Accept', 'application/json')
            .send({ destination: 'test@foo.bar' })
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(404);
    });

    test('Test anonymous login route', async () => {
        const res = await request(app)
            .get(`/anonymous`)
            .set('Accept', 'application/json')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(404);
    });
});

describe('Passwordless and anonymous auth routes, supported', () => {
    // Allow passwordless and anonymous in the configuration
    config.auth = {
        anonymous: true,
        passwordless: {
            directFirstLogin: true
        }
    }

    // Use a second express app for these cases to make sure routes are updated with config
    const secondApp = express();
    // FIXME Since upgrading @types/node, the types are wrong and we get compilation error. It is documented for example https://github.com/DefinitelyTyped/DefinitelyTyped/issues/53584 the real fix would require upgrading a few packages and may have side-effects. Simple casting works for now.
    secondApp.use(express.json({ limit: '500mb' }) as RequestHandler);
    secondApp.use(express.urlencoded({extended: true}) as RequestHandler);
    authRoutes(secondApp);

    afterAll(() => {
        config.auth = {};
    });

    test('Test the passwordless first route', async () => {
        authResponse = {
            error: null,
            user: { username: validUsername }
        };
        const res = await request(secondApp)
            .post(`/pwdless`)
            .set('Accept', 'application/json')
            .send({ destination: 'test@foo.bar' })
            .expect('Content-Type', /json/)
            .expect(200);
        expect(res.body.status).toEqual('Login successful!');
        expect(res.body.user).toEqual({ username: validUsername });
        expect(authMockFunctions['passwordless-enter-login']).toHaveBeenCalledTimes(1);
    });

    test('Test the passwordless first route, error', async () => {
        authResponse = {
            error: 'UseAnotherMethod',
            user: false
        };
        const res = await request(secondApp)
            .post(`/pwdless`)
            .set('Accept', 'application/json')
            .send({ destination: 'test@foo.bar' })
            .expect('Content-Type', /json/)
            .expect(200);
        expect(res.body.status).toEqual('User not authenticated');
        expect(res.body.error).toEqual(authResponse.error);
        expect(res.body.user).toEqual(undefined);
        expect(authMockFunctions['passwordless-enter-login']).toHaveBeenCalledTimes(1);
    });

    test('Test the passwordless verification route', async () => {
        authResponse = {
            error: null,
            user: { username: validUsername }
        };
        const res = await request(secondApp)
            .get(`/pwdless/verify?token=sometoken`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200);
        expect(res.body.status).toEqual('Login successful!');
        expect(res.body.user).toEqual({ username: validUsername });
        expect(authMockFunctions['passwordless-login']).toHaveBeenCalledTimes(1);
    });

    test('Test the passwordless verification route, invalid token', async () => {
        authResponse = {
            error: 'invalid token',
            user: false
        };
        const res = await request(secondApp)
            .get(`/pwdless/verify?token=sometoken`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200);
        expect(res.body.status).toEqual('User not authenticated');
        expect(res.body.error).toEqual(authResponse.error);
        expect(res.body.user).toEqual(undefined);
        expect(authMockFunctions['passwordless-login']).toHaveBeenCalledTimes(1);
    });

    test('Test anonymous login route', async () => {
        authResponse = {
            error: null,
            user: { username: validUsername }
        };
        const res = await session(secondApp)
            .get('/anonymous')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200);
        expect(res.body.status).toEqual('Login successful!');
        expect(res.body.user).toEqual({ username: validUsername });
        expect(authMockFunctions['anonymous-login']).toHaveBeenCalledTimes(1);
    });
});
