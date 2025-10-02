/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { circle as turfCircle } from '@turf/turf';
import { DataGeojson } from 'chaire-lib-backend/lib/tasks/dataImport/data/dataGeojson';
import osmDownloader from 'chaire-lib-backend/lib/utils/osm/OsmOverpassDownloader';
import streetsXMLQuery from 'chaire-lib-backend/lib/config/osm/overpassQueries/streets';
import * as Status from 'chaire-lib-common/lib/utils/Status';

/*
This function is used to get the streets around a point.
It uses the OSM overpass API to get the streets around a point.
Streets are osm highways with value in this list (see overpass query in file streetsXMLQuery):
    residential|trunk|trunk_link|primary|primary_link|secondary|secondary_link|
    tertiary|tertiary_link|service|motorway|motorway_link|pedestrian|living_street|
    unclassified|bus_guideway|busway
*/
export const getStreetsAroundPoint = async function (
    aroundPoint: GeoJSON.Feature<GeoJSON.Point>,
    radiusMeters: number
): Promise<Status.Status<GeoJSON.Feature<GeoJSON.LineString>[]>> {
    if (radiusMeters <= 0) {
        return Status.createError('Radius must be greater than 0');
    }
    const circleGeojson = turfCircle(aroundPoint, radiusMeters, { units: 'meters' });
    try {
        const osmGeojsonDataFetcher = new DataGeojson(
            await osmDownloader.downloadGeojson(circleGeojson, streetsXMLQuery)
        );
        const result = osmGeojsonDataFetcher.query({}) as GeoJSON.Feature<GeoJSON.LineString>[]; // empty query returns all data
        return Status.createOk(result);
    } catch (error) {
        return Status.createError(error);
    }
};
