/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// Define which layers should be visible for each section
export const sectionLayers = {
    simulations: ['aggregatedOD', 'odTripsProfile', 'transitStations', 'transitNodes'],
    agencies: [
        'aggregatedOD',
        'transitNodesRoutingRadius',
        'transitStations',
        'transitStationsSelected',
        'transitPaths',
        'transitPathsSelected',
        'transitPathWaypoints',
        'transitPathWaypointsSelected',
        'transitNodes',
        'transitNodesSelected',
        'transitNodesSelectedErrors',
        'transitPathWaypointsErrors'
    ],
    nodes: [
        'aggregatedOD',
        'transitNodes250mRadius',
        'transitNodes500mRadius',
        'transitNodes750mRadius',
        'transitNodes1000mRadius',
        'isochronePolygons',
        'transitNodesRoutingRadius',
        'transitPaths',
        'transitStations',
        'transitStationsSelected',
        'transitNodes',
        'transitNodesSelected'
    ],
    scenarios: ['transitPathsForServices'],
    routing: [
        'aggregatedOD' /*'transitPaths', 'transitNodes', 'transitStations', */,
        'routingPathsStrokes',
        'routingPaths',
        'routingPoints'
    ],
    comparison: [
        'aggregatedOD' /*'transitPaths', 'transitNodes', 'transitStations', */,
        'routingPathsStrokes',
        'routingPaths',
        'routingPathsStrokesAlternate',
        'routingPathsAlternate',
        'routingPoints'
    ],
    accessibilityMap: [
        'aggregatedOD',
        'accessibilityMapPolygons',
        'accessibilityMapPolygonStrokes',
        'accessibilityMapPoints'
    ],
    accessibilityComparison: ['accessibilityMapPolygons', 'accessibilityMapPolygonStrokes', 'accessibilityMapPoints'],
    odRouting: ['aggregatedOD', 'odTripsProfile'],
    gtfsImport: [
        'aggregatedOD',
        'transitNodesRoutingRadius',
        'transitStations',
        'transitStationsSelected',
        'transitPaths',
        'transitPathsSelected',
        'transitPathWaypoints',
        'transitPathWaypointsSelected',
        'transitNodes',
        'transitNodesSelected'
    ],
    gtfsExport: [
        'aggregatedOD',
        'transitNodesRoutingRadius',
        'transitStations',
        'transitStationsSelected',
        'transitPaths',
        'transitPathsSelected',
        'transitPathWaypoints',
        'transitPathWaypointsSelected',
        'transitNodes',
        'transitNodesSelected'
    ]
};

