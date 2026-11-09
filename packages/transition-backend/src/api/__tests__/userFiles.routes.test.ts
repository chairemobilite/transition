/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import http from 'http';
import type { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import userFilesRoutes from '../userFiles.routes';

// The user data directory is a temporary directory for these tests
const mockUserDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'userFilesRoutes-'));
jest.mock('chaire-lib-backend/lib/utils/filesystem/directoryManager', () => ({
    directoryManager: {
        get userDataDirectory() {
            return mockUserDataDirectory;
        }
    }
}));

const userId = 1;
const otherUserId = 2;
const jobId = 12;

const writeFile = (relativePath: string, content: string) => {
    const filePath = path.join(mockUserDataDirectory, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
};

const app = express();
// Set the logged in user, as passport does in the server
app.use((req, _res, next) => {
    const testUserId = req.header('x-test-user-id');
    if (testUserId !== undefined) {
        req.user = { id: Number(testUserId) } as Express.User;
    }
    next();
});
userFilesRoutes(app);

// Send the request path as is, as an attacker can. supertest normalizes the
// URL, which removes `%2E%2E` segments before they reach the server
const sendRawRequest = (urlPath: string, requestUserId: number): Promise<{ status?: number; body: string }> =>
    new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const { port } = server.address() as AddressInfo;
            http.get({ port, path: urlPath, headers: { 'x-test-user-id': String(requestUserId) } }, (response) => {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => server.close(() => resolve({ status: response.statusCode, body })));
            }).on('error', (error) => server.close(() => reject(error)));
        });
    });

beforeAll(() => {
    writeFile(`${userId}/exports/export.csv`, 'user export');
    writeFile(`${userId}/exports/sub/export.csv`, 'user export in sub directory');
    writeFile(`${userId}/${jobId}/result.csv`, 'user job result');
    writeFile(`${userId}/imports/import.csv`, 'user import');
    writeFile(`${otherUserId}/exports/other.csv`, 'other user export');
    writeFile(`${otherUserId}/${jobId}/result.csv`, 'other user job result');
    writeFile('secret.txt', 'secret outside user directories');
});

afterAll(() => {
    fs.rmSync(mockUserDataDirectory, { recursive: true, force: true });
});

let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('GET /exports/:file', () => {
    test('Get a file of the user', async () => {
        const response = await request(app).get('/exports/export.csv').set('x-test-user-id', String(userId));
        expect(response.status).toEqual(200);
        expect(response.text).toEqual('user export');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    // Express decodes the `%2F` in the parameters
    test('Get a file in a sub directory of the exports directory', async () => {
        const response = await request(app).get('/exports/sub%2Fexport.csv').set('x-test-user-id', String(userId));
        expect(response.status).toEqual(200);
        expect(response.text).toEqual('user export in sub directory');
    });

    test('File does not exist', async () => {
        const response = await request(app).get('/exports/other.csv').set('x-test-user-id', String(userId));
        expect(response.status).toEqual(404);
        expect(response.body).toEqual({ status: 'FileDoesNotExist' });
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error sending file "other.csv" from directory exports of user ${userId}`));
    });

    test('File name with a newline is escaped in the log', async () => {
        const response = await request(app).get('/exports/other%0Afile.csv').set('x-test-user-id', String(userId));
        expect(response.status).toEqual(404);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"other\\nfile.csv"'));
        expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('\n');
    });

    test('User is not logged in', async () => {
        const response = await request(app).get('/exports/export.csv');
        expect(response.status).toEqual(401);
    });

    // Express decodes the `%2F` in the parameters, so these file names contain slashes
    test.each([
        ['parent directories', '..%2F..%2Fsecret.txt'],
        ['other user directory', `..%2F..%2F${otherUserId}%2Fexports%2Fother.csv`],
        ['other directory of the user', '..%2Fimports%2Fimport.csv'],
        ['absolute path', `${encodeURIComponent(mockUserDataDirectory)}%2Fsecret.txt`],
        ['parent directory', '%2E%2E'],
        ['null character', 'export.csv%00.txt']
    ])('File outside the exports directory: %s', async (_title, file) => {
        const response = await sendRawRequest(`/exports/${file}`, userId);
        expect(response.status).toEqual(404);
        expect(JSON.parse(response.body)).toEqual({ status: 'FileDoesNotExist' });
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
});

describe('GET /job/:jobId/:file', () => {
    test('Get a file of a job of the user', async () => {
        const response = await request(app).get(`/job/${jobId}/result.csv`).set('x-test-user-id', String(userId));
        expect(response.status).toEqual(200);
        expect(response.text).toEqual('user job result');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('File does not exist', async () => {
        const response = await request(app).get(`/job/${jobId}/other.csv`).set('x-test-user-id', String(userId));
        expect(response.status).toEqual(404);
        expect(response.body).toEqual({ status: 'FileDoesNotExist' });
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error sending file "other.csv" from directory ${jobId} of user ${userId}`));
    });

    test('User is not logged in', async () => {
        const response = await request(app).get(`/job/${jobId}/result.csv`);
        expect(response.status).toEqual(401);
    });

    test('User is not logged in, with a job ID that is not a number', async () => {
        const response = await request(app).get('/job/abc/result.csv');
        expect(response.status).toEqual(401);
    });

    // Express decodes the `%2F` in the parameters, so these names contain slashes
    test.each([
        ['parent directory', '%2E%2E', 'secret.txt'],
        ['other user directory', `..%2F${otherUserId}%2F${jobId}`, 'result.csv'],
        ['another directory of the user', 'exports', 'export.csv'],
        ['negative number', `-${jobId}`, 'result.csv'],
        ['decimal number', `${jobId}.0`, 'result.csv']
    ])('Job ID is not a number: %s', async (_title, requestedJobId, file) => {
        const response = await sendRawRequest(`/job/${requestedJobId}/${file}`, userId);
        expect(response.status).toEqual(400);
        expect(JSON.parse(response.body)).toEqual({ status: 'BadRequest', message: 'The job ID must be a number' });
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Invalid job ID ${JSON.stringify(decodeURIComponent(requestedJobId))} to get a file of user ${userId}`));
    });

    test.each([
        ['file in parent directories', '..%2F..%2Fsecret.txt'],
        ['file in other user directory', `..%2F..%2F${otherUserId}%2F${jobId}%2Fresult.csv`],
        ['file is parent directory', '%2E%2E']
    ])('File outside the job directory: %s', async (_title, file) => {
        const response = await sendRawRequest(`/job/${jobId}/${file}`, userId);
        expect(response.status).toEqual(404);
        expect(JSON.parse(response.body)).toEqual({ status: 'FileDoesNotExist' });
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
});
