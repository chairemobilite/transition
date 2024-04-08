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
    TransitRouteCalculationResultParams,
    UnimodalRouteCalculationResultParams,
    calculateAccessibilityMap,
    calculateRoute
} from '../services/routingCalculation/RoutingCalculator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { getAttributesOrDefault } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import { Feature, FeatureCollection, LineString, MultiPolygon, Point } from 'geojson';
import { TrRoutingRoute } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { getTransitRouteQueryOptionsOrDefault } from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import { TransitRouteQueryOptions } from 'chaire-lib-common/lib/api/TrRouting';
import PathsAPIResponse from './public/PathsAPIResponse';
import NodesAPIResponse from './public/NodesAPIResponse';
import ScenariosAPIResponse from './public/ScenariosAPIResponse';
import RoutingModesAPIResponse from './public/RoutingModesAPIResponse';

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
            const response = createRoutingApiResponse(routingResult, calculationAttributes);
            res.status(200).json(response);
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
            const response = createAccessibilityMapApiResponse(routingResult, attributes);
            res.status(200).json(response);
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

function createRoutingApiResponse(
    routingResult: RouteCalculationResultParamsByMode,
    inputAttributes: TransitRoutingAttributes
) {
    const query: any = {
        routingModes: inputAttributes.routingModes,
        originGeojson: {
            type: inputAttributes.originGeojson!.type,
            properties: {
                location: inputAttributes.originGeojson!.properties?.location
            },
            geometry: inputAttributes.originGeojson!.geometry
        },
        destinationGeojson: {
            type: inputAttributes.destinationGeojson!.type,
            properties: {
                location: inputAttributes.destinationGeojson!.properties?.location
            },
            geometry: inputAttributes.destinationGeojson!.geometry
        }
    };

    if ('transit' in routingResult) {
        const transitRouteQueryOptions: TransitRouteQueryOptions = getTransitRouteQueryOptionsOrDefault(
            inputAttributes,
            [inputAttributes.originGeojson!, inputAttributes.destinationGeojson!]
        );
        query.scenarioId = inputAttributes.scenarioId;
        query.departureTimeSecondsSinceMidnight = inputAttributes.departureTimeSecondsSinceMidnight ?? undefined;
        query.arrivalTimeSecondsSinceMidnight = inputAttributes.arrivalTimeSecondsSinceMidnight ?? undefined;
        query.maxTotalTravelTimeSeconds = transitRouteQueryOptions.maxTravelTime;
        query.minWaitingTimeSeconds = transitRouteQueryOptions.minWaitingTime;
        query.maxTransferTravelTimeSeconds = transitRouteQueryOptions.maxTransferTravelTime;
        query.maxAccessEgressTravelTimeSeconds = transitRouteQueryOptions.maxAccessTravelTime;
        query.maxFirstWaitingTimeSeconds = transitRouteQueryOptions.maxFirstWaitingTime;
        query.withAlternatives = transitRouteQueryOptions.alternatives;
    }

    const result = {};

    for (const mode in routingResult) {
        if (mode === 'transit') {
            const transitResultParams: TransitRouteCalculationResultParams = routingResult[mode]!;
            result[mode] = {
                paths: transitResultParams.paths.map((path: TrRoutingRoute) => {
                    const { originDestination, timeOfTrip, timeOfTripType, ...rest } = path;
                    return rest;
                }),
                pathsGeojson: transitResultParams.pathsGeojson?.map((pathGeojson: FeatureCollection) => ({
                    type: pathGeojson.type,
                    features: pathGeojson.features.map((feature: Feature) => ({
                        type: feature.type,
                        geometry: feature.geometry,
                        properties: {
                            stepSequence: feature.properties?.stepSequence,
                            action: feature.properties?.action,
                            distanceMeters: feature.properties?.distanceMeters,
                            travelTimeSeconds: feature.properties?.travelTimeSeconds
                        }
                    }))
                }))
            };
        } else {
            const unimodalResultParams: UnimodalRouteCalculationResultParams = routingResult[mode];
            result[mode] = {
                paths: unimodalResultParams.paths.map((path: Route) => ({
                    geometry: path.geometry,
                    distanceMeters: path.distance,
                    travelTimeSeconds: path.duration
                })),
                pathsGeojson: unimodalResultParams.pathsGeojson?.map((pathGeojson: FeatureCollection) => ({
                    type: pathGeojson.type,
                    features: pathGeojson.features.map((feature: Feature) => ({
                        type: feature.type,
                        geometry: feature.geometry,
                        properties: {
                            mode: feature.properties?.mode,
                            distanceMeters: feature.properties?.distanceMeters,
                            travelTimeSeconds: feature.properties?.travelTimeSeconds
                        }
                    }))
                }))
            };
        }
    }

    return {
        query: query,
        result: result
    };
}

function createAccessibilityMapApiResponse(
    routingResult: AccessibilityMapCalculationResult,
    inputAttributes: Partial<AccessibilityMapAttributes>
) {
    const query = {
        locationGeojson: {
            type: inputAttributes.locationGeojson?.type,
            geometry: inputAttributes.locationGeojson?.geometry,
            properties: {}
        },
        scenarioId: inputAttributes.scenarioId,
        departureTimeSecondsSinceMidnight: inputAttributes.departureTimeSecondsSinceMidnight ?? undefined,
        arrivalTimeSecondsSinceMidnight: inputAttributes.arrivalTimeSecondsSinceMidnight ?? undefined,
        numberOfPolygons: inputAttributes.numberOfPolygons,
        deltaSeconds: inputAttributes.deltaSeconds,
        deltaIntervalSeconds: inputAttributes.deltaIntervalSeconds,
        maxTotalTravelTimeSeconds: inputAttributes.maxTotalTravelTimeSeconds,
        minWaitingTimeSeconds: inputAttributes.minWaitingTimeSeconds,
        maxAccessEgressTravelTimeSeconds: inputAttributes.maxAccessEgressTravelTimeSeconds,
        maxTransferTravelTimeSeconds: inputAttributes.maxTransferTravelTimeSeconds,
        maxFirstWaitingTimeSeconds: inputAttributes.maxFirstWaitingTimeSeconds,
        walkingSpeedMps: inputAttributes.walkingSpeedMps
    };

    if ('polygons' in routingResult) {
        routingResult.polygons.features = routingResult.polygons.features.map((feature: Feature<MultiPolygon>) => ({
            ...feature,
            properties: {}
        }));
    }

    return {
        query: query,
        result: routingResult
    };
}
