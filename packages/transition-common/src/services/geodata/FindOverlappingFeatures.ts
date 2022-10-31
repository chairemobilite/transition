/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// FIXME: Is this method still useful or was it just a quick to prototype data importation stuff?
import GeoJSON from 'geojson';
import { booleanPointInPolygon as turfPointInPolygon, booleanPointOnLine as turfPointInLine } from '@turf/turf';

import { PlaceAttributes } from '../places';

const getComparisonMethod = (feature: GeoJSON.Feature) => {
    if (feature.geometry.type === 'LineString') {
        return turfPointInLine;
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        return turfPointInPolygon;
    }
    return undefined;
};

export const findOverlappingPlaces = (
    feature,
    places: PlaceAttributes[],
    options: { not: boolean } = { not: false }
): PlaceAttributes[] => {
    const comparisonMethod = getComparisonMethod(feature);
    if (!comparisonMethod) {
        console.warn('Cannot find overlapping geometries for feature type ', feature.geometry);
        return options.not ? places : [];
    }
    return places.filter((place) => {
        const overlaps = comparisonMethod(place.geography, feature.geometry);
        return options.not ? !overlaps : overlaps;
    });
};
