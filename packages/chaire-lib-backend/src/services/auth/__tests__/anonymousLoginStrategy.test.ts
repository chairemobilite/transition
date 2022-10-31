import knex from 'knex';
import mockKnex from 'mock-knex';
import passport from 'passport';

import AnonymousLoginStrategy from '../anonymousLoginStrategy';

process.env.MAGIC_LINK_SECRET_KEY = 'SOMEARBITRARYSTRINGFORASECRETKEY';
// Mock DB and email notifications module
jest.mock('../../../config/shared/db.config', () => {
    const connection = knex({ client: 'pg', debug: false});
    mockKnex.mock(connection, 'knex@0.10');
    return connection;
});


const tracker = mockKnex.getTracker();
tracker.install();

// req.logIn needs to be set and is called by passport when successful
const logInFct = jest.fn().mockImplementation((_a, _b, callback) => {
    callback();
});

let insertedUser: any = null;
const newUserId = 7;
let shouldFail: boolean = false;
// Query results
tracker.on('query', (query) => {
    if (shouldFail) {
        throw 'Database error';
    }
    if (query.method === 'insert') {
        insertedUser = {
            id: newUserId,
            confirmation_token: query.bindings[0],
            email: query.bindings[1],
            facebook_id: query.bindings[2],
            first_name: query.bindings[3],
            generated_password: query.bindings[4],
            google_id: query.bindings[5],
            is_admin: query.bindings[6],
            is_confirmed: query.bindings[7],
            is_test: query.bindings[8],
            is_valid: query.bindings[9],
            last_name: query.bindings[10],
            password: query.bindings[11],
            username: query.bindings[12]
        };
        query.response([insertedUser]);
    } else {
        query.response(null);
    }

});

beforeEach(() => {
    logInFct.mockClear();
    insertedUser = null;
    shouldFail = false;
});

const strategy = new AnonymousLoginStrategy();
passport.use('anonymous-login', strategy);

test('correct name', () => {
    expect(strategy.name).toEqual('anonymousLoginStrategy');
})

test('Anonymous strategy success', async () => {
    const authPromise = new Promise((resolve, reject) => (
        passport.authenticate('anonymous-login')({
            logIn: logInFct
        }, {end: jest.fn()}, (err, result) => {
            resolve({ result, err });
        })
    ));
    await authPromise;
    expect(logInFct).toHaveBeenCalledTimes(1);
    expect(insertedUser).not.toBeNull();
    expect(insertedUser.username).toEqual(expect.stringContaining('anonym_'));
    expect(logInFct).toHaveBeenCalledWith({ id: insertedUser.id, username: expect.stringContaining('anonym_'), email: null, firstName: '', lastName: '', preferences: {}, serializedPermissions: []}, expect.anything(), expect.anything());
});

test('Anonymous strategy failure', async () => {
    shouldFail = true;
    const endFct = jest.fn();
    const authPromise = new Promise((resolve, reject) => {
        const res = { 
            end: endFct.mockImplementation((message) => resolve({ result: null, err: message })),
            json: jest.fn().mockImplementation((json) => resolve({ result: json, err: null })),
            setHeader: jest.fn()
        };
        return passport.authenticate('anonymous-login')({
            logIn: logInFct
        }, res, (err, result) => {
            resolve({ result, err });
        })
    });
    await authPromise;
    expect(insertedUser).toBeNull();
    expect(logInFct).not.toHaveBeenCalled();
    expect(endFct).toHaveBeenCalledTimes(1);
});