/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express from 'express';
import { PassportStatic } from 'passport';
import transitObjectDataHandlers from '../services/transitObjects/TransitObjectsDataHandler';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';

export default function (app: express.Express, passport: PassportStatic) {
    const router = express.Router();

    app.use('/api', router);

    router.use('/', passport.authenticate('api-strategy', { failWithError: true, failureMessage: true }));

    router.post('/', (req, res) => {
        res.send('The public API endpoint works!');
    });

    router.post('/paths', async (req, res) => {
        const geojson = await transitObjectDataHandlers.paths.geojsonCollection!();
        res.json(geojson);
    });

    router.post('/nodes', async (req, res) => {
        const geojson = await transitObjectDataHandlers.nodes.geojsonCollection!();
        res.json(geojson);
    });

    router.post('/scenarios', async (req, res) => {
        const attributes = await transitObjectDataHandlers.scenarios.collection!(null);
        res.json(attributes);
    });

    router.post('/routing-modes', async (req, res) => {
        const routingModes: RoutingOrTransitMode[] = await osrmProcessManager.availableRoutingModes();
        routingModes.push('transit');
        res.json(routingModes);
    });
}
