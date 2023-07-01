/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express from 'express';
// TODO This config is both server and project config. It should only include the project config to be typed later
import { projectConfig } from '../config/config';
import * as Status from 'chaire-lib-common/lib/utils/Status';

export default function (app: express.Express) {
    app.get('/config', (req, res) => {
        return res.status(200).json(Status.createOk(projectConfig));
    });
}
