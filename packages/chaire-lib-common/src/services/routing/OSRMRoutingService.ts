/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as turf from '@turf/turf';
import osrm from 'osrm';
import GeoJSON from 'geojson';
import polyline from '@mapbox/polyline';

import * as RoutingService from './RoutingService';
import serviceLocator from '../../utils/ServiceLocator';
import { _isBlank } from '../../utils/LodashExtensions';
import Preferences from '../../config/Preferences';
import * as Status from '../../utils/Status';
import * as OSRMRoutingAPI from '../../api/OSRMRouting';

const defaultRoutingRadiusMeters = 20;

const osrmStepToResult = (step: osrm.RouteStep) => {
    return {
        distance: step.distance,
        duration: step.duration,
        geometry: (step.geometry as osrm.LineString).type
            ? (step.geometry as GeoJSON.LineString)
            : polyline.decode(step.geometry as string)
    };
};

const osrmLegToResult = (leg: osrm.RouteLeg) => {
    return {
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps.map(osrmStepToResult)
    };
};

const osrmMatchingToResult = (matching: osrm.MatchRoute) => {
    return {
        ...matching,
        legs: matching.legs.map(osrmLegToResult)
    };
};

const osrmRouteToResult = (matching: osrm.Route) => {
    return {
        distance: matching.distance,
        duration: matching.duration,
        geometry: matching.geometry,
        legs: matching.legs.map(osrmLegToResult)
    };
};

/**
 * This class provides routing services using the OSRM backend
 *
 * FIXME: Clarify the map match algorithm, the code here does not work, somewhat
 * copy-pasted from updateGeography
 */
export default class OSRMRoutingService extends RoutingService.default {
    private processMapMatchingResult(
        routingResult: Status.Status<osrm.MatchResults>
    ): RoutingService.MapMatchingResults {
        const osrmResult = Status.unwrap(routingResult);
        return {
            tracepoints: osrmResult.tracepoints
                ? osrmResult.tracepoints.map((tp) => (tp ? turf.point(tp.location).geometry : null))
                : [],
            matchings: osrmResult.matchings.map(osrmMatchingToResult)
        };
    }

    private processRoutingResult(routingResult: Status.Status<osrm.RouteResults>): RoutingService.RouteResults {
        const osrmResult = Status.unwrap(routingResult);

        const filteredResult = this.filterNetworkTooFar(osrmResult);

        return {
            waypoints: filteredResult.waypoints
                ? filteredResult.waypoints.map((tp) => (tp ? turf.point(tp.location).geometry : null))
                : [],
            routes: filteredResult.routes.map(osrmRouteToResult)
        };
    }

    // If origin or destination are too far from the network, invalidate the results
    private filterNetworkTooFar(routingResult: osrm.RouteResults): osrm.RouteResults {
        const waypoints = routingResult.waypoints;

        if (waypoints) {
            const origin = waypoints[0];
            const destination = waypoints[waypoints.length - 1];

            // TODO: Migrate this value from preferences to config like the osrm modes. See issue #1140
            const maxDistance = Preferences.get('osrmRouting.maxDistanceFromNearestNetworkNodeMeters');

            if (origin.distance > maxDistance || destination.distance > maxDistance) {
                //TODO Should we throw an exception instead here?
                routingResult.routes[0].distance = -1;
                routingResult.routes[0].duration = -1;
            }
        }
        return routingResult;
    }

    private async callOsrmMap(
        params: OSRMRoutingAPI.TransitionMatchOptions
    ): Promise<Status.Status<osrm.MatchResults>> {
        //console.log("osrm params", params);
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                'service.osrmRouting.match',
                params,
                (routingResult: Status.Status<osrm.MatchResults>) => {
                    //console.log('routingResult', routingResult);
                    resolve(routingResult);
                }
            );
        });
    }

    private async callOsrmRoute(
        params: OSRMRoutingAPI.TransitionRouteOptions
    ): Promise<Status.Status<osrm.RouteResults>> {
        //console.log("osrm params", params);
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                'service.osrmRouting.route',
                params,
                (routingResult: Status.Status<osrm.RouteResults>) => {
                    //console.log('routingResult', routingResult);
                    resolve(routingResult);
                }
            );
        });
    }

    private async callOsrmTableFrom(
        params: RoutingService.TableFromParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        //console.log("osrm params", params);
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                'service.osrmRouting.tableFrom',
                params,
                (tableResult: Status.Status<RoutingService.TableResults>) => {
                    //console.log('routingResult', routingResult);
                    resolve(tableResult);
                }
            );
        });
    }

    private async callOsrmTableTo(
        params: RoutingService.TableToParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        //console.log("osrm params", params);
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                'service.osrmRouting.tableTo',
                params,
                (tableResult: Status.Status<RoutingService.TableResults>) => {
                    //console.log('routingResult', routingResult);
                    resolve(tableResult);
                }
            );
        });
    }

    public async mapMatch(params: RoutingService.MapMatchParameters): Promise<RoutingService.MapMatchingResults> {
        // we need to divide radiuses by 3 since osrm match service will use RADIUS_MULTIPLIER of 3.
        const radiuses = params.points.features.map((feature) =>
            Math.ceil((feature.properties?.radius || defaultRoutingRadiusMeters) / 3)
        );
        const timestamps = params.points.features.map((feature) => feature.properties?.timestamp || 0);
        const routingResult = await this.callOsrmMap({
            mode: params.mode,
            points: params.points.features,
            radiuses: radiuses,
            timestamps: timestamps,
            steps: params.showSteps || true
            // gaps      : 'ignore',
            // continue_straight: Preferences.current.osrmRouting.useContinueStraightForMapMatching === true ? true : undefined // see comment in chaire-lib-common/lib/config/defaultPreferences.config.js
        });
        return this.processMapMatchingResult(routingResult);
    }

    public async route(params: RoutingService.RouteParameters): Promise<RoutingService.RouteResults> {
        const routingResult = await this.callOsrmRoute({
            mode: params.mode,
            points: params.points.features,
            steps: params.showSteps || false,
            overview: params.overview === 'simplified' ? 'simplified' : params.overview === 'false' ? 'false' : 'full',
            annotations: _isBlank(params.annotations) ? true : params.annotations,
            // gaps      : 'ignore',
            continue_straight:
                // TODO: Migrate this value from preferences to config like the osrm modes. See issue #1140
                Preferences.current.osrmRouting.useContinueStraightForMapMatching === true ? true : undefined, // see comment in chaire-lib-common/lib/config/defaultPreferences.config.js
            withAlternatives: params.withAlternatives === true ? true : false
        });
        return this.processRoutingResult(routingResult);
    }

    public async tableFrom(params: RoutingService.TableFromParameters): Promise<RoutingService.TableResults> {
        const routingResult = await this.callOsrmTableFrom({
            ...params
        });
        return Status.unwrap(routingResult);
    }

    public async tableTo(params: RoutingService.TableToParameters): Promise<RoutingService.TableResults> {
        const routingResult = await this.callOsrmTableTo({
            ...params
        });
        return Status.unwrap(routingResult);
    }
}
