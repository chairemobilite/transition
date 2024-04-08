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
import TransitAccessibilityMapRouting, {
    AccessibilityMapAttributes
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import {
    AccessibilityMapCalculationResult,
    RouteCalculationResultParamsByMode,
    calculateAccessibilityMap,
    calculateRoute
} from '../services/routingCalculation/RoutingCalculator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { getAttributesOrDefault } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import { Feature, FeatureCollection, LineString, MultiPolygon, Point } from 'geojson';
import PathsAPIResponse from './public/PathsAPIResponse';
import NodesAPIResponse from './public/NodesAPIResponse';
import ScenariosAPIResponse from './public/ScenariosAPIResponse';
import RoutingModesAPIResponse from './public/RoutingModesAPIResponse';
import RouteAPIResponse from './public/RouteAPIResponse';
import AccessibilityMapAPIResponse from './public/AccessibilityMapAPIResponse';

export default function (app: express.Express, passport: PassportStatic) {
    app.use('/token', (req, res, next) => {
        passport.authenticate('local-login', { failWithError: true, failureMessage: true }, (err, user, info) => {
            const credentials = req.body;
            if (!credentials.usernameOrEmail) {
                const message = 'MissingUsernameOrEmail';
                console.error(message);
                return res.status(400).send(message);
            }
            if (!credentials.password) {
                const message = 'MissingPassword';
                console.error(message);
                return res.status(400).send(message);
            }

            if (err) {
                console.error(err);

                if (err === 'UnknownUser' || err === 'PasswordsDontMatch') {
                    return res.status(401).send(err);
                } else {
                    const message = 'Internal Server Error';
                    return res.status(500).send(message);
                }
            }

            next();
        })(req, res, next);
    });

    app.post('/token', async (req, res, next) => {
        try {
            const token = await tokensDbQueries.getOrCreate(req.body.usernameOrEmail);
            res.status(200).send(token);
        } catch (error) {
            console.error(error);
            const message = 'Internal Server Error';
            res.status(500).send(message);
        }
    });

    const router = express.Router();

    router.use('/', passport.authenticate('bearer-strategy', { session: false }));

    router.get('/paths', async (req, res, next) => {
        try {
            const status = await transitObjectDataHandlers.paths.geojsonCollection!();
            const result = Status.unwrap(status) as { type: 'geojson'; geojson: FeatureCollection<LineString> };
            const response: PathsAPIResponse = new PathsAPIResponse(result.geojson);
            res.status(200).json(response.getResponse());
        } catch (error) {
            next(error);
        }
    });

    router.get('/nodes', async (req, res, next) => {
        try {
            const status = await transitObjectDataHandlers.nodes.geojsonCollection!();
            const result = Status.unwrap(status) as { type: 'geojson'; geojson: FeatureCollection<Point> };
            const response: NodesAPIResponse = new NodesAPIResponse(result.geojson);
            res.status(200).json(response.getResponse());
        } catch (error) {
            next(error);
        }
    });

    router.get('/scenarios', async (req, res, next) => {
        try {
            const scenarios = await transitObjectDataHandlers.scenarios.collection!(null);
            const response: ScenariosAPIResponse = new ScenariosAPIResponse(scenarios.collection);
            res.status(200).json(response.getResponse());
        } catch (error) {
            next(error);
        }
    });

    router.get('/routing-modes', async (req, res, next) => {
        try {
            const routingModes: RoutingOrTransitMode[] = await osrmProcessManager.availableRoutingModes();
            routingModes.push('transit');
            const response: RoutingModesAPIResponse = new RoutingModesAPIResponse(routingModes);
            res.status(200).json(response.getResponse());
        } catch (error) {
            next(error);
        }
    });

    router.post('/route', async (req, res, next) => {
        const calculationAttributes: TransitRoutingAttributes = req.body;
        const withGeojson = req.query.withGeojson === 'false' ? false : true;
        try {
            const routing: TransitRouting = new TransitRouting(calculationAttributes);
            if (routing.originDestinationToGeojson().features.length < 2) {
                const message = 'Invalid origin/destination';
                return res.status(400).send(message);
            }

            if (!routing.validate()) {
                const formattedErrors = routing.errors.map((e) => e.split(':').pop());
                const message = 'Validation failed for routing attributes:\n' + formattedErrors.join('\n');
                return res.status(400).send(message);
            }

            const routingResult: RouteCalculationResultParamsByMode = await calculateRoute(routing, withGeojson);
            const response: RouteAPIResponse = new RouteAPIResponse({
                queryParams: calculationAttributes,
                resultParams: routingResult
            });
            res.status(200).json(response.getResponse());
        } catch (error) {
            next(error);
        }
    });

    router.post('/accessibility', async (req, res, next) => {
        const calculationAttributes: AccessibilityMapAttributes = req.body;
        const withGeojson = req.query.withGeojson === 'false' ? false : true;
        try {
            if (!calculationAttributes.locationGeojson) {
                const message = 'There should be a valid location';
                return res.status(400).send(message);
            }
            const attributes = getAttributesOrDefault(calculationAttributes);
            const routing = new TransitAccessibilityMapRouting(attributes);
            if (!routing.validate()) {
                const formattedErrors = routing.errors.map((e) => e.split(':').pop());
                const message = 'Validation failed for routing attributes:\n' + formattedErrors.join('\n');
                return res.status(400).send(message);
            }

            const routingResult: AccessibilityMapCalculationResult = await calculateAccessibilityMap(
                routing,
                withGeojson
            );
            const response: AccessibilityMapAPIResponse = new AccessibilityMapAPIResponse({
                queryParams: attributes,
                resultParams: routingResult
            });
            res.status(200).json(response.getResponse());
        } catch (error) {
            next(error);
        }
    });

    // This is the default error handler used for the API, but all errors here are returned with the HTTP status code 500.
    // When relevant, more specific checks should be done within individual endpoints to return a more appropriate status code.
    router.use((err, req, res, next) => {
        console.error(err);

        const message = 'Internal Server Error';
        res.status(500).send(message);
    });

    app.use('/api', router);
}
