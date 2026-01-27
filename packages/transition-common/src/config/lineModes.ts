/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// See https://developers.google.com/transit/gtfs/reference/extended-route-types

import type { TransitMode } from '../services/line/types';

export default [
    {
        value: 'bus' as TransitMode,
        extendedGtfsId: 700,
        gtfsId: 3,
        defaultValues: {
            data: {
                routingMode: 'bus_urban',
                routingEngine: 'engine',
                defaultRunningSpeedKmH: 40,
                defaultAcceleration: 1,
                defaultDeceleration: 1,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 120
            }
        },

        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['driving', 'driving_congestion', 'bus_suburb', 'bus_urban', 'bus_congestion']
    },
    {
        value: 'trolleybus' as TransitMode,
        extendedGtfsId: 800,
        gtfsId: 11,
        defaultValues: {
            data: {
                routingMode: 'bus_urban',
                routingEngine: 'engine',
                defaultRunningSpeedKmH: 40,
                defaultAcceleration: 1,
                defaultDeceleration: 1,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 120
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['driving', 'driving_congestion', 'bus_suburb', 'bus_urban', 'bus_congestion']
    },
    {
        value: 'rail' as TransitMode,
        extendedGtfsId: 100,
        gtfsId: 2,
        defaultValues: {
            data: {
                routingMode: 'rail',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 90,
                defaultAcceleration: 0.7,
                defaultDeceleration: 0.7,
                defaultDwellTimeSeconds: 30,
                maxRunningSpeedKmH: 250
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['rail']
    },
    {
        value: 'highSpeedRail' as TransitMode,
        extendedGtfsId: 101,
        gtfsId: 2,
        defaultValues: {
            data: {
                routingMode: 'high_speed_rail',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 250,
                defaultAcceleration: 0.7,
                defaultDeceleration: 0.7,
                defaultDwellTimeSeconds: 60,
                maxRunningSpeedKmH: 450
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['rail', 'high_speed_rail']
    },
    {
        value: 'metro' as TransitMode,
        extendedGtfsId: 400,
        gtfsId: 1,
        defaultValues: {
            data: {
                routingMode: 'rail',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 75,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 120
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['rail', 'metro']
    },
    {
        value: 'monorail' as TransitMode,
        extendedGtfsId: 405,
        gtfsId: 12,
        defaultValues: {
            data: {
                routingMode: 'monorail',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 75,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 120
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['monorail']
    },
    {
        value: 'tram' as TransitMode,
        extendedGtfsId: 900,
        gtfsId: 0,
        defaultValues: {
            data: {
                routingMode: 'tram',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 50,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 100
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['tram', 'tram_train', 'rail']
    },
    {
        value: 'tramTrain' as TransitMode,
        extendedGtfsId: 900,
        gtfsId: 0,
        defaultValues: {
            data: {
                routingMode: 'tram',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 60,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 130
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['tram', 'tram_train', 'rail']
    },
    {
        value: 'water' as TransitMode,
        extendedGtfsId: 1000,
        gtfsId: 4,
        defaultValues: {
            data: {
                routingMode: null,
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 30,
                defaultAcceleration: 0.5,
                defaultDeceleration: 0.5,
                defaultDwellTimeSeconds: 60,
                maxRunningSpeedKmH: 100
            }
        },
        compatibleRoutingEngines: ['manual'],
        compatibleRoutingModes: []
    },
    {
        value: 'gondola' as TransitMode,
        extendedGtfsId: 1300,
        gtfsId: 6,
        defaultValues: {
            data: {
                routingMode: null,
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 30,
                defaultAcceleration: 1,
                defaultDeceleration: 1,
                defaultDwellTimeSeconds: 10,
                customLayoverMinutes: 0,
                maxRunningSpeedKmH: 45
            }
        },
        compatibleRoutingEngines: ['manual'],
        compatibleRoutingModes: []
    },
    {
        value: 'funicular' as TransitMode,
        extendedGtfsId: 1400,
        gtfsId: 7,
        defaultValues: {
            data: {
                routingMode: null,
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 30,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                customLayoverMinutes: 0,
                maxRunningSpeedKmH: 50
            }
        },
        compatibleRoutingEngines: ['manual'],
        compatibleRoutingModes: []
    },
    {
        value: 'taxi' as TransitMode,
        extendedGtfsId: 1500,
        gtfsId: 3,
        defaultValues: {
            data: {
                routingMode: 'driving',
                routingEngine: 'engine',
                defaultRunningSpeedKmH: 50,
                defaultAcceleration: 1.2,
                defaultDeceleration: 1.2,
                defaultDwellTimeSeconds: 15,
                maxRunningSpeedKmH: 120
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['driving', 'driving_congestion']
    },
    {
        value: 'cableCar' as TransitMode,
        extendedGtfsId: 1701,
        gtfsId: 5,
        defaultValues: {
            data: {
                routingMode: 'cable_car',
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 50,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 70
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['cable_car']
    },
    {
        value: 'horse' as TransitMode,
        extendedGtfsId: 1702,
        gtfsId: 3,
        defaultValues: {
            data: {
                routingMode: null,
                routingEngine: 'engine',
                defaultRunningSpeedKmH: 6,
                defaultAcceleration: 1,
                defaultDeceleration: 1,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 10
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['horse', 'walking']
    },
    {
        value: 'other' as TransitMode,
        extendedGtfsId: 1700,
        gtfsId: 3,
        defaultValues: {
            data: {
                routingMode: null,
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 50,
                defaultAcceleration: 0.8,
                defaultDeceleration: 0.8,
                defaultDwellTimeSeconds: 20,
                maxRunningSpeedKmH: 450
            }
        },
        compatibleRoutingEngines: ['engine', 'engineCustom', 'manual'],
        compatibleRoutingModes: ['walking', 'cycling', 'driving', 'driving_congestion']
    },
    {
        value: 'transferable' as TransitMode,
        defaultValues: {
            data: {
                routingMode: null,
                routingEngine: 'manual',
                defaultRunningSpeedKmH: 5,
                defaultAcceleration: 1.5,
                defaultDeceleration: 1.5,
                defaultDwellTimeSeconds: 0,
                customLayoverMinutes: 0,
                maxRunningSpeedKmH: 5
            }
        },
        compatibleRoutingEngines: ['manual'],
        compatibleRoutingModes: [],
        showAccelerationAndDeceleration: false,
        extendedGtfsId: null,
        gtfsId: null
    }
];
