/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as turf from '@turf/turf';
import type osrm from 'osrm';

import type GeoJSON from 'geojson';

import * as RoutingService from './RoutingService';
import serviceLocator from '../../utils/ServiceLocator';
import { _isBlank } from '../../utils/LodashExtensions';
import Preferences from '../../config/Preferences';
import * as Status from '../../utils/Status';
import type * as RoutingAPI from '../../api/Routing';
import type * as Valhalla from '../../api/Valhalla';
import { ceilToPositiveInteger } from '../../utils/MathUtils';

// Since Valhalla has a parameter to output results in OSRM format, we can re-use the OSRM parsing functions
import { osrmRouteToResult } from './OSRMRoutingService';

const defaultRoutingRadiusMeters = 20;

/**
 * This class provides routing services using the OSRM backend
 *
 * FIXME: Clarify the map match algorithm, the code here does not work, somewhat
 * copy-pasted from updateGeography
 */
export default class ValhallaRoutingService extends RoutingService.default {
    private processRoutingResult(
        routingResult: Status.Status<osrm.RouteResults>
    ): RoutingService.RouteResults {
        const osrmResult = Status.unwrap(routingResult);

        return {
            waypoints: osrmResult.waypoints
                ? osrmResult.waypoints.map((tp) =>
                      tp ? turf.point(tp.location).geometry : null
                  )
                : [],
            routes: osrmResult.routes.map(osrmRouteToResult)
        };
    }

    private async callValhallaRoute(
        params: RoutingAPI.ValhallaRouteOptions
    ): Promise<Status.Status<osrm.RouteResults>> {
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                'service.valhallaRouting.route',
                params,
                (routingResult: Status.Status<osrm.RouteResults>) => resolve(routingResult)
            );
        });
    }
        
    private async callValhallaIsochrone(
        params: Valhalla.ValhallaIsochroneOptions
    ): Promise<Status.Status<Valhalla.ValhallaIsochroneResults>> {
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                'service.valhallaRouting.isochrone',
                params,
                (routingResult: Status.Status<Valhalla.ValhallaIsochroneResults>) =>
                    resolve(routingResult)
            );
        });
    }

    public async mapMatch(
        params: RoutingService.MapMatchParameters
    ): Promise<RoutingService.MapMatchingResults> {
        throw new Error('Valhalla map matching is not implemented yet');
    }

    public async route(
        params: RoutingService.RouteParameters
    ): Promise<RoutingService.RouteResults> {
        const routingResult = await this.callValhallaRoute({
            mode: params.mode,
            points: params.points.features,

            // Ask Valhalla to return an OSRM-compatible response.
            format: 'osrm',
            shape_format: 'geojson',

            // Valhalla uses directions_type instead of OSRM's steps boolean.
            directions_type: params.showSteps ? 'instructions' : 'none',

            // Valhalla uses an integer for the number of alternate routes.
            // TODO: Make this parameter configurable
            alternates: params.withAlternatives ? 3 : 0
        });

        return this.processRoutingResult(routingResult);
    }

    public async tableFrom(
        params: RoutingService.TableFromParameters
    ): Promise<RoutingService.TableResults> {
        throw new Error('Valhalla table routing is not implemented yet');
    }

    public async tableTo(
        params: RoutingService.TableToParameters
    ): Promise<RoutingService.TableResults> {
        throw new Error('Valhalla table routing is not implemented yet');
    }

    public async isochrone(
        params: RoutingService.IsochroneParameters
    ): Promise<RoutingService.IsochroneResults> {
        const contours: Valhalla.ValhallaIsochroneContour[] =
            'timeContours' in params
                ? params.timeContours!.map((time) => ({
                    time: time / 60 // seconds -> minutes
                }))
                : params.distanceContours.map((distance) => ({
                    distance: distance / 1000 // meters -> kilometers
                }));

        const options: RoutingAPI.ValhallaIsochroneOptions = {
            mode: params.mode,
            locations: [
                {
                    lat: params.center.coordinates[1],
                    lon: params.center.coordinates[0]
                }
            ],
            contours,
            polygons: true,
            generalize: 0, // as detailed as possible. This could be made into a parameter
        };

        const routingResult = await this.callValhallaIsochrone(options);
        const result = Status.unwrap(routingResult);

        return {
            features: result.features as RoutingService.IsochroneResults['features']
        };
    }
}