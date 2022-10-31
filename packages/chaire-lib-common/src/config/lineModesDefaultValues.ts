/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This is a copy of lineModes in transition-common.
// TODO: This needs to be moved to transition module own prefs

export const lineModesArray = [
    'bus',
    'trolleybus',
    'rail',
    'highSpeedRail',
    'metro',
    'monorail',
    'tram',
    'tramTrain',
    'water',
    'gondola',
    'funicular',
    'taxi',
    'cableCar',
    'horse',
    'other',
    'transferable'
] as const;

export default {
    bus: {
        routingMode: 'bus_urban',
        routingEngine: 'engine',
        defaultRunningSpeedKmH: 40,
        defaultAcceleration: 1,
        defaultDeceleration: 1,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 120
    },
    trolleybus: {
        routingMode: 'bus_urban',
        routingEngine: 'engine',
        defaultRunningSpeedKmH: 40,
        defaultAcceleration: 1,
        defaultDeceleration: 1,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 120
    },
    rail: {
        routingMode: 'rail',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 90,
        defaultAcceleration: 0.7,
        defaultDeceleration: 0.7,
        defaultDwellTimeSeconds: 30,
        maxRunningSpeedKmH: 250
    },
    highSpeedRail: {
        routingMode: 'high_speed_rail',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 250,
        defaultAcceleration: 0.7,
        defaultDeceleration: 0.7,
        defaultDwellTimeSeconds: 60,
        maxRunningSpeedKmH: 450
    },
    metro: {
        routingMode: 'rail',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 75,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 120
    },
    monorail: {
        routingMode: 'monorail',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 75,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 120
    },
    tram: {
        routingMode: 'tram',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 50,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 100
    },
    tramTrain: {
        routingMode: 'tram',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 60,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 130
    },
    water: {
        routingMode: null,
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 30,
        defaultAcceleration: 0.5,
        defaultDeceleration: 0.5,
        defaultDwellTimeSeconds: 60,
        maxRunningSpeedKmH: 100
    },
    gondola: {
        routingMode: null,
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 30,
        defaultAcceleration: 1,
        defaultDeceleration: 1,
        defaultDwellTimeSeconds: 10,
        customLayoverMinutes: 0,
        maxRunningSpeedKmH: 45
    },
    funicular: {
        routingMode: null,
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 30,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        customLayoverMinutes: 0,
        maxRunningSpeedKmH: 50
    },
    taxi: {
        routingMode: 'driving',
        routingEngine: 'engine',
        defaultRunningSpeedKmH: 50,
        defaultAcceleration: 1.2,
        defaultDeceleration: 1.2,
        defaultDwellTimeSeconds: 15,
        maxRunningSpeedKmH: 120
    },
    cableCar: {
        routingMode: 'cable_car',
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 50,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 70
    },
    horse: {
        routingMode: null,
        routingEngine: 'engine',
        defaultRunningSpeedKmH: 10,
        defaultAcceleration: 1,
        defaultDeceleration: 1,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 10
    },
    other: {
        routingMode: null,
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 50,
        defaultAcceleration: 0.8,
        defaultDeceleration: 0.8,
        defaultDwellTimeSeconds: 20,
        maxRunningSpeedKmH: 450
    },
    transferable: {
        routingMode: null,
        routingEngine: 'manual',
        defaultRunningSpeedKmH: 5,
        defaultAcceleration: 1.5,
        defaultDeceleration: 1.5,
        defaultDwellTimeSeconds: 0,
        customLayoverMinutes: 0,
        maxRunningSpeedKmH: 5
    }
};
