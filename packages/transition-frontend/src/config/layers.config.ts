/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const layersConfig = {
    measureToolLine: {
        type: 'line',
        color: [255, 255, 255, 150],
        strokeWidth: 1,
        widthUnits: 'pixels',
        widthScale: 1,
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true
    },

    measureToolText: {
        type: 'text',
        //fontFamily: 'Arial',
        //fontWeight: 'bold',
        fontSize: '1.5rem',
        background: true,
        backgroundPadding: 2
    },

    measureToolPoint: {
        type: 'circle',
        radiusUnits: 'pixels',
        strokeColor: [255, 255, 255, 150],
        strokeWidth: 2,
        fillColor: [0, 0, 0, 255],
        radius: 4,
        radiusScale: 1,
        lineWidthScale: 1,
        lineWidthUnits: 'pixels'
    },

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

    routingPathsStrokes: {
        type: 'line',
        color: { type: 'property', property: 'color' }, //'#ffffffff',
        opacity: 0.7,
        width: 6,
        widthScale: 1.5,
        capRounded: true,
        jointRounded: true
    },

    routingPaths: {
        type: 'animatedArrowPath',
        color: { type: 'property', property: 'color' },
        width: 10,
        widthScale: 1,
        widthMinPixels: 5,
        capRounded: true,
        jointRounded: true
    },

    isochronePolygons: {
        type: 'fill',
        paint: {
            'fill-color': {
                property: 'color',
                type: 'identity'
            },
            'fill-opacity': 0.1
        }
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
        capRounded: true,
        jointRounded: true,
        autoHighlight: true
    },

    // TODO Port to deck.gl: try to use a custom layer type to include stroked offset on a line. See https://deck.gl/docs/api-reference/extensions/path-style-extension for an example, with source code https://github.com/visgl/deck.gl/blob/master/modules/extensions/src/path-style/path-style-extension.ts
    transitPathsStroke: {
        type: 'line',
        minZoom: 15,
        layout: {
            'line-join': 'miter',
            'line-cap': 'butt'
        },
        paint: {
            'line-offset': {
                // we should use turf.js to offset beforehand,
                //but turf offset is not based on zoom and 180 degrees turns creates random coordinates
                base: 1,
                stops: [
                    [13, 0],
                    [16, 4],
                    [20, 20]
                ]
            },
            'line-color': 'rgba(0,0,0,0.5)',
            'line-opacity': {
                property: 'route_type_shortname',
                type: 'categorical',
                default: 1,
                base: 1,
                stops: [
                    [{ zoom: 0, value: 'bus' }, 0.0],
                    [{ zoom: 0, value: 'tram' }, 0.1],
                    [{ zoom: 0, value: 'metro' }, 0.1],
                    [{ zoom: 0, value: 'rail' }, 0.1],
                    [{ zoom: 0, value: 'ferry' }, 0.1],
                    [{ zoom: 0, value: 'cableCar' }, 0.1],
                    [{ zoom: 0, value: 'gondola' }, 0.1],
                    [{ zoom: 0, value: 'funicular' }, 0.1],

                    [{ zoom: 7, value: 'bus' }, 0.05],
                    [{ zoom: 7, value: 'tram' }, 0.3],
                    [{ zoom: 7, value: 'metro' }, 0.3],
                    [{ zoom: 7, value: 'rail' }, 0.3],
                    [{ zoom: 7, value: 'ferry' }, 0.3],
                    [{ zoom: 7, value: 'cableCar' }, 0.3],
                    [{ zoom: 7, value: 'gondola' }, 0.3],
                    [{ zoom: 7, value: 'funicular' }, 0.3],

                    [{ zoom: 10, value: 'bus' }, 0.2],
                    [{ zoom: 10, value: 'tram' }, 0.6],
                    [{ zoom: 10, value: 'metro' }, 0.6],
                    [{ zoom: 10, value: 'rail' }, 0.6],
                    [{ zoom: 10, value: 'ferry' }, 0.6],
                    [{ zoom: 10, value: 'cableCar' }, 0.6],
                    [{ zoom: 10, value: 'gondola' }, 0.6],
                    [{ zoom: 10, value: 'funicular' }, 0.6],

                    [{ zoom: 15, value: 'bus' }, 0.5],
                    [{ zoom: 15, value: 'tram' }, 0.8],
                    [{ zoom: 15, value: 'metro' }, 1.0],
                    [{ zoom: 15, value: 'rail' }, 0.8],
                    [{ zoom: 15, value: 'ferry' }, 0.8],
                    [{ zoom: 15, value: 'cableCar' }, 0.8],
                    [{ zoom: 15, value: 'gondola' }, 0.8],
                    [{ zoom: 15, value: 'funicular' }, 0.8]
                ]
            },
            //"line-width": {
            //  'base': 1,
            //  'stops': [[5,3], [11, 5], [15, 9]]
            //}
            'line-width': {
                property: 'route_type_shortname',
                type: 'categorical',
                default: 1,
                base: 1,
                stops: [
                    [{ zoom: 0, value: 'bus' }, 1],
                    [{ zoom: 0, value: 'tram' }, 1],
                    [{ zoom: 0, value: 'metro' }, 1],
                    [{ zoom: 0, value: 'rail' }, 1],
                    [{ zoom: 0, value: 'ferry' }, 1],
                    [{ zoom: 0, value: 'cableCar' }, 1],
                    [{ zoom: 0, value: 'gondola' }, 1],
                    [{ zoom: 0, value: 'funicular' }, 1],

                    [{ zoom: 10, value: 'bus' }, 3],
                    [{ zoom: 10, value: 'tram' }, 5],
                    [{ zoom: 10, value: 'metro' }, 5],
                    [{ zoom: 10, value: 'rail' }, 5],
                    [{ zoom: 10, value: 'ferry' }, 5],
                    [{ zoom: 10, value: 'cableCar' }, 5],
                    [{ zoom: 10, value: 'gondola' }, 5],
                    [{ zoom: 10, value: 'funicular' }, 5],

                    [{ zoom: 15, value: 'bus' }, 5],
                    [{ zoom: 15, value: 'tram' }, 7],
                    [{ zoom: 15, value: 'metro' }, 9],
                    [{ zoom: 15, value: 'rail' }, 7],
                    [{ zoom: 15, value: 'ferry' }, 7],
                    [{ zoom: 15, value: 'cableCar' }, 7],
                    [{ zoom: 15, value: 'gondola' }, 7],
                    [{ zoom: 15, value: 'funicular' }, 7]
                ]
            }
        }
    },

    // TODO Port to deck.gl: Same comment as above
    transitPathsHoverStroke: {
        type: 'line',
        repaint: true,
        layout: {
            'line-join': 'miter',
            'line-cap': 'butt'
            //"line-round-limit": 1.05
        },
        paint: {
            'line-offset': {
                base: 1,
                stops: [
                    [13, 0],
                    [16, 4],
                    [20, 20]
                ]
            },
            'line-color': 'rgba(255,255,255,1.0)',
            'line-opacity': 0.7,
            'line-width': {
                base: 1,
                stops: [
                    [6, 7],
                    [12, 9],
                    [13, 11]
                ]
            }
        }
    },

    transitPathsSelected: {
        type: 'animatedArrowPath',
        color: { type: 'property', property: 'color' },
        width: 10,
        widthScale: 1,
        widthMinPixels: 5,
        capRounded: true,
        jointRounded: true
    },

    transitPathWaypoints: {
        type: 'circle',
        fillColor: [0, 0, 0, 128],
        strokeColor: [255, 255, 255, 180],
        strokeWidth: 1,
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

    transitPathWaypointsErrors: {
        type: 'circle',
        fillColor: [0, 0, 0, 128],
        strokeColor: [255, 0, 0, 180],
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

    transitStations: {
        type: 'circle',
        minzoom: 11,
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 1],
                    [11, 2],
                    [15, 7],
                    [20, 12]
                ]
            },
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': {
                base: 1,
                stops: [
                    [5, 0.0],
                    [8, 0.2],
                    [12, 0.3],
                    [13, 0.4],
                    [14, 0.5],
                    [15, 0.7],
                    [16, 0.9]
                ]
            },
            'circle-stroke-width': {
                base: 1,
                stops: [
                    [5, 1],
                    [11, 1],
                    [12, 1],
                    [14, 1],
                    [15, 2]
                ]
            },
            'circle-stroke-opacity': {
                base: 1,
                stops: [
                    [5, 0.0],
                    [8, 0.2],
                    [12, 0.3],
                    [13, 0.4],
                    [14, 0.5],
                    [15, 0.7],
                    [16, 0.9]
                ]
            },
            'circle-stroke-color': {
                property: 'status',
                type: 'categorical',
                stops: [
                    ['default', 'rgba(255,255,255,1.0)'],
                    ['almost_hidden', 'rgba(255,255,255,0.3)']
                ]
            }
        }
    },

    transitStationsSelected: {
        type: 'circle',
        minzoom: 11,
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 1],
                    [11, 2],
                    [15, 7],
                    [20, 12]
                ]
            },
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': {
                base: 1,
                stops: [
                    [5, 0.0],
                    [8, 0.2],
                    [12, 0.3],
                    [13, 0.4],
                    [14, 0.5],
                    [15, 0.7],
                    [16, 0.9]
                ]
            },
            'circle-stroke-width': {
                base: 1,
                stops: [
                    [5, 1],
                    [11, 1],
                    [12, 1],
                    [14, 1],
                    [15, 2]
                ]
            },
            'circle-stroke-opacity': {
                base: 1,
                stops: [
                    [5, 0.0],
                    [8, 0.2],
                    [12, 0.3],
                    [13, 0.4],
                    [14, 0.5],
                    [15, 0.7],
                    [16, 0.9]
                ]
            },
            'circle-stroke-color': {
                property: 'status',
                type: 'categorical',
                stops: [
                    ['default', 'rgba(255,255,255,1.0)'],
                    ['almost_hidden', 'rgba(255,255,255,0.3)']
                ]
            }
        }
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
        strokeColor: [255, 255, 255],
        strokeWidth: 2,
        radius: 7,
        maxRadiusPixels: 15,
        minRadiusPixels: 5,
        radiusScale: 3,
        strokeWidthScale: 3,
        'custom-shader': 'circleSpinner',
        repaint: true,
        paint: {
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 2, 15, 12, 20, 23],
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': 1.0,
            'circle-stroke-width': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 0.5, 15, 5, 20, 8],
            'circle-stroke-opacity': 1.0,
            'circle-stroke-color': 'rgba(255,255,255,1.0)'
        }
    },

    transitNodesSelectedErrors: {
        type: 'circle',
        paint: {
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 4, 15, 15, 20, 30],
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': 0,
            'circle-stroke-width': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 1, 15, 8, 20, 12],
            'circle-stroke-opacity': 1.0,
            'circle-stroke-color': 'rgba(255,0,0,1.0)'
        }
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
    },

    transitNodesStationSelected: {
        type: 'circle',
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 2],
                    [10, 3],
                    [15, 15]
                ]
            },
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-stroke-width': {
                base: 1,
                stops: [
                    [5, 1],
                    [11, 1],
                    [12, 2],
                    [14, 3],
                    [15, 4]
                ]
            },
            'circle-stroke-color': {
                property: 'station_color',
                type: 'identity'
            }
        }
    }
};

export default layersConfig;
