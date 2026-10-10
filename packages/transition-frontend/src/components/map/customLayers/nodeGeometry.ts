/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Feature, Point } from 'geojson';
import { MercatorCoordinate } from 'maplibre-gl';
import { bbox as turfBbox, multiPoint as turfMultiPoint } from '@turf/turf';
import { hexToRgbArray } from 'chaire-lib-common/lib/utils/ColorUtils';

/**
 * Calculate radius for selected nodes based on zoom level (exponential interpolation)
 * @param zoom - Current map zoom
 * @returns Radius in pixels
 */
export const calculateNodeRadiusForZoom = (zoom: number): number => {
    if (zoom <= 10) {
        return 0 + (2 - 0) * Math.pow(2, (zoom - 0) / (10 - 0));
    } else if (zoom <= 15) {
        return 2 + (6 - 2) * Math.pow(2, (zoom - 10) / (15 - 10));
    } else if (zoom <= 20) {
        return 6 + (12 - 6) * Math.pow(2, (zoom - 15) / (20 - 15));
    } else {
        return 12 + (zoom - 20) * 2;
    }
};

/** Fallback color for nodes without a valid `color` property */
const DEFAULT_COLOR_HEX = '#808080';

/** Per-node instance data for the GPU, ready to upload in vertex buffers */
export type NodeInstances = {
    /**
     * Mercator origin of the positions, kept in float64. Float32 Mercator coordinates have a
     * resolution of about 2 m, so positions are stored relative to this origin.
     */
    origin: [number, number];
    /** Mercator [x, y] of each node, relative to `origin` */
    positions: Float32Array;
    /** [r, g, b, a] of each node, 0-255 */
    colors: Uint8Array;
    /** Number of nodes */
    count: number;
};

const isPointFeature = (feature: Feature): feature is Feature<Point> =>
    feature?.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates);

/**
 * Build the instance buffers of the node spinner layer. Features that are not points are skipped.
 *
 * @param features GeoJSON features, Points with an optional `color` property (hex or rgb(a) string)
 * @returns The instance data, with the origin at the center of the nodes' bounding box
 */
export const buildNodeInstances = (features: Feature[]): NodeInstances => {
    const mercatorPoints = features.filter(isPointFeature).map((feature) => ({
        mercator: MercatorCoordinate.fromLngLat([feature.geometry.coordinates[0], feature.geometry.coordinates[1]]),
        color: hexToRgbArray(feature.properties?.color, DEFAULT_COLOR_HEX)
    }));
    const count = mercatorPoints.length;
    const positions = new Float32Array(count * 2);
    const colors = new Uint8Array(count * 4);
    if (count === 0) {
        return { origin: [0, 0], positions, colors, count };
    }

    const [minX, minY, maxX, maxY] = turfBbox(
        turfMultiPoint(mercatorPoints.map((point) => [point.mercator.x, point.mercator.y]))
    );
    const origin: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
    mercatorPoints.forEach((point, i) => {
        positions[i * 2] = point.mercator.x - origin[0];
        positions[i * 2 + 1] = point.mercator.y - origin[1];
        colors.set(point.color, i * 4);
    });
    return { origin, positions, colors, count };
};
