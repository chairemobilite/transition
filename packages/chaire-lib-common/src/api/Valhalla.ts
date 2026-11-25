/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Valhalla route request options.
 *
 * https://valhalla.github.io/valhalla/api/route/api-reference/
 */

export interface ValhallaRouteOptions {
    // General request options
    id?: string;
    costing?: ValhallaCosting;
    units?: 'kilometers' | 'km' | 'miles' | 'mi';
    language?: string;

    // Route output options
    format?: 'json' | 'gpx' | 'osrm' | 'pbf';
    directions_type?: 'none' | 'maneuvers' | 'instructions';
    shape_format?: 'polyline6' | 'polyline5' | 'geojson' | 'no_shape';
    alternates?: number;

    // Additional output options
    narrative?: boolean;
    banner_instructions?: boolean;
    voice_instructions?: boolean;

    // Time-dependent routing
    date_time?: {
        type: 0 | 1 | 2;
        value?: string;
    };

    // Locations to avoid
    exclude_locations?: ValhallaLocation[];

    // Costing options, specific to the selected costing model
    costing_options?: ValhallaCostingOptions;
}

export interface ValhallaMatchOptions {
    // General request options
    id?: string;
    costing?: ValhallaCosting;
    units?: 'kilometers' | 'km' | 'miles' | 'mi';
    language?: string;

    // Trace input
    shape: ValhallaTracePoint[];
    shape_match?: 'edge_walk' | 'map_snap';
    costing_model?: string;

    // Trace matching options
    trace_options?: {
        search_radius?: number;
        gps_accuracy?: number;
        breakage_distance?: number;
        interpolation_distance?: number;
    };

    // Route output options
    format?: 'json' | 'gpx' | 'osrm' | 'pbf';
    directions_type?: 'none' | 'maneuvers' | 'instructions';
    shape_format?: 'polyline6' | 'polyline5' | 'geojson' | 'no_shape';

    // Additional output options
    narrative?: boolean;
    banner_instructions?: boolean;
    voice_instructions?: boolean;

    // Time-dependent routing
    date_time?: {
        type: 0 | 1 | 2;
        value?: string;
    };

    // Costing options
    costing_options?: ValhallaCostingOptions;
}

export interface ValhallaTracePoint {
    lat: number;
    lon: number;
    time?: number;
    accuracy?: number;
    heading?: number;
    altitude?: number;
    speed?: number;
}

export type ValhallaCosting =
    | 'auto'
    | 'auto_shorter'
    | 'bicycle'
    | 'bus'
    | 'taxi'
    | 'truck'
    | 'motor_scooter'
    | 'motorcycle'
    | 'pedestrian'
    | 'multimodal'
    | 'bikeshare'
    | 'auto_pedestrian';

export interface ValhallaLocation {
    lat: number;
    lon: number;
    type?: 'break' | 'through';
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    heading?: number;
    heading_tolerance?: number;
    node_snap_tolerance?: number;
    way_id?: number;
    minimum_reachability?: number;
    radius?: number;
    rank_candidates?: boolean;
}

export interface ValhallaCostingOptions {
    auto?: Record<string, unknown>;
    auto_shorter?: Record<string, unknown>;
    bicycle?: Record<string, unknown>;
    bus?: Record<string, unknown>;
    taxi?: Record<string, unknown>;
    truck?: Record<string, unknown>;
    motor_scooter?: Record<string, unknown>;
    motorcycle?: Record<string, unknown>;
    pedestrian?: Record<string, unknown>;
    multimodal?: Record<string, unknown>;
    bikeshare?: Record<string, unknown>;
    auto_pedestrian?: Record<string, unknown>;
}

export interface ValhallaRouteResults {
    trip: ValhallaTrip;
    id?: string;
}

export interface ValhallaTrip {
    status: number;
    status_message: string;
    units: 'kilometers' | 'miles';
    language: string;
    locations: ValhallaLocation[];
    summary: ValhallaSummary;
    legs: ValhallaLeg[];
    warnings?: ValhallaWarning[];
}

export interface ValhallaSummary {
    time: number;
    length: number;
    min_lat: number;
    min_lon: number;
    max_lat: number;
    max_lon: number;
}

