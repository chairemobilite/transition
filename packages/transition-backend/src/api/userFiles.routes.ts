/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import type { Express, Response } from 'express';

import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { isLoggedIn } from 'chaire-lib-backend/lib/services/auth/authorization';
import type { UserAttributes } from 'chaire-lib-backend/lib/services/users/user';

/**
 * Send a file from a directory in the data directory of the user. The file
 * will be in the user's data directory, but we do not want to expose userId.
 *
 * @param userId The ID of the logged in user
 * @param directoryName The name of the directory in the user's data directory
 * @param file The file to send, from the URL. Express decodes `%2F` in the
 * parameters, so it can be a path to a file in a sub-directory, with its
 * slashes encoded. It is sent with the directory as `root`, which refuses paths
 * with `..`, so only files in the directory can be sent.
 */
const sendUserFile = (res: Response, userId: number, directoryName: string, file: string): void => {
    const directory = path.join(directoryManager.userDataDirectory, String(userId), directoryName);
    res.sendFile(file, { root: directory }, (error) => {
        if (!error) {
            return;
        }
        // The file does not exist, the path is refused because it is not in
        // the directory, or the file could not be sent completely. The file
        // name comes from the client, it is quoted to escape any newline.
        console.error(
            `Error sending file ${JSON.stringify(file)} from directory ${directoryName} of user ${userId}: ${error.message}`
        );
        if (!res.headersSent) {
            res.status(404).json({ status: 'FileDoesNotExist' });
        }
    });
};

/**
 * Add the routes to download the files of the logged in user
 *
 * @param app The express app
 */
export default (app: Express) => {
    app.get('/exports/:file', isLoggedIn, (req, res) =>
        sendUserFile(res, (req.user as UserAttributes).id, 'exports', req.params.file)
    );

    app.get('/job/:jobId/:file', isLoggedIn, (req, res) => {
        const userId = (req.user as UserAttributes).id;
        // The job ID is a number in the API, and the files of a job are in a
        // directory named by its ID
        if (!/^\d+$/.test(req.params.jobId)) {
            console.error(`Invalid job ID ${JSON.stringify(req.params.jobId)} to get a file of user ${userId}`);
            res.status(400).json({ status: 'BadRequest', message: 'The job ID must be a number' });
            return;
        }
        sendUserFile(res, userId, req.params.jobId, req.params.file);
    });
};
