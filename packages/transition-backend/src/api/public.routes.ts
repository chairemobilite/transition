/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import express from 'express';
import { PassportStatic } from 'passport';
import tokensDbQueries from 'chaire-lib-backend/lib/models/db/tokens.db.queries';
import transitObjectDataHandlers from '../services/transitObjects/TransitObjectsDataHandler';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import osrmService from 'chaire-lib-backend/lib/utils/osrm/OSRMService';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import trRoutingService from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';



export default function (app: express.Express, passport: PassportStatic) {
    app.use('/token', passport.authenticate('local-login', { failWithError: true, failureMessage: true }));

    app.post('/token', async (req, res) => {
        const token = await tokensDbQueries.getOrCreate(req.body.usernameOrEmail);
        res.send(token);
    });

    const router = express.Router();

    router.use('/', passport.authenticate('bearer-strategy', { session: false }));

    router.get('/paths', async (req, res) => {
        const geojson = await transitObjectDataHandlers.paths.geojsonCollection!();
        res.json(geojson);
    });

    router.get('/nodes', async (req, res) => {
        const geojson = await transitObjectDataHandlers.nodes.geojsonCollection!();
        res.json(geojson);
    });

    router.get('/scenarios', async (req, res) => {
        const attributes = await transitObjectDataHandlers.scenarios.collection!(null);
        res.json(attributes);
    });

    router.get('/routing-modes', async (req, res) => {
        const routingModes: RoutingOrTransitMode[] = await osrmProcessManager.availableRoutingModes();
        routingModes.push('transit');
        res.json(routingModes);
    });

    app.use('/api', router);

    router.get('/od', async (req, res) => {
        const routingParameters = req.body.routingParameters;
        if ((await trRoutingProcessManager.status({})).status === "not_running") {
            await trRoutingProcessManager.restart({});
        }

        const routingResults = await trRoutingService.route(routingParameters);
        const parameters = {
            mode: req.body.mode,
            points: routingParameters.originDestination
        };
        const routingResultsGeoJson = await osrmService.route(parameters);

        const withGeo = req.body.withGeo !== undefined ? req.body.withGeo : true;
        if (req.body.withGeo == false ) {
            res.json(routingResults);

        }
        else {
            res.json({ routingResults: routingResults, routingResultsGeoJson: routingResultsGeoJson });
        }
    });
}
