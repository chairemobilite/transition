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
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import { TransitAccessibilityMapResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import TransitAccessibilityMapRouting, { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';

export default function (app: express.Express, passport: PassportStatic) {
    app.use('/token', passport.authenticate('local-login', { failWithError: true, failureMessage: true }));

    app.post('/token', async (req, res) => {
        try {
            const token = await tokensDbQueries.getOrCreate(req.body.usernameOrEmail);
            res.send(token);
        } catch (error) {
            res.status(500);
            res.send(error);
        }
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

    router.get('/accessibility', async (req, res, next) => {
        // Start trRouting if it is not running
        const trRoutingStatus = await trRoutingProcessManager.status({});
        if (trRoutingStatus.status === "not_running") {
            await trRoutingProcessManager.start({});
        }

        const calculationAttributes: AccessibilityMapAttributes = req.body;
        const routing = new TransitAccessibilityMapRouting(calculationAttributes);

        try {
            const accessibilityMap: TransitAccessibilityMapResult = await TransitAccessibilityMapCalculator.calculate(
                routing,
                false,
                {}
            );
            return res.json(accessibilityMap.routingResult);
        } catch (error) {
            next(error);
        }
    })
    
    app.use('/api', router);
}
