/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';
import { RoutingMode } from '../../config/routingModes';

// FIXME Make sure these parameters are those that apply to map matching as the name implies
export interface MapMatchParameters {
    mode: RoutingMode;
    /**
     * The collection of features by which the path should pass.
     */
    points: GeoJSON.FeatureCollection<GeoJSON.Point>;
    defaultRunningSpeed?: number | undefined | null; // we need default running speed for manual routing
    /**
     * Whether to return steps for each route
     */
    showSteps?: boolean;
    annotations?: boolean;
    overview?: string;
}

// FIXME See if those parameters can/should be merged with TripRoutingQueryAttributes, using this one instead
export interface RouteParameters {
    mode: RoutingMode;
    /**
     * The collection of features by which the path should pass.
     */
    points: GeoJSON.FeatureCollection<GeoJSON.Point>;
    defaultRunningSpeed?: number | undefined | null; // we need default running speed for manual routing
    /**
     * Whether to return steps for each route
     */
    showSteps?: boolean;
    annotations?: boolean;
    overview?: string;
    withAlternatives?: boolean;
}

export interface TableFromParameters {
    mode: RoutingMode;
    origin: GeoJSON.Feature<GeoJSON.Point>;
    destinations: GeoJSON.Feature<GeoJSON.Point>[];
}

export interface TableToParameters {
    mode: RoutingMode;
    origins: GeoJSON.Feature<GeoJSON.Point>[];
    destination: GeoJSON.Feature<GeoJSON.Point>;
}

export interface MapLeg {
    /** Distance in meters */
    distance: number;
    /** Duration in seconds */
    duration: number;
    steps: {
        distance: number;
        duration?: number;
        geometry: GeoJSON.Geometry;
        [key: string]: any;
    }[];
    [key: string]: any;
}

export interface Route {
    /**
     * The distance traveled by the route, in float meters
     */
    distance: number;
    /**
     * The estimated travel time, in float number of seconds
     */
    duration: number;
    legs: MapLeg[];
    // TODO tahini: Can we make the geometry mandatory? It's optional in osrm, that's why it's optional here for now
    geometry?: GeoJSON.Geometry;
}

export interface MatchRoute extends Route {
    confidence: number;
}

// FIXME: Make this API more general, too osrm-centric
export interface MapMatchingResults {
    /** Should match the points in the request, but will be null if no matching has been found for this point */
    tracepoints: Array<GeoJSON.Point | null>;
    matchings: MatchRoute[];
}

export interface RouteResults {
    waypoints: Array<GeoJSON.Point | null>;
    routes: Route[];
}

export interface TableResults {
    query: string;
    durations: number[];
    distances: number[];
}

export interface RoutingService {
    /**
     * Get the route passing by all points in parameters, after putting those
     * points at the proper location on the road network.
     *
     * The 'mode' parameter specifies the transportation mode to use to
     * calculate this direct path.
     *
     * The array of 'points' parameter can contain all the features in the
     * route. Various implementations may use them differently.
     *
     * @param params The query parameters. For the 'points' element, each feature
     * may have a 'radius' and 'timestamp' property to represent respectively
     * the radius of the node and the approximate timestamp to reach this node.
     * @returns Route matching result: 'tracepoints' is an array of points for
     * which a map matching has been found. If a value is null, then this point
     * couldn't be placed on the road network, so a gap should be expected in
     * the route. The 'legs' will contain the routes between each point, so
     * there will be at most n-1 legs for n points. If points couldn't be
     * placed, there will be no leg leading to/from it.
     */
    mapMatch(params: MapMatchParameters): Promise<MapMatchingResults>;

    /**
     * Get the route passing by all points in parameters, after putting those
     * points at the proper location on the road network.
     *
     * The 'mode' parameter specifies the transportation mode to use to
     * calculate this direct path.
     *
     * The array of 'points' parameter can contain all the features in the
     * route. Various implementations may use them differently.
     *
     * @param params The query parameters.
     * @returns Route matching result
     */
    route(params: RouteParameters): Promise<RouteResults>;

    /**
     * Compute the durations and distances of the fastest route between the
     * origin and each supplied destination.
     *
     * The 'mode' parameter specifies the transportation mode to use to
     * calculate this direct path.
     *
     * The 'origin' and the array of 'destinations' parameter are the point
     * features of the points to compute the fastest route for.
     *
     * @param params
     * @returns table results
     */
    tableFrom(params: TableFromParameters): Promise<TableResults>;

    /**
     * Compute the durations and distances of the fastest route between each
     * supplied origin and the destination.
     *
     * The 'mode' parameter specifies the transportation mode to use to
     * calculate this direct path.
     *
     * The array of 'origins' and the 'destination' parameter are the point
     * features of the points to compute the fastest route for.
     *
     * @param params
     * @returns table results
     */
    tableTo(params: TableToParameters): Promise<TableResults>;
}

/**
 * This class provides routing services for the application.
 */
export default abstract class RoutingServiceBase implements RoutingService {
    constructor() {
        /* Nothing to do */
    }

    protected getCoordinatesFromPoints(points: GeoJSON.FeatureCollection<GeoJSON.Point>): GeoJSON.Position[] {
        const coordinates: GeoJSON.Position[] = [];
        points.features.forEach((feature) => {
            coordinates.push(feature.geometry.coordinates);
        });
        return coordinates;
    }

    public abstract mapMatch(params: MapMatchParameters): Promise<MapMatchingResults>;

    public abstract route(params: MapMatchParameters): Promise<RouteResults>;

    public abstract tableFrom(params: TableFromParameters): Promise<TableResults>;

    public abstract tableTo(params: TableToParameters): Promise<TableResults>;
}