// Layer style configuration
const layersConfig = {
    routingPoints: {
        // for routing origin, destination and waypoints
        type: 'circle',
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 2],
                    [15, 10]
                ]
            },
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': 1.0,
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
            'circle-stroke-opacity': 1.0,
            'circle-stroke-color': 'rgba(255,255,255,1.0)'
        }
    },

    accessibilityMapPoints: {
        type: 'circle',
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 2],
                    [15, 10]
                ]
            },
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': 1.0,
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
            'circle-stroke-opacity': 1.0,
            'circle-stroke-color': 'rgba(255,255,255,1.0)'
        }
    },

    accessibilityMapPolygons: {
        type: 'fill',
        paint: {
            'fill-color': {
                property: 'color',
                type: 'identity'
            },
            'fill-opacity': 0.2
        }
    },

    accessibilityMapPolygonStrokes: {
        type: 'line',
        paint: {
            'line-color': 'rgba(255,255,255,1.0)',
            'line-opacity': 0.2,
            'line-width': 1.5
        }
    },

    routingPathsStrokes: {
        type: 'line',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': 'rgba(255,255,255,1.0)',
            'line-opacity': 0.7,
            'line-width': {
                base: 6,
                stops: [
                    [6, 6],
                    [12, 10],
                    [13, 12]
                ]
            }
        }
    },

    routingPaths: {
        repaint: true,
        type: 'line',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'custom-shader': 'lineArrow',
        paint: {
            'line-color': {
                property: 'color',
                type: 'identity'
            },
            'line-opacity': 1.0,
            'line-width': {
                base: 3,
                stops: [
                    [6, 3],
                    [12, 5],
                    [13, 7]
                ]
            }
        }
    },

    // Identical to the routingPathsStrokes layers, but with purple instead of white path outlines
    // Used to display 2 paths at once on the map
    routingPathsStrokesAlternate: {
        type: 'line',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': 'rgba(255,0,255,1.0)',
            'line-opacity': 0.7,
            'line-width': {
                base: 6,
                stops: [
                    [6, 6],
                    [12, 10],
                    [13, 12]
                ]
            }
        }
    },

    // Identical to the routingPaths layers
    // Used to display 2 paths at once on the map
    routingPathsAlternate: {
        repaint: true,
        type: 'line',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'custom-shader': 'lineArrow',
        paint: {
            'line-color': {
                property: 'color',
                type: 'identity'
            },
            'line-opacity': 1.0,
            'line-width': {
                base: 3,
                stops: [
                    [6, 3],
                    [12, 5],
                    [13, 7]
                ]
            }
        }
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
        minzoom: 5,
        defaultFilter: [
            'any',
            ['all', ['==', ['string', ['get', 'mode']], 'bus'], ['>=', ['zoom'], 11]],
            ['all', ['==', ['string', ['get', 'mode']], 'rail'], ['>=', ['zoom'], 5]],
            ['all', ['==', ['string', ['get', 'mode']], 'highSpeedRail'], ['>=', ['zoom'], 5]],
            ['all', ['==', ['string', ['get', 'mode']], 'metro'], ['>=', ['zoom'], 9]],
            ['all', ['==', ['string', ['get', 'mode']], 'monorail'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'tram'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'tramTrain'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'water'], ['>=', ['zoom'], 9]],
            ['all', ['==', ['string', ['get', 'mode']], 'gondola'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'funicular'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'taxi'], ['>=', ['zoom'], 11]],
            ['all', ['==', ['string', ['get', 'mode']], 'cableCar'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'horse'], ['>=', ['zoom'], 11]],
            ['all', ['==', ['string', ['get', 'mode']], 'other'], ['>=', ['zoom'], 11]]
        ],
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
            'line-color': {
                property: 'color',
                type: 'identity'
            },
            'line-opacity': 0.8 /*{ // not working???
        'base': 0,
        'stops': [
          [0, 0.0],
          [7, 0.05],
          [10, 0.2],
          [15, 0.5],
          [20, 0.8]
        ]
      }*/,
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 6, 2]
        }
    },

    transitPathsStroke: {
        type: 'line',
        minzoom: 15,
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
        type: 'line',
        repaint: true,
        //"shaders": [transitPathsSelectedFragmentShader, transitPathsSelectedVertexShader],
        layout: {
            'line-join': 'miter',
            'line-cap': 'butt',
            visibility: 'none' // Hidden by default - deck.gl renders selected paths with animations
        },
        'custom-shader': 'lineArrow',
        paint: {
            //"line-arrow": true,
            'line-offset': {
                base: 1,
                stops: [
                    [13, 0],
                    [16, 4],
                    [20, 20]
                ]
            },
            //"line-color": "rgba(0,0,255,1.0)",
            'line-color': {
                property: 'color',
                type: 'identity'
            },
            'line-opacity': 1.0,
            'line-width': {
                base: 1,
                stops: [
                    [6, 5],
                    [12, 7],
                    [13, 9]
                ]
            } //,
            //'line-gradient': [
            //  'interpolate',
            //  ['linear'],
            //  ['line-progress'],
            //  0, "blue",
            //  1.0, "red"
            //]
        }
    },

    transitPathWaypoints: {
        type: 'circle',
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 2],
                    [15, 5]
                ]
            },
            'circle-color': 'rgba(0,0,0,1.0)',
            'circle-opacity': 0.5,
            'circle-stroke-width': {
                base: 1,
                stops: [
                    [5, 1],
                    [11, 1],
                    [12, 2],
                    [14, 2],
                    [15, 3]
                ]
            },
            'circle-stroke-opacity': 0.7,
            'circle-stroke-color': 'rgba(255,255,255,1.0)'
        }
    },

    transitPathWaypointsSelected: {
        type: 'circle',
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 3],
                    [15, 6]
                ]
            },
            'circle-color': 'rgba(0,0,0,1.0)',
            'circle-opacity': 0.5,
            'circle-stroke-width': {
                base: 1,
                stops: [
                    [5, 1],
                    [11, 1],
                    [12, 2],
                    [14, 2],
                    [15, 3]
                ]
            },
            'circle-stroke-opacity': 0.85,
            'circle-stroke-color': 'rgba(255,255,255,1.0)'
        }
    },

    transitPathWaypointsErrors: {
        type: 'circle',
        paint: {
            'circle-radius': {
                base: 1,
                stops: [
                    [5, 1],
                    [10, 2],
                    [15, 5]
                ]
            },
            'circle-opacity': 0,
            'circle-stroke-width': {
                base: 1,
                stops: [
                    [5, 2],
                    [11, 2],
                    [12, 4],
                    [14, 4],
                    [15, 6]
                ]
            },
            'circle-stroke-opacity': 0.7,
            'circle-stroke-color': 'rgba(255,0,0,1.0)'
        }
    },

    transitPathsForServices: {
        type: 'line',
        minzoom: 5,
        defaultFilter: [
            'any',
            ['all', ['==', ['string', ['get', 'mode']], 'bus'], ['>=', ['zoom'], 11]],
            ['all', ['==', ['string', ['get', 'mode']], 'rail'], ['>=', ['zoom'], 5]],
            ['all', ['==', ['string', ['get', 'mode']], 'highSpeedRail'], ['>=', ['zoom'], 5]],
            ['all', ['==', ['string', ['get', 'mode']], 'metro'], ['>=', ['zoom'], 9]],
            ['all', ['==', ['string', ['get', 'mode']], 'monorail'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'tram'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'tramTrain'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'water'], ['>=', ['zoom'], 9]],
            ['all', ['==', ['string', ['get', 'mode']], 'gondola'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'funicular'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'taxi'], ['>=', ['zoom'], 11]],
            ['all', ['==', ['string', ['get', 'mode']], 'cableCar'], ['>=', ['zoom'], 10]],
            ['all', ['==', ['string', ['get', 'mode']], 'horse'], ['>=', ['zoom'], 11]],
            ['all', ['==', ['string', ['get', 'mode']], 'other'], ['>=', ['zoom'], 11]]
        ],
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
            'line-color': {
                property: 'color',
                type: 'identity'
            },
            'line-opacity': 0.8 /*{ // not working???
        'base': 0,
        'stops': [
          [0, 0.0],
          [7, 0.05],
          [10, 0.2],
          [15, 0.5],
          [20, 0.8]
        ]
      }*/,
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 6, 2]
        }
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
        minzoom: 11,
        paint: {
            'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                ['*', ['number', ['feature-state', 'size'], 1], 0],
                10,
                ['*', ['number', ['feature-state', 'size'], 1], 1.5],
                15,
                ['*', ['number', ['feature-state', 'size'], 1], 8],
                20,
                ['*', ['number', ['feature-state', 'size'], 1], 15]
            ],
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.1],
                15,
                ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.8],
                20,
                ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.9]
            ],
            'circle-stroke-width': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                ['*', ['number', ['feature-state', 'size'], 1], 0],
                10,
                ['*', ['number', ['feature-state', 'size'], 1], 0.2],
                15,
                ['*', ['number', ['feature-state', 'size'], 1], 3],
                20,
                ['*', ['number', ['feature-state', 'size'], 1], 5]
            ],
            'circle-stroke-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.1],
                15,
                ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.8],
                20,
                ['case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.9]
            ],
            'circle-stroke-color': 'rgba(255,255,255,1.0)'
        }
    },

    transitNodes250mRadius: {
        type: 'circle',
        paint: {
            'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                0,
                20,
                ['get', '_250mRadiusPixelsAtMaxZoom']
            ],
            'circle-color': 'hsla(93, 100%, 63%, 0.08)',
            'circle-stroke-width': 3,
            'circle-stroke-color': 'hsla(93, 100%, 63%, 0.10)'
        }
    },

    transitNodes500mRadius: {
        type: 'circle',
        paint: {
            'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                0,
                20,
                ['get', '_500mRadiusPixelsAtMaxZoom']
            ],
            'circle-color': 'hsla(74, 100%, 63%, 0.06)',
            'circle-stroke-width': 2,
            'circle-stroke-color': 'hsla(74, 100%, 63%, 0.075)'
        }
    },

    transitNodes750mRadius: {
        type: 'circle',
        paint: {
            'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                0,
                20,
                ['get', '_750mRadiusPixelsAtMaxZoom']
            ],
            'circle-color': 'hsla(49, 100%, 63%, 0.025)',
            'circle-stroke-width': 1,
            'circle-stroke-color': 'hsla(49, 100%, 63%, 0.075)'
        }
    },

    transitNodes1000mRadius: {
        type: 'circle',
        paint: {
            'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                0,
                20,
                ['get', '_1000mRadiusPixelsAtMaxZoom']
            ],
            'circle-color': 'hsla(6, 100%, 63%, 0.02)',
            'circle-stroke-width': 1,
            'circle-stroke-color': 'hsla(6, 100%, 63%, 0.075)'
        }
    },

    transitNodesSelected: {
        type: 'circle',
        'custom-shader': 'circleSpinner',
        repaint: true,
        paint: {
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 1.5, 15, 6, 20, 12],
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': 1.0,
            'circle-stroke-width': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 10, 0.5, 15, 2, 20, 3],
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
        paint: {
            'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                0,
                0,
                20,
                ['get', '_routingRadiusPixelsAtMaxZoom']
            ],
            'circle-color': {
                property: 'color',
                type: 'identity'
            },
            'circle-opacity': 0.2,
            //"circle-color"       : {
            //  property: 'color',
            //  type: 'identity'
            //},
            'circle-stroke-width': 1,
            'circle-stroke-opacity': 0.3,
            'circle-stroke-color': {
                property: 'color',
                type: 'identity'
            }
        }
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
