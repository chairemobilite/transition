/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import config from './shared/project.config';
import lineModesDefaultValues from './lineModesDefaultValues';
import constants from './constants';

// @deprecated This type has moved to chaire-lib's project configuration
interface SectionDescription {
    localizedTitle: string;
    icon: string;
    showMap?: boolean;
    showFullSizePanel?: boolean;
    enabled?: boolean;
}
export interface PreferencesModel {
    defaultSection: string;
    infoPanelPosition: string;
    dateTimeFormat: string;
    // @deprecated This type has moved to chaire-lib's project configuration.
    // Use the project configuration's `sections` instead, as it is not a
    // preference, but an instance specific configuration.
    sections?: {
        [key: string]: {
            [key: string]: SectionDescription;
        };
    };
    colorPicker: {
        /** Hexadecimal strings of the various colors that should be available */
        colors: string[];
    };
    [key: string]: any;
}

// TODO: Type more fields
const defaultPreferences: PreferencesModel = {
    defaultSection: 'agencies',
    infoPanelPosition: 'right',
    dateTimeFormat: 'YYYY-MM-DD HH:mm',
    map: {
        center: [config.mapDefaultCenter.lon, config.mapDefaultCenter.lat],
        zoom: 10,
        preferredBaseLayer: 'osm' as 'osm' | 'aerial' // User's preferred base map layer
    },
    showAggregatedOdTripsLayer: true,
    socketUploadChunkSize: 10240000,
    defaultWalkingSpeedMetersPerSeconds: 5 / 3.6,
    geoNames: {
        host: 'http://api.geonames.org/findNearestIntersectionOSMJSON'
    },
    valhallaRouting: {
        host: 'http://localhost',
        port: 8002,
        autoStart: false,
        modes: {
            walking: 'pedestrian',
            driving: 'auto',
            bus: 'bus',
            cycling: 'bicycle'
        }
    },
    btm: {
        host: 'https://taximtl.ville.montreal.qc.ca'
    },
    json2Capnp: {
        enabled: true, // if not enabled, will use javascript to read/write capnp cache files (slower)
        host: 'http://localhost',
        port: 2000
    },
    osrmRouting: {
        // directoryPrefix: used as a prefix, can be overridden in .env (OSRM_DIRECTORY_PREFIX).
        // Keep empty for none (will only use the mode name):
        // If empty, directories will be projects/{PROJECT_SHORTNAME}/osrm/{MODE}
        // If not empty, directories will be projects/{PROJECT_SHORTNAME}/osrm/directoryPrefix_{MODE}
        // TODO: Move these params to chaire-lib-backend with server.config. See issue #1140
        directoryPrefix: '',
        maxDistanceFromNearestNetworkNodeMeters: 300,
        useContinueStraightForMapMatching: false // use only if using the forked version of osrm-backend with support for continue-straight in match query
    },
    colorPicker: {
        colors: [
            // saturated
            '#0086FF',
            '#00ffdd',
            '#00ff55',
            '#aaff00',
            '#fff600',
            '#ff9400',
            '#ff3f00',
            '#ff0000',
            '#ff0061',
            '#ff00c3',
            '#d000ff',
            '#7b00ff',
            '#4800ff',
            '#1d00ff',

            // dark
            '#004787',
            '#008270',
            '#00842c',
            '#5a8700',
            '#878200',
            '#824b00',
            '#872100',
            '#840000',
            '#910037',
            '#870067',
            '#6e0087',
            '#410087',
            '#250084',
            '#0f0087',

            // light
            '#7cc2ff',
            '#99fff1',
            '#8effb4',
            '#d3ff7c',
            '#fffa7f',
            '#ffc677',
            '#ff9977',
            '#ff89b6',
            '#e98cff',
            '#aa89ff',

            // greys
            '#ffffff',
            '#c9c9c9',
            '#878787' // greys
        ]
    },
    simulations: {
        defaultColor: '#0086FF',
        classes: ['LineAndNumberOfVehiclesGASimulation'],
        geneticAlgorithms: {
            fitnessSorters: {
                maximize: function (fitnessA: number, fitnessB: number) {
                    return fitnessB - fitnessA; // descendant (more chance to select candidates with high fitness)
                },
                minimize: function (fitnessA: number, fitnessB: number) {
                    return fitnessA - fitnessB; // ascendent (more chance to select candidates with low fitness)
                }
            },
            odTripFitnessFunctions: {
                travelTimeCost: function (odTrip) {
                    return (10 * odTrip.travelTimeSeconds) / 3600 + odTrip.initialLostTimeAtDepartureSeconds / 3600;
                },
                travelTimeWithTransferPenalty: function (odTrip) {
                    return (
                        (10 * (odTrip.travelTimeSeconds + odTrip.numberOfTransfers * 300)) / 3600 +
                        odTrip.initialLostTimeAtDepartureSeconds / 3600
                    );
                }
            },
            nonRoutableOdTripFitnessFunctions: {
                taxi: function (odTrip) {
                    //return 10;
                    if (odTrip.onlyDrivingTravelTimeSeconds && odTrip.onlyDrivingTravelTimeSeconds > 0) {
                        return 3.5 + (87.5 * odTrip.onlyDrivingTravelTimeSeconds) / 3600; // taxi at 50km/h
                    } else if (odTrip.onlyWalkingTravelTimeSeconds && odTrip.onlyWalkingTravelTimeSeconds > 0) {
                        // divide walking time by 10 to get an approximation of 50 km/h
                        return 3.5 + (87.5 * odTrip.onlyWalkingTravelTimeSeconds) / (10 * 3600); // taxi at 50km/h
                    } else {
                        return 30;
                    }
                }
            },
            fitnessFunctions: {
                hourlyUserPlusOperatingCosts: function (stats) {
                    return stats.usersHourlyCost + stats.operatingHourlyCost;
                },
                hourlyUserCosts: function (stats) {
                    return stats.usersHourlyCost;
                },
                hourlyOperatingCosts: function (stats) {
                    return stats.operatingHourlyCost;
                }
            }
        }
    },
    transit: {
        definitionsAndSymbolsLatexUrl:
            'https://github.com/kaligrafy/CIV6708-Definitions-and-symbols/blob/master/main.tex',
        showEvolutionaryAlgorithmsFields: false,
        periods: {
            default: {
                name: {
                    fr: 'Par défaut',
                    en: 'Default'
                },
                periods: [
                    {
                        shortname: 'morning',
                        name: {
                            fr: 'Matinée (4h à 6h)',
                            en: 'Morning (4-6AM)'
                        },
                        startAtHour: 4,
                        endAtHour: 6
                    },
                    {
                        shortname: 'am_peak',
                        name: {
                            fr: 'Pointe du matin (6h à 9h)',
                            en: 'AM Peak (6-9AM)'
                        },
                        startAtHour: 6,
                        endAtHour: 9
                    },
                    {
                        shortname: 'midday',
                        name: {
                            fr: 'Journée (9h à 15h)',
                            en: 'Midday (9AM-15PM)'
                        },
                        startAtHour: 9,
                        endAtHour: 15
                    },
                    {
                        shortname: 'pm_peak',
                        name: {
                            fr: 'Pointe du soir (15h à 18h)',
                            en: 'PM Peak (3-6PM)'
                        },
                        startAtHour: 15,
                        endAtHour: 18
                    },
                    {
                        shortname: 'evening',
                        name: {
                            fr: 'Soirée (18h à 23h)',
                            en: 'Evening (6-11PM)'
                        },
                        startAtHour: 18,
                        endAtHour: 23
                    },
                    {
                        shortname: 'night',
                        name: {
                            fr: 'Nuit (23h à 4h)',
                            en: 'Night (11PM-4AM)'
                        },
                        startAtHour: 23,
                        endAtHour: 28
                    }
                ]
            },
            extended_morning_peak: {
                name: {
                    fr: 'Pointe du matin étendue',
                    en: 'Extended morning peak'
                },
                periods: [
                    {
                        shortname: 'extended_morning_peak',
                        name: {
                            fr: 'Pointe du matin étendue (5h à 11h)',
                            en: 'Extended morning peak (5-11AM)'
                        },
                        startAtHour: 5,
                        endAtHour: 11
                    }
                ]
            },
            complete_day: {
                name: {
                    fr: 'Journée complète',
                    en: 'Complete day'
                },
                periods: [
                    {
                        shortname: 'complete_day',
                        name: {
                            fr: 'Journée complète (4h à 24h)',
                            en: 'Complete day (4AM-midnight)'
                        },
                        startAtHour: 4,
                        endAtHour: 24
                    }
                ]
            }
        },
        stations: {
            defaultColor: '#0086FF'
        },
        networks: {
            defaultColor: '#0086FF'
        },
        nodes: {
            defaultStopAggregationWalkingRadiusSecondsWhenImportingFromGtfs: 60,
            defaultColor: '#0086FF',
            defaultDwellTimeSeconds: 20,
            useBirdDistanceForTransferableNodes: false,
            useBirdDistanceForODNodes: false,
            defaultRoutingRadiusMeters: 50,
            nameIsRequired: false,
            defaultWalkingSpeedMps: 5 / 3.6,
            maxTransferWalkingTravelTimeSeconds: 15 * 60, // more than that would be quite unrealistic
            maxAccessEgressWalkingTravelTimeSeconds: 20 * 60,
            weightCalculation: function (odTripExpansionFactor, walkingTravelTimeSeconds) {
                return odTripExpansionFactor / Math.exp(Math.pow(walkingTravelTimeSeconds / 60, 1.6) / 50);
            }
        },
        paths: {
            data: {
                defaultRoutingEngine: 'engine',
                defaultRoutingMode: 'bus_urban',
                defaultMinLayoverTimeSeconds: 180,
                defaultLayoverRatioOverTotalTravelTime: 0.1
            },
            generator: {
                defaultMinDistanceBetweenTerminalsKm: 3,
                defaultAvgInterNodesDistanceMeters: 400,
                defaultMedianInterNodesDistanceMeters: 400,
                defaultMaxTemporalTortuosity: 1.5
            }
        },
        lines: {
            defaultColor: '#0086FF',
            defaultLayoverRatioOverTotalTravelTime: 0.1,
            defaultIsAutonomous: false,
            defaultAllowSameLineTransfers: false,
            lineModesDefaultValues // TODO: Move these to transition default prefs
        },
        services: {
            defaultColor: '#0086FF'
        },
        scenarios: {
            defaultColor: '#0086FF'
        },
        agencies: {
            defaultColor: '#0086FF'
        },
        routing: {
            batch: {
                withGeometry: false,
                projection: String(constants.geographicCoordinateSystem.srid),
                allowSavingOdTripsToDb: false
            },
            transit: {
                routingModes: ['transit'],
                withAlternatives: false,
                departureTimeSecondsSinceMidnight: 28800,
                arrivalTimeSecondsSinceMidnight: null,
                minWaitingTimeSeconds: 180,
                maxTransferTravelTimeSeconds: 600,
                maxAccessEgressTravelTimeSeconds: 900,
                maxWalkingOnlyTravelTimeSeconds: 1800,
                maxTotalTravelTimeSeconds: 10800,
                walkingSpeedMps: 1.3888888888,
                walkingSpeedFactor: 1.0, // walking travel times are weighted using this factor: Example: > 1.0 means faster walking, < 1.0 means slower walking
                originLocationColor: 'rgba(140, 212, 0, 1.0)',
                destinationLocationColor: 'rgba(212, 35, 14, 1.0)',
                walkingSegmentsColor: 'rgba(160,160,160,1.0)',
                walking: {
                    color: 'rgba(255, 238, 0,1.0)'
                },
                cycling: {
                    color: 'rgba(0, 204, 51,1.0)'
                },
                driving: {
                    color: 'rgba(229, 45, 0,1.0)'
                },
                default: {
                    color: 'rgba(160,160,160,1.0)'
                }
            },
            transitAccessibilityMap: {
                departureTimeSecondsSinceMidnight: 28800,
                arrivalTimeSecondsSinceMidnight: null,
                deltaIntervalSeconds: 300,
                deltaSeconds: 900,
                numberOfPolygons: 3,
                direction: 'to', // to, from
                minWaitingTimeSeconds: 180,
                maxTransferTravelTimeSeconds: 600,
                maxAccessEgressTravelTimeSeconds: 900,
                maxWalkingOnlyTravelTimeSeconds: 1800,
                walkingSpeedMps: 1.3888888888,
                walkingSpeedFactor: 1.0, // walking travel times are weighted using this factor: Example: > 1.0 means faster walking, < 1.0 means slower walking
                maxTotalTravelTimeSeconds: 1800,
                locationColor: 'rgba(47, 138, 243, 1.0)',
                polygonColor: 'rgba(47, 138, 243, 0.4)',
                calculatePois: false
            },
            transitOdTrips: {
                minWaitingTimeSeconds: 180,
                maxTransferTravelTimeSeconds: 600,
                maxAccessEgressTravelTimeSeconds: 900,
                maxWalkingOnlyTravelTimeSeconds: 1800,
                maxTotalTravelTimeSeconds: 10800,
                walkingSpeedMps: 1.3888888888,
                odTripsSampleRatio: 1.0,
                walkingSpeedFactor: 1.0 // walking travel times are weighted using this factor: Example: > 1.0 means faster walking, < 1.0 means slower walking
            }
        }
    },
    // maxAccessibilityWeightsBirdDistancesMeters should be >= maxAccessibilityWeightsNetworkDistancesMeters
    // because it is used as a first step to filter out POIs that are too far away.
    maxAccessibilityWeightsBirdDistancesMeters: {
        walking: 2500 // ~30 minutes at 5 km/h
        // more modes could be added later on.
    },
    maxAccessibilityWeightsNetworkDistancesMeters: {
        walking: 2500 // Maximum network distance in meters for node weight calculations
        // more modes could be added later on.
    },
    maxAccessibilityWeightsTravelTimeSeconds: {
        walking: 1800 // ~30 minutes maximum travel time for node weight calculations
        // more modes could be added later on.
    },
    proj4Projections: {
        [String(constants.geographicCoordinateSystem.srid)]: constants.geographicCoordinateSystem,
        '2950': {
            srid: 2950,
            label: 'MTM Zone 8 NAD83 EPSG:2950',
            value: '+proj=tmerc +lat_0=0 +lon_0=-73.5 +k=0.9999 +x_0=304800 +y_0=0 +ellps=GRS80 +units=m +no_defs'
        }
    }
};

export default defaultPreferences;
