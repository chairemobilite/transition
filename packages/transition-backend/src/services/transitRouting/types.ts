/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { ResultsByMode } from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';

export type OdTripRouteResult = {
    uuid: string;
    internalId: string;
    origin?: GeoJSON.Point;
    destination?: GeoJSON.Point;
    results?: ResultsByMode;
    error?: string | { error: string; errorCode: string };
};

export type OdTripRouteOutput = {
    csv?: string[] | undefined;
    csvDetailed?: string[] | undefined;
    geometries?: Feature<Geometry, GeoJsonProperties>[] | undefined;
};
