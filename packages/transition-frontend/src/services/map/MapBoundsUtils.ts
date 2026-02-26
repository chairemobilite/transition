/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { type LngLatBoundsLike, type Map as MaplibreMap } from 'maplibre-gl';
import {
    bbox as turfBbox,
    bboxPolygon as turfBboxPolygon,
    booleanIntersects as turfBooleanIntersects
} from '@turf/turf';

const MIN_BBOX_DELTA = 0.001; // ~111 m latitude, ~79 m longitude at 45°N

/**
 * Computes safe bounds from any GeoJSON object, returning undefined when
 * the input has no computable extent (empty FeatureCollection, empty
 * coordinates, etc.). Degenerate (zero-area) bounding boxes are expanded
 * to a minimum span of ~111 m so MapLibre always receives a valid rectangle.
 *
 * @param geojson - Any GeoJSON object (Geometry, Feature, or FeatureCollection)
 * @returns A MapLibre-compatible LngLatBoundsLike with a guaranteed minimum
 *          span, or undefined if the input is empty
 */
const safeBoundsFromGeojson = (geojson: GeoJSON.GeoJSON): LngLatBoundsLike | undefined => {
    const bbox = turfBbox(geojson);
    // We do not support 3D bboxes, so only accept 2D bboxes:
    if (bbox.length !== 4) {
        return undefined;
    }
    if (
        !Number.isFinite(bbox[0]) ||
        !Number.isFinite(bbox[1]) ||
        !Number.isFinite(bbox[2]) ||
        !Number.isFinite(bbox[3])
    ) {
        return undefined;
    }
    let [minLng, minLat, maxLng, maxLat] = bbox;
    if (maxLng - minLng < MIN_BBOX_DELTA) {
        const midLng = (minLng + maxLng) / 2;
        minLng = midLng - MIN_BBOX_DELTA / 2;
        maxLng = midLng + MIN_BBOX_DELTA / 2;
    }
    if (maxLat - minLat < MIN_BBOX_DELTA) {
        const midLat = (minLat + maxLat) / 2;
        minLat = midLat - MIN_BBOX_DELTA / 2;
        maxLat = midLat + MIN_BBOX_DELTA / 2;
    }
    minLng = Math.min(180, Math.max(-180, minLng));
    maxLng = Math.min(180, Math.max(-180, maxLng));
    minLat = Math.min(90, Math.max(-90, minLat));
    maxLat = Math.min(90, Math.max(-90, maxLat));
    return [
        [minLng, minLat],
        [maxLng, maxLat]
    ];
};

/**
 * Computes safe bounds from any GeoJSON object and calls map.fitBounds.
 * Silently skips the call when the GeoJSON has no computable extent
 * (empty FeatureCollection, empty coordinates, etc.).
 * Note: There could be errors in bounds if the map is rotated. TODO: handle this? if needed...
 *
 * @param map - The MapLibre map instance
 * @param geojson - Any GeoJSON object (Geometry, Feature, or FeatureCollection)
 * @param padding - Pixel padding around the fitted bounds (default 20)
 */
export const safeFitBounds = (map: MaplibreMap, geojson: GeoJSON.GeoJSON, padding = 20): void => {
    const bounds = safeBoundsFromGeojson(geojson);
    if (bounds) {
        map.fitBounds(bounds, { padding, bearing: map.getBearing() });
    }
};

/** Fraction of the viewport to shrink on each side for the visibility test. */
const VIEWPORT_MARGIN_RATIO = 0.05;

/**
 * Tests whether any part of a GeoJSON object intersects the given viewport
 * polygon. Handles FeatureCollections (skipping null geometries), Features
 * with null geometry (always invisible), and bare Geometry objects.
 *
 * @param geojson - Any GeoJSON object (Geometry, Feature, or FeatureCollection)
 * @param viewport - The viewport as a GeoJSON Polygon feature
 * @returns True if any part of the geojson intersects the viewport, false otherwise
 */