export interface ValhallaLeg {
    summary: ValhallaSummary;
    shape: string;
    maneuvers: ValhallaManeuver[];
    elevation?: number[];
    elevation_interval?: number;
}

export interface ValhallaManeuver {
    type: number;
    instruction: string;
    verbal_transition_alert_instruction?: string;
    verbal_pre_transition_instruction?: string;
    verbal_post_transition_instruction?: string;
    street_names?: string[];
    begin_street_names?: string[];
    time: number;
    length: number;
    begin_shape_index: number;
    end_shape_index: number;
    toll?: boolean;
    highway?: boolean;
    rough?: boolean;
    gate?: boolean;
    ferry?: boolean;
    roundabout_exit_count?: number;
    verbal_multi_cue?: boolean;
    travel_mode?: string;
    travel_type?: string;
    depart_instruction?: string;
    verbal_depart_instruction?: string;
    arrive_instruction?: string;
    verbal_arrive_instruction?: string;
    sign?: ValhallaSign;
    transit_info?: ValhallaTransitInfo;
}

export interface ValhallaSign {
    exit_number_elements?: Array<{
        text: string;
        consecutive_count?: number;
    }>;
    exit_branch_elements?: Array<{
        text: string;
        consecutive_count?: number;
    }>;
    exit_toward_elements?: Array<{
        text: string;
        consecutive_count?: number;
    }>;
    exit_name_elements?: Array<{
        text: string;
        consecutive_count?: number;
    }>;
}

export interface ValhallaTransitInfo {
    onestop_id?: string;
    short_name?: string;
    long_name?: string;
    headsign?: string;
    description?: string;
    operator_onestop_id?: string;
    operator_name?: string;
    operator_url?: string;
    transit_stops?: ValhallaTransitStop[];
}

export interface ValhallaTransitStop {
    type?: string;
    name?: string;
    arrival_date_time?: string;
    departure_date_time?: string;
    assumed_schedule?: boolean;
}

export interface ValhallaWarning {
    code: number;
    message: string;
}

export type ValhallaMatchResults = ValhallaRouteResults;

/**
 * Valhalla isochrone contour.
 * Exactly one of time or distance must be specified.
 */
export type ValhallaIsochroneContour =
    | {
          time: number;
          distance?: never;
          color?: string;
      }
    | {
          distance: number;
          time?: never;
          color?: string;
      };

/**
 * Valhalla isochrone request options.
 *
 * https://valhalla.github.io/valhalla/api/isochrone/
 */
export interface ValhallaIsochroneOptions {
    // General request options
    id?: string;
    costing?: ValhallaCosting;
    units?: 'kilometers' | 'km' | 'miles' | 'mi';
    language?: string;
    format?: 'json' | 'geotiff';

    // Locations
    locations: ValhallaLocation[];

    // Costing options
    costing_options?: ValhallaCostingOptions;
    date_time?: {
        type: 0 | 1 | 2;
        value?: string;
    };
    exclude_locations?: ValhallaLocation[];

    // Isochrone options
    contours: ValhallaIsochroneContour[];
    polygons?: boolean;
    denoise?: number;
    generalize?: number;
    show_locations?: boolean;
    reverse?: boolean;
}

/**
 * Properties of a Valhalla isochrone contour.
 */
export interface ValhallaIsochroneProperties {
    contour: number;
    metric: 'time' | 'distance';

    // Styling properties
    color?: string;
    fill?: string;
    fillColor?: string;
    opacity?: number;
    fillOpacity?: number;
    'fill-opacity'?: number;
}

/**
 * Possible geometries returned by the Valhalla isochrone API.
 */
export type ValhallaIsochroneGeometry =
    | GeoJSON.LineString
    | GeoJSON.MultiLineString
    | GeoJSON.Polygon
    | GeoJSON.MultiPolygon
    | GeoJSON.MultiPoint;

/**
 * Valhalla isochrone results.
 */
export type ValhallaIsochroneResults = GeoJSON.FeatureCollection<
    ValhallaIsochroneGeometry,
    ValhallaIsochroneProperties
> & {
    name?: string;
    warnings?: ValhallaWarning[];
};