/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Must be mocked before the fetch-retry is loaded in Json2CapnpService
const mockedFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockedFetch;

import json2CapnpService from '../Json2CapnpService';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

const jsonCapnpDefaultPrefs = Preferences.get('json2Capnp');

beforeEach(() => {
    jest.resetAllMocks();
});

describe('Valid calls and return values', () => {
    test('Read value', async () => {

        const jsonObject = {
            field1: 3
        };

        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        const result = await json2CapnpService.readCache('test', {});
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:2000/test?', expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Write value', async() => {
        const jsonObject = {
            field: 3,
            data: 'hello'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);

        //fetchMock.mockOnce('{ "status": "OK" }');
        const result = await json2CapnpService.writeCache('test', jsonObject);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:2000/test', expect.objectContaining({ method: 'POST', headers: expect.anything(), body: JSON.stringify(jsonObject) }));
    });
});

describe('Valid calls, with default preferences changes', () => {
    const host = 'https://test.transition.city';
    const port = 2021;
    beforeEach(() => {
        Preferences.set('json2Capnp', { host, port });
    });

    afterEach(() => {
        Preferences.set('json2Capnp', jsonCapnpDefaultPrefs);
    });

    test('Read value', async () => {
        const jsonObject = {
            field1: 3
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);
        const result = await json2CapnpService.readCache('test', {});
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`${host}:${port}/test?`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Write value', async() => {
        const jsonObject = {
            field: 3,
            data: 'hello'
        };
        const response = new Response(JSON.stringify(jsonObject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        mockedFetch.mockResolvedValue(response);
        const result = await json2CapnpService.writeCache('test', jsonObject);
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        expect(mockedFetch).toHaveBeenCalledWith(`${host}:${port}/test`, expect.objectContaining({ method: 'POST', headers: expect.anything(), body: JSON.stringify(jsonObject) }));
    });
});

describe('Call errors', () => {
    beforeEach(() => {
        mockedFetch.mockRejectedValue(new Error('wrong'));
    });

    afterEach(() => {
        jest.setTimeout(5000);
        mockedFetch.mockClear();
    });

    test('Read value', async () => {
        // TODO Now we use the fetch-retry package, is this still relevant?
        // TODO Remove this timeout once we use a library with more control
        // 10 seconds, zeit retry automatically waits for a certain delay
        jest.setTimeout(10000);
        await expect(json2CapnpService.readCache('test', {}))
            .rejects
            .toThrow();
        expect(mockedFetch).toHaveBeenCalledTimes(5);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:2000/test?', expect.objectContaining({ method: 'GET' }));
    });

    test('Read value', async () => {
        // TODO Now we use the fetch-retry package, is this still relevant?
        // TODO Remove this timeout once we use a library with more control
        // 10 seconds, zeit retry automatically waits for a certain delay
        jest.setTimeout(10000);
        const jsonObject = {
            field: 3,
            data: 'hello'
        };
        await expect(json2CapnpService.writeCache('test', jsonObject))
            .rejects
            .toThrow();
        expect(mockedFetch).toHaveBeenCalledTimes(5);
        expect(mockedFetch).toHaveBeenCalledWith('http://localhost:2000/test', expect.objectContaining({ method: 'POST', headers: expect.anything(), body: JSON.stringify(jsonObject) }));
    });
});
