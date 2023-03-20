/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express, { RequestHandler } from 'express';
import request from 'supertest';
import * as Status from 'chaire-lib-common/lib/utils/Status';

import configRoutes from '../config.routes';

jest.mock('../../config/server.config', () => ({
    mapDefaultCenter: { lon: -3, lat: -3 },
    separateAdminLoginPage: false,
    projectShortname: 'unitTest'
}));

const app = express();
// FIXME Since upgrading @types/node, the types are wrong and we get compilation error. It is documented for example https://github.com/DefinitelyTyped/DefinitelyTyped/issues/53584 the real fix would require upgrading a few packages and may have side-effects. Simple casting works for now.
app.use(express.json({ limit: '500mb' }) as RequestHandler);
app.use(express.urlencoded({extended: true}) as RequestHandler);
configRoutes(app);

test('Get config', async () => {
    const res = await request(app)
        .get(`/config`)
        .set('Accept', 'application/json')
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect(200);

    expect(Status.isStatusOk(res.body)).toEqual(true);
    const config = Status.unwrap(res.body);
    expect(config).toEqual({
        mapDefaultCenter: { lon: -3, lat: -3 },
        separateAdminLoginPage: false,
        projectShortname: 'unitTest'
    });

});