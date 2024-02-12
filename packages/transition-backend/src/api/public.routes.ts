/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express from 'express';
import { PassportStatic } from 'passport';

export default function (app: express.Express, passport: PassportStatic) {
    const router = express.Router();

    app.use('/api', router);

    router.use('/', passport.authenticate('api-strategy', { failWithError: true, failureMessage: true }));

    router.post('/', (req, res) => {
        res.send('The public API endpoint works!');
    });
}
