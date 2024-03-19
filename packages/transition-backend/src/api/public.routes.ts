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
import TransitAccessibilityMapRouting, {
    AccessibilityMapAttributes
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import {
    ResultsByMode,
    TransitRoutingCalculator
} from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { UnimodalRouteCalculationResult } from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import PathCollection from 'transition-common/lib/services/path/PathCollection';

export default function (app: express.Express, passport: PassportStatic) {
    // A CollectionManager is required for the POST /accessibility endpoint
    const collectionManager = new CollectionManager(undefined);
    serviceLocator.addService('collectionManager', collectionManager);

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

    router.post('/route', async (req, res, next) => {
        // Start trRouting if it is not running
        const trRoutingStatus = await trRoutingProcessManager.status({});
        if (trRoutingStatus.status === 'not_running') {
            await trRoutingProcessManager.start({});
        }

        const calculationAttributes: TransitRoutingAttributes = req.body;
        const routing: TransitRouting = new TransitRouting(calculationAttributes);
        const withGeojson = req.query.withGeojson === 'false' ? false : true;

        try {
            const resultsByMode: ResultsByMode = await TransitRoutingCalculator.calculate(routing, false, {});

            const routingResult = {};
            for (const routingMode in resultsByMode) {
                const modeResult: UnimodalRouteCalculationResult | TransitRoutingResult = resultsByMode[routingMode];
                routingResult[routingMode] = modeResult.getParams();

                if (withGeojson) {
                    // The generatePathGeojson function in TransitRoutingResult requires a path collection,
                    // so the paths currently in the database are loaded here
                    const paths = await transitObjectDataHandlers.paths.geojsonCollection!();
                    const pathCollection = new PathCollection(paths.geojson.features, {});
                    const options = { completeData: false, pathCollection: pathCollection };

                    const pathsGeojson: GeoJSON.FeatureCollection[] = [];
                    for (let i = 0; i < modeResult.getAlternativesCount(); i++) {
                        const geojson = await modeResult.getPathGeojson(i, options);
                        pathsGeojson.push(geojson);
                    }
                    routingResult[routingMode].pathsGeojson = pathsGeojson;
                }
            }

            res.json(routingResult);
        } catch (error) {
            next(error);
        }
    });

    router.post('/accessibility', async (req, res, next) => {
        // Start trRouting if it is not running
        const trRoutingStatus = await trRoutingProcessManager.status({});
        if (trRoutingStatus.status === 'not_running') {
            await trRoutingProcessManager.start({});
        }

        const calculationAttributes: AccessibilityMapAttributes = req.body;
        const routing = new TransitAccessibilityMapRouting(calculationAttributes);
        const withGeojson = req.query.withGeojson === 'false' ? false : true;

        try {
            let routingResult;

            if (withGeojson) {
                // The calculateWithPolygons function in TransitAccessibilityMapCalculator requires a node collection,
                // so the nodes currently in the database are loaded here
                const nodes = await transitObjectDataHandlers.nodes.geojsonCollection!();
                const nodeCollection = new NodeCollection(nodes.geojson.features, {});
                collectionManager.update('nodes', nodeCollection);

                routingResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(routing, false, {});
            } else {
                const accessibilityMap: TransitAccessibilityMapResult =
                    await TransitAccessibilityMapCalculator.calculate(routing, false, {});
                routingResult = {
                    resultByNode: accessibilityMap.routingResult
                };
            }

            res.json(routingResult);
        } catch (error) {
            next(error);
        }
    });

    app.use('/api', router);
}
