/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// TODO: import old code from transition-legacy

export const geojsonToPolyBoundary = function (
    geojson: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature
): string | false {
    let geojsonPolygonGeom;
    if (geojson.type === 'FeatureCollection') {
        if (
            !geojson.features ||
            geojson.features.length === 0 ||
            !geojson.features[0] ||
            geojson.features[0].geometry.type !== 'Polygon'
        ) {
            console.error('featureCollection is empty or invalid, or first feature is not a Polygon');
            return false;
        }
        geojsonPolygonGeom = geojson.features[0].geometry;
    } else if (geojson.type === 'Feature') {
        if (geojson.geometry.type !== 'Polygon') {
            console.error('feature is not a Polygon');
            return false;
        }
        geojsonPolygonGeom = geojson.geometry;
    } else {
        geojsonPolygonGeom = geojson;
    }
    const outerCoordinates = geojsonPolygonGeom.coordinates[0];
    const polyBoundaryArray: string[] = [];
    for (let i = 0, count = outerCoordinates.length; i < count; i++) {
        polyBoundaryArray.push(`${outerCoordinates[i][1]} ${outerCoordinates[i][0]}`);
    }
    return polyBoundaryArray.join(' ');
};

export const metersToMapboxPixelsAtMaxZoom = function (meters, latitude) {
    return meters / 0.075 / Math.cos((latitude * Math.PI) / 180);
};

const metersPerPixel = function (latitude: number, zoom: number) {
    const earthCircumference = 40075017;
    const latitudeRadians = latitude * (Math.PI / 180);
    return (earthCircumference * Math.cos(latitudeRadians)) / Math.pow(2, zoom + 8);
};

export const metersToPixels = function (meters: number, latitude: number, zoom: number) {
    if (Math.abs(latitude) > 90) {
        return Number.NaN;
    }
    return meters / metersPerPixel(latitude, zoom);
};
