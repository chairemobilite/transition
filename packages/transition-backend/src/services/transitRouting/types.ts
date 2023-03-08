/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';

export type OdTripRouteOutput = {
    csv?: string[] | undefined;
    csvDetailed?: string[] | undefined;
    geometries?: Feature<Geometry, GeoJsonProperties>[] | undefined;
    result?: TransitRoutingResult | undefined;
};
