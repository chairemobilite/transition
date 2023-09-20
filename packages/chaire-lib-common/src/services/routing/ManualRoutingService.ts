/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as RoutingService from './RoutingService';
import * as turf from '@turf/turf';
import _cloneDeep from 'lodash/cloneDeep';

/**
 * This class provides routing services using manual routing. This mode will always return return results
 */
export default class ManualRoutingService extends RoutingService.default {
    async directRouting(
        nodesAndWaypointsGeojsons: Array<GeoJSON.Feature<GeoJSON.Point>>,
        defaultRunningSpeedMps: number | undefined | null,
        oneLegPerWaypoint = true
    ): Promise<RoutingService.RouteResults> {
        const lineString = turf.lineString(
            nodesAndWaypointsGeojsons.map((geojson) => {
                return geojson.geometry.coordinates;
            })
        );
        const lineLength = turf.length(lineString, { units: 'meters' });
        if (defaultRunningSpeedMps === undefined || defaultRunningSpeedMps === null || defaultRunningSpeedMps === 0) {
            defaultRunningSpeedMps = 30 / 3.6; // this should not happen!
        }
        const runningSpeed = defaultRunningSpeedMps;
        const birdDistanceDuration = Math.ceil(lineLength / runningSpeed);
        const legs: RoutingService.MapLeg[] = [];
        let legCoordinates: GeoJSON.Position[] = [];

        nodesAndWaypointsGeojsons.forEach((nodeOrWaypoint, pointIndex) => {
            legCoordinates.push(nodeOrWaypoint.geometry.coordinates);
            //console.log('legCoordinates', JSON.parse(JSON.stringify(legCoordinates)));
            if (
                (oneLegPerWaypoint ||
                    nodeOrWaypoint.properties?.isNode === true ||
                    pointIndex === nodesAndWaypointsGeojsons.length - 1) &&
                pointIndex > 0
            ) {
                const legGeojson = turf.lineString(_cloneDeep(legCoordinates));
                const legLength = turf.length(legGeojson, { units: 'meters' });
                legs.push({
                    distance: legLength,
                    duration: Math.ceil(legLength / runningSpeed),
                    steps: [
                        {
                            distance: legLength,
                            geometry: legGeojson.geometry
                        }
                    ]
                });
                legCoordinates = [_cloneDeep(legCoordinates[legCoordinates.length - 1])];
            }
        });
        return {
            waypoints: nodesAndWaypointsGeojsons.map((point) => point.geometry),
            routes: [
                {
                    distance: lineLength,
                    duration: birdDistanceDuration,
                    legs
                }
            ]
        };
    }

    private routeToMapResults(results: RoutingService.RouteResults): RoutingService.MapMatchingResults {
        return {
            tracepoints: results.waypoints,
            matchings: results.routes.map((route) => {
                return { confidence: 1, ...route };
            })
        };
    }

    public async mapMatch(params: RoutingService.MapMatchParameters): Promise<RoutingService.MapMatchingResults> {
        const routingResult = await this.directRouting(params.points.features, params.defaultRunningSpeed, true);

        return this.routeToMapResults(routingResult);
    }

    public async route(params: RoutingService.MapMatchParameters): Promise<RoutingService.RouteResults> {
        const routingResult = await this.directRouting(params.points.features, params.defaultRunningSpeed, true);

        return routingResult;
    }

    public tableFrom(_params: RoutingService.TableFromParameters): Promise<RoutingService.TableResults> {
        // TODO: Implement using bird distances
        throw new Error('ManualRoutingService tableFrom Method not implemented.');
    }

    public tableTo(_params: RoutingService.TableToParameters): Promise<RoutingService.TableResults> {
        // TODO: Implement using bird distances
        throw new Error('ManualRoutingService tableTo Method not implemented.');
    }
}
