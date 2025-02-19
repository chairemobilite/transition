/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const layersConfig = {
    routingPoints: {
        // for routing origin, destination and waypoints
        type: 'circle',
        fillColor: { type: 'property', property: 'color' },
        strokeColor: [255, 255, 255],
        strokeWidth: 1,
        radius: 5,
        radiusScale: 3,
        maxRadiusPixels: 10,
        minRadiusPixels: 3,
        strokeWidthScale: 3
    },

    accessibilityMapPoints: {
        type: 'circle',
        fillColor: { type: 'property', property: 'color' },
        strokeColor: [255, 255, 255],
        strokeWidth: 1,
        radius: 5,
        radiusScale: 3,
        maxRadiusPixels: 10,
        minRadiusPixels: 3,
        strokeWidthScale: 3
    },

    accessibilityMapPolygons: {
        type: 'fill',
        color: { type: 'property', property: 'color' },
        lineColor: '#ffffff33',
        lineWidth: 4,
        opacity: 0.2,
        pickable: false
    },

    routingPaths: {
        type: 'animatedArrowPath',
        stroked: true,
        color: { type: 'property', property: 'color' },
        width: 10,
        widthScale: 1,
        widthMinPixels: 5,
        widthMaxPixels: 13,
        capRounded: true,
        jointRounded: true,
        pickable: false
    },

    transitPaths: {
        type: 'line',
        minZoom: 9,
        featureMinZoom: (feature: GeoJSON.Feature) => {
            const mode = feature.properties?.mode;
            if (typeof mode !== 'string') {
                // Always display this feature
                return 0;
            }
            return ['rail', 'highSpeedRail', 'metro', 'water'].includes(mode)
                ? 9
                : ['monorail', 'tram', 'tramTrain', 'gondola', 'funicular', 'cableCar'].includes(mode)
                    ? 10
                    : 11;
        },
        canFilter: true,
        color: { type: 'property', property: 'color' },
        opacity: 0.8,
        widthScale: 4,
        widthMinPixels: 2,
        widthMaxPixels: 6,
        capRounded: true,
        jointRounded: true,
        autoHighlight: true
    },

    transitPathsSelected: {
        type: 'animatedArrowPath',
        stroked: true,
        color: { type: 'property', property: 'color' },
        width: 10,
        widthScale: 1,
        widthMinPixels: 5,
        widthMaxPixels: 13,
        capRounded: true,
        jointRounded: true
    },

    transitPathWaypoints: {
        type: 'circle',
        fillColor: [0, 0, 0, 128],
        strokeColor: (waypoint: GeoJSON.Feature) =>
            waypoint.properties?.isWaypointInError === true ? [255, 0, 0, 180] : [255, 255, 255, 180],
        strokeWidth: 1,
        maxRadiusPixels: 13,
        minRadiusPixels: 3,
        radius: 4,
        radiusScale: 3,
        strokeWidthScale: 3
    },

    transitPathWaypointsSelected: {
        type: 'circle',
        fillColor: [0, 0, 0, 128],
        strokeColor: [255, 255, 255, 220],
        strokeWidth: 1,
        radius: 4,
        radiusScale: 3,
        strokeWidthScale: 3
    },

    transitPathsForServices: {
        type: 'line',
        minZoom: 9,
        color: { type: 'property', property: 'color' },
        opacity: 0.8,
        widthScale: 4,
        widthMinPixels: 2,
        capRounded: true,
        jointRounded: true,
        autoHighlight: true
    },

    transitNodes: {
        type: 'circle',
        minZoom: 11,
        fillColor: { type: 'property', property: 'color' },
        strokeColor: [255, 255, 255, 255],
        strokeWidth: 2,
        radius: 5,
        radiusScale: 3,
        strokeWidthScale: 3,
        maxRadiusPixels: 10,
        minRadiusPixels: 1,
        autoHighlight: true,
        pickable: () => serviceLocator.selectedObjectsManager.get('node') === undefined
    },

    transitNodes250mRadius: {
        type: 'circle',
        fillColor: [151, 255, 66, 20],
        strokeColor: [151, 255, 66, 25],
        strokeWidth: 3,
        radius: 250,
        pickable: false
    },

    transitNodes500mRadius: {
        type: 'circle',
        fillColor: [211, 255, 66, 16],
        strokeColor: [211, 255, 66, 20],
        strokeWidth: 3,
        radius: 500,
        pickable: false
    },

    transitNodes750mRadius: {
        type: 'circle',
        fillColor: [255, 220, 66, 6],
        strokeColor: [255, 220, 66, 10],
        strokeWidth: 3,
        radius: 750,
        pickable: false
    },

    transitNodes1000mRadius: {
        type: 'circle',
        fillColor: [255, 85, 66, 16],
        strokeColor: [255, 85, 66, 20],
        strokeWidth: 3,
        radius: 1000,
        pickable: false
    },

    transitNodesSelected: {
        type: 'circle',
        minZoom: 11,
        fillColor: { type: 'property', property: 'color' },
        // FIXME: This layer is used for all selected nodes, see if this function causes performance problems and set stroke color directly instead of through an error property
        strokeColor: (node: GeoJSON.Feature) =>
            node.properties?.isNodeIsError === true ? [255, 0, 0] : [255, 255, 255],
        strokeWidth: 2,
        radius: 7,
        maxRadiusPixels: 15,
        minRadiusPixels: 5,
        radiusScale: 3,
        strokeWidthScale: 3
    },

    transitNodesRoutingRadius: {
        type: 'circle',
        fillColor: (node: GeoJSON.Feature) => {
            const opacity = Math.floor(0.2 * 255); // 20%
            const color = node.properties?.color;
            if (typeof color === 'string' && color.startsWith('#')) {
                return `${color.substring(0, 7)}${opacity.toString(16)}`;
            }
            if (Array.isArray(color)) {
                if (color.length === 3) {
                    color.push(opacity);
                } else if (color.length > 3) {
                    color[3] = opacity;
                }
                return color;
            }
            return '#0086FF33';
        },
        strokeColor: (node: GeoJSON.Feature) => {
            const opacity = Math.floor(0.3 * 255); // 30%
            const color = node.properties?.color;
            if (typeof color === 'string' && color.startsWith('#')) {
                return `${color.substring(0, 7)}${opacity.toString(16)}`;
            }
            if (Array.isArray(color)) {
                if (color.length === 3) {
                    color.push(opacity);
                } else if (color.length > 3) {
                    color[3] = opacity;
                }
                return color;
            }
            return '#0086FF4C';
        },
        strokeWidth: 3,
        radius: {
            type: 'property',
            property: 'routing_radius_meters'
        },
        pickable: false
    }
};

export default layersConfig;