const geojsonIntersectsViewport = (geojson: GeoJSON.GeoJSON, viewport: GeoJSON.Feature<GeoJSON.Polygon>): boolean => {
    if (geojson.type === 'FeatureCollection') {
        return geojson.features
            .filter((f) => f.geometry !== null && f.geometry !== undefined)
            .some((f) => turfBooleanIntersects(f, viewport));
    }
    if (geojson.type === 'Feature' && (geojson.geometry === null || geojson.geometry === undefined)) {
        return false;
    }
    return turfBooleanIntersects(geojson, viewport);
};

/**
 * Returns the current map viewport as a GeoJSON Polygon feature, optionally
 * shrunk by {@link marginRatio} on every side. A margin of 0 gives the full
 * viewport; the default ({@link VIEWPORT_MARGIN_RATIO}) yields the "inner"
 * viewport used by visibility tests.
 *
 * @param map - The MapLibre map instance
 * @param marginRatio - Fraction of viewport width/height to trim per side (default {@link VIEWPORT_MARGIN_RATIO}), clamped to 0.49
 */

const getMapViewportAsGeoJSON = (
    map: MaplibreMap,
    marginRatio = VIEWPORT_MARGIN_RATIO
): GeoJSON.Feature<GeoJSON.Polygon> => {
    const viewportBounds = map.getBounds();
    const clampedMarginRatio = Math.min(0.49, Math.max(0, marginRatio));
    const marginLng = Math.max(0, (viewportBounds.getEast() - viewportBounds.getWest()) * clampedMarginRatio);
    const marginLat = Math.max(0, (viewportBounds.getNorth() - viewportBounds.getSouth()) * clampedMarginRatio);
    return turfBboxPolygon([
        viewportBounds.getWest() + marginLng,
        viewportBounds.getSouth() + marginLat,
        viewportBounds.getEast() - marginLng,
        viewportBounds.getNorth() - marginLat
    ]);
};

/**
 * Returns true when the map's internal canvas size (in CSS pixels) no
 * longer matches the container element, meaning `getBounds()` would
 * return a stale viewport. This happens when a panel mounts or resizes
 * right before a bounds query and MapLibre's ResizeObserver hasn't
 * fired yet. The 0.5 px tolerance absorbs sub-pixel rounding that
 * occurs when the browser converts between CSS and device pixels.
 *
 * @param map - The MapLibre map instance
 * @returns True if the map's canvas size is out of sync with the container, false otherwise
 */
const isMapCanvasOutOfSync = (map: MaplibreMap): boolean => {
    const canvas = map.getCanvas();
    const container = map.getContainer();
    const dpr = window.devicePixelRatio || 1;
    return (
        Math.abs(canvas.width / dpr - container.clientWidth) > 0.5 ||
        Math.abs(canvas.height / dpr - container.clientHeight) > 0.5
    );
};

/**
 * Calls fitBounds on the map when the actual GeoJSON geometry does not
 * intersect the *inner* portion of the viewport (shrunk by
 * {@link VIEWPORT_MARGIN_RATIO} on every side).
 *
 * Unlike a bounding-box check, this tests the real geometry so that
 * concave shapes (e.g. a C-shaped path whose bbox covers the viewport
 * but whose line does not cross it) correctly trigger a fit.
 *
 * Silently skips when the GeoJSON has no computable extent.
 *
 * @param map - The MapLibre map instance
 * @param geojson - Any GeoJSON object (Geometry, Feature, or FeatureCollection)
 * @param padding - Pixel padding around the fitted bounds (default 20)
 */
export const fitBoundsIfNotVisible = (map: MaplibreMap, geojson: GeoJSON.GeoJSON, padding = 20): void => {
    const bounds = safeBoundsFromGeojson(geojson);
    if (!bounds) {
        return;
    }
    if (isMapCanvasOutOfSync(map)) {
        map.resize();
    }
    const innerViewport = getMapViewportAsGeoJSON(map);
    const visible = geojsonIntersectsViewport(geojson, innerViewport);
    if (!visible) {
        map.fitBounds(bounds, { padding, bearing: map.getBearing() });
    }
};
