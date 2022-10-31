/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import json2CapnpService from '../Json2CapnpService';
import fetchMock from 'jest-fetch-mock';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

const jsonCapnpDefaultPrefs = Preferences.get('json2Capnp');

beforeEach(() => {
    fetchMock.doMock();
    fetchMock.mockClear();
});

describe('Valid calls and return values', () => {
    test('Read value', async () => {
        const jsonObject = {
            field1: 3
        };
        fetchMock.mockOnce(JSON.stringify(jsonObject));
        const result = await json2CapnpService.readCache('test', {});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:2000/test?', expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Write value', async() => {
        const jsonObject = {
            field: 3,
            data: 'hello'
        };
        fetchMock.mockOnce('{ "status": "OK" }');
        const result = await json2CapnpService.writeCache('test', jsonObject);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:2000/test', expect.objectContaining({ method: 'POST', headers: expect.anything(), body: JSON.stringify(jsonObject) }));
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
        fetchMock.mockOnce(JSON.stringify(jsonObject));
        const result = await json2CapnpService.readCache('test', {});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`${host}:${port}/test?`, expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(jsonObject);
    });

    test('Write value', async() => {
        const jsonObject = {
            field: 3,
            data: 'hello'
        };
        fetchMock.mockOnce('{ "status": "OK" }');
        const result = await json2CapnpService.writeCache('test', jsonObject);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(`${host}:${port}/test`, expect.objectContaining({ method: 'POST', headers: expect.anything(), body: JSON.stringify(jsonObject) }));
    });
});

describe('Call errors', () => {
    beforeEach(() => {
        fetchMock.mockReject(new Error('wrong'));
    });

    afterEach(() => {
        jest.setTimeout(5000);
        fetchMock.mockClear();
    });

    test('Read value', async () => {
        // TODO Remove this timeout once we use a library with more control
        // 10 seconds, zeit retry automatically waits for a certain delay
        jest.setTimeout(10000);
        await expect(json2CapnpService.readCache('test', {}))
            .rejects
            .toThrowError();
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:2000/test?', expect.objectContaining({ method: 'GET' }));
    });

    test('Read value', async () => {
        // TODO Remove this timeout once we use a library with more control
        // 10 seconds, zeit retry automatically waits for a certain delay
        jest.setTimeout(10000);
        const jsonObject = {
            field: 3,
            data: 'hello'
        };
        await expect(json2CapnpService.writeCache('test', jsonObject))
            .rejects
            .toThrowError();
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:2000/test', expect.objectContaining({ method: 'POST', headers: expect.anything(), body: JSON.stringify(jsonObject) }));
    });
});