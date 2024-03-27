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
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import {
    SingleAccessibilityMapCalculationResult,
    SingleRouteCalculationResult,
    calculateAccessibilityMap,
    calculateRoute
} from '../services/routingCalculation/RoutingCalculator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { FeatureCollection } from 'geojson';

export default function (app: express.Express, passport: PassportStatic) {
    app.use('/token', passport.authenticate('local-login', { failWithError: true, failureMessage: true }));

    app.post('/token', async (req, res) => {
        try {
            const token = await tokensDbQueries.getOrCreate(req.body.usernameOrEmail);
            res.send(token);
        } catch (error) {
            res.status(500).send(error);
        }
    });

    const router = express.Router();

    router.use('/', passport.authenticate('bearer-strategy', { session: false }));

    router.get('/paths', async (req, res, next) => {
        try {
            const status = await transitObjectDataHandlers.paths.geojsonCollection!();
            const result = Status.unwrap(status) as { type: 'geojson'; geojson: FeatureCollection };
            res.json(result.geojson);
        } catch (error) {
            next(error);
        }
    });

    router.get('/nodes', async (req, res, next) => {
        try {
            const status = await transitObjectDataHandlers.nodes.geojsonCollection!();
            const result = Status.unwrap(status) as { type: 'geojson'; geojson: FeatureCollection };
            res.json(result.geojson);
        } catch (error) {
            next(error);
        }
    });

    router.get('/scenarios', async (req, res, next) => {
        try {
            const attributes = await transitObjectDataHandlers.scenarios.collection!(null);
            res.json(attributes);
        } catch (error) {
            next(error);
        }
    });

    router.get('/routing-modes', async (req, res, next) => {
        try {
            const routingModes: RoutingOrTransitMode[] = await osrmProcessManager.availableRoutingModes();
            routingModes.push('transit');
            res.json(routingModes);
        } catch (error) {
            next(error);
        }
    });

    router.post('/route', async (req, res, next) => {
        const calculationAttributes: TransitRoutingAttributes = req.body;
        const withGeojson = req.query.withGeojson === 'false' ? false : true;
        try {
            const routingResult: SingleRouteCalculationResult = await calculateRoute(
                calculationAttributes,
                withGeojson
            );
            res.json(routingResult);
        } catch (error) {
            next(error);
        }
    });

    router.post('/accessibility', async (req, res, next) => {
        const calculationAttributes: AccessibilityMapAttributes = req.body;
        const withGeojson = req.query.withGeojson === 'false' ? false : true;
        try {
            const routingResult: SingleAccessibilityMapCalculationResult = await calculateAccessibilityMap(
                calculationAttributes,
                withGeojson
            );
            res.json(routingResult);
        } catch (error) {
            next(error);
        }
    });

    // This is the default error handler used for the API, but all errors here are returned with the HTTP status code 500.
    // When relevant, more specific checks should be done within individual endpoints to return a more appropriate status code.
    router.use((err, req, res, next) => {
        console.error(err);

        if (Object.hasOwn(err, 'message')) {
            return res.status(500).send(err.message);
        }

        // This property can be generated, for example, by the TrError.export() function and may contain a relevant error message
        if (Object.hasOwn(err, 'error')) {
            return res.status(500).send(err.error);
        }

        res.status(500).send(err);
    });

    app.use('/api', router);
}
