/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { GeneralizedCostFunction } from '../GeneralizedCostFunction';
import { GeneralizedCostFunctionValues, GeneralizedCostFunctionWeights } from '../types';
import type { RightOfWayCategory } from 'transition-common/lib/services/line/types';
import type { WeatherProtection } from 'transition-common/lib/services/nodes/types';

// Helper function to create default weights for testing
const createDefaultWeights = (): GeneralizedCostFunctionWeights => ({
    accessTravelTimeWeightByMode: {
        walking: 2.0,
        cycling: 1.5,
        driving: 1.0
    },
    egressTravelTimeWeightByMode: {
        walking: 2.0,
        cycling: 1.5,
        driving: 1.0
    },
    transferTravelTimeWeightByMode: {
        walking: 2.5,
        cycling: 2.0,
        driving: 1.5
    },
    inVehicleTravelTimeWeightByROW: {
        A: 0.8,
        B: 0.9,
        'B-': 1.0,
        'C+': 1.1,
        C: 1.2,
        unknown: 1.0
    },
    inVehicleTravelTimeWeightBySupport: {
        rail: 0.85,
        tires: 1.0,
        water: 1.1,
        suspended: 0.9,
        magnetic: 0.85,
        air: 0.7,
        hover: 0.95,
        hydrostatic: 1.0,
        unknown: 1.0
    },
    inVehicleTravelTimeWeightByVerticalAlignment: {
        surface: 1.0,
        aerial: 0.95,
        underground: 1.05,
        unknown: 1.0
    },
    firstWaitingTimeWeightByWeatherProtection: {
        none: 2.5,
        covered: 2.0,
        indoor: 1.5,
        unknown: 2.0
    },
    waitingTimeWeightByWeatherProtection: {
        none: 3.0,
        covered: 2.5,
        indoor: 2.0,
        unknown: 2.5
    },
    transferPenaltyByIndex: [300, 400, 500],
    transferPenaltyMax: 600,
    boardingPenaltyByHeadwayThreshold: {
        high: 180,
        low: 300
    },
    headwayWeightByROW: {
        A: 0.08,
        B: 0.09,
        'B-': 0.1,
        'C+': 0.11,
        C: 0.12,
        unknown: 0.1
    }
});

// Helper function to create default values for testing
const createDefaultValues = (): GeneralizedCostFunctionValues => ({
    accessMode: 'walking',
    egressMode: 'walking',
    accessTravelTimeSeconds: 300,
    egressTravelTimeSeconds: 240,
    byLeg: [
        {
            weatherProtectionAtBoardingStop: 'covered',
            inVehicleTravelTimeSeconds: 900,
            transferTravelTimeSeconds: 0,
            waitingTimeSeconds: 300,
            headwaySeconds: 480,
            rightOfWayCategory: 'B',
            verticalAlignment: 'surface',
            support: 'tires'
        },
        {
            weatherProtectionAtBoardingStop: 'indoor',
            inVehicleTravelTimeSeconds: 900,
            transferTravelTimeSeconds: 180,
            waitingTimeSeconds: 240,
            headwaySeconds: 600,
            rightOfWayCategory: 'C',
            verticalAlignment: 'underground',
            support: 'rail'
        }
    ]
});

describe('GeneralizedCostFunction', () => {
    describe('constructor', () => {
        test('should create instance with urban context', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            expect(gcf).toBeDefined();
            expect(gcf.getHeadwayThresholdSeconds()).toBe(10 * 60);
        });

        test('should create instance with regional context', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'regional');
            expect(gcf.getHeadwayThresholdSeconds()).toBe(15 * 60);
        });

        test('should create instance with intercity context', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'intercity');
            expect(gcf.getHeadwayThresholdSeconds()).toBe(30 * 60);
        });
    });

    describe('getHeadwayThresholdSeconds', () => {
        const contexts: Array<{ context: 'urban' | 'regional' | 'intercity'; expected: number }> = [
            { context: 'urban', expected: 600 },
            { context: 'regional', expected: 900 },
            { context: 'intercity', expected: 1800 }
        ];

        test.each(contexts)('should return $expected seconds for $context context', ({ context, expected }) => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), context);
            expect(gcf.getHeadwayThresholdSeconds()).toBe(expected);
        });

        test('should return default 600 seconds for invalid context (defensive code)', () => {
            // This tests the defensive default return that should never be reached in normal usage
            // We need to bypass TypeScript's type checking to test this edge case
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'invalid' as any);
            expect(gcf.getHeadwayThresholdSeconds()).toBe(600);
        });
    });


    describe('getHeadways', () => {
        test('should return headway values for all legs when all legs have headway', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();

            const headways = gcf.getHeadways(values);

            expect(headways).toEqual([480, 600]);
        });

        test('should return undefined when any leg is missing headway', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();
            delete values.byLeg[1].headwaySeconds;

            const headways = gcf.getHeadways(values);

            expect(headways).toBeUndefined();
        });

        test('should return undefined when byLeg is empty', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();
            values.byLeg = [];

            const headways = gcf.getHeadways(values);

            expect(headways).toBeUndefined();
        });
    });

    describe('calculateWeightedTravelTimeSeconds', () => {
        test('should throw error when byLeg is empty', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();
            values.byLeg = [];

            expect(() => gcf.calculateWeightedTravelTimeSeconds(values)).toThrow('At least one leg is required');
        });

        test('should calculate weighted travel time with two legs and headway', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (leg 0, covered weather protection): 2.0 * 300 = 600
            // Leg 0:
            //   In-vehicle: 900 * (0.9 + 1.0 + 1.0) = 900 * 2.9 = 2610
            //   No transfer penalties (first leg)
            //   Headway: 480 * 0.09 = 43.2
            //   Boarding penalty (480 <= 600): high = 180
            // Leg 1:
            //   In-vehicle: 900 * (1.2 + 0.85 + 1.05) = 900 * 3.1 = 2790
            //   Transfer waiting (indoor weather protection): 240 * 2.0 = 480
            //   Transfer travel (walking): 180 * 2.5 = 450
            //   Transfer penalty by index (transfer 0): 300
            //   Headway: 600 * 0.12 = 72
            //   Boarding penalty (600 <= 600): high = 180
            // Total: 600 + 480 + 600 + 2610 + 43.2 + 180 + 2790 + 480 + 450 + 300 + 72 + 180 = 8785.2

            expect(result).toBeCloseTo(8785.2, 1);
        });

        test('should calculate weighted travel time without headway', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation (same as above but without headway parts):
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            //   No transfer penalties
            // Leg 1:
            //   In-vehicle: 2790
            //   Transfer waiting: 480
            //   Transfer travel: 450
            //   Transfer penalty by index: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(result).toBe(8310);
        });

        test('should handle single leg trip (no transfers)', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values: GeneralizedCostFunctionValues = {
                accessMode: 'walking',
                egressMode: 'walking',
                accessTravelTimeSeconds: 300,
                egressTravelTimeSeconds: 240,
                byLeg: [
                    {
                        weatherProtectionAtBoardingStop: 'none',
                        inVehicleTravelTimeSeconds: 900,
                        transferTravelTimeSeconds: 0,
                        waitingTimeSeconds: 300,
                        headwaySeconds: 480,
                        rightOfWayCategory: 'A',
                        verticalAlignment: 'surface',
                        support: 'rail'
                    }
                ]
            };

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (none weather protection): 2.5 * 300 = 750
            // Leg 0:
            //   In-vehicle: 900 * (0.8 + 0.85 + 1.0) = 900 * 2.65 = 2385
            //   No transfer penalties (single leg, no transfers)
            //   Headway: 480 * 0.08 = 38.4
            //   Boarding penalty (480 <= 600): high = 180
            // Total: 600 + 480 + 750 + 2385 + 38.4 + 180 = 4433.4

            expect(result).toBeCloseTo(4433.4, 1);
        });

        test('should use transferPenaltyMax when transfer index exceeds provided penalties', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();

            // Add more legs to exceed transferPenaltyByIndex length
            values.byLeg.push(
                {
                    weatherProtectionAtBoardingStop: 'covered',
                    inVehicleTravelTimeSeconds: 600,
                    transferTravelTimeSeconds: 120,
                    waitingTimeSeconds: 180,
                    headwaySeconds: 720,
                    rightOfWayCategory: 'B-',
                    verticalAlignment: 'aerial',
                    support: 'tires'
                },
                {
                    weatherProtectionAtBoardingStop: 'indoor',
                    inVehicleTravelTimeSeconds: 500,
                    transferTravelTimeSeconds: 100,
                    waitingTimeSeconds: 150,
                    headwaySeconds: 800,
                    rightOfWayCategory: 'C+',
                    verticalAlignment: 'surface',
                    support: 'rail'
                }
            );

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for 4 legs with 3 transfers:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (leg 0, covered): 2.0 * 300 = 600
            //
            // Leg 0 (i=0, no transfer):
            //   In-vehicle: 900 * (0.9 + 1.0 + 1.0) = 2610
            //   Headway: 480 * 0.09 = 43.2
            //   Boarding penalty (480 <= 600): high = 180
            //
            // Leg 1 (i=1, transfer index 0):
            //   In-vehicle: 900 * (1.2 + 0.85 + 1.05) = 2790
            //   Transfer waiting (indoor): 240 * 2.0 = 480
            //   Transfer travel: 180 * 2.5 = 450
            //   Transfer penalty[0]: 300
            //   Headway: 600 * 0.12 = 72
            //   Boarding penalty (600 <= 600): high = 180
            //
            // Leg 2 (i=2, transfer index 1):
            //   In-vehicle: 600 * (1.0 + 1.0 + 0.95) = 1770
            //   Transfer waiting (covered): 180 * 2.5 = 450
            //   Transfer travel: 120 * 2.5 = 300
            //   Transfer penalty[1]: 400
            //   Headway: 720 * 0.1 = 72
            //   Boarding penalty (720 > 600): low = 300
            //
            // Leg 3 (i=3, transfer index 2):
            //   In-vehicle: 500 * (1.1 + 0.85 + 1.0) = 1475
            //   Transfer waiting (indoor): 150 * 2.0 = 300
            //   Transfer travel: 100 * 2.5 = 250
            //   Transfer penalty[2]: 500
            //   Headway: 800 * 0.11 = 88
            //   Boarding penalty (800 > 600): low = 300
            //
            // Total: 600 + 480 + 600 + 2610 + 43.2 + 180 + 2790 + 480 + 450 + 300 + 72 + 180 + 1770 + 450 + 300 + 400 + 72 + 300 + 1475 + 300 + 250 + 500 + 88 + 300
            //      = 14990.2

            expect(result).toBeCloseTo(14990.2, 1);
        });

        test('should apply different transfer penalties based on frequency', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();

            // Test high frequency (headway <= 600 sec for urban)
            values.byLeg[0].headwaySeconds = 300;
            values.byLeg[1].headwaySeconds = 450;

            const resultHighFreq = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for high frequency:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (covered): 2.0 * 300 = 600
            // Leg 0:
            //   In-vehicle: 900 * (0.9 + 1.0 + 1.0) = 2610
            //   Headway: 300 * 0.09 = 27
            //   Boarding penalty (300 <= 600): high = 180
            // Leg 1:
            //   In-vehicle: 900 * (1.2 + 0.85 + 1.05) = 2790
            //   Transfer waiting (indoor): 240 * 2.0 = 480
            //   Transfer travel: 180 * 2.5 = 450
            //   Transfer penalty[0]: 300
            //   Headway: 450 * 0.12 = 54
            //   Boarding penalty (450 <= 600): high = 180
            // Total: 600 + 480 + 600 + 2610 + 27 + 180 + 2790 + 480 + 450 + 300 + 54 + 180 = 8751

            expect(resultHighFreq).toBe(8751);

            // Test low frequency (headway > 600 sec)
            values.byLeg[0].headwaySeconds = 900;
            values.byLeg[1].headwaySeconds = 1200;

            const resultLowFreq = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for low frequency:
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            //   Headway: 900 * 0.09 = 81
            //   Boarding penalty (900 > 600): low = 300
            // Leg 1:
            //   In-vehicle: 2790
            //   Transfer waiting: 480
            //   Transfer travel: 450
            //   Transfer penalty[0]: 300
            //   Headway: 1200 * 0.12 = 144
            //   Boarding penalty (1200 > 600): low = 300
            // Total: 600 + 480 + 600 + 2610 + 81 + 300 + 2790 + 480 + 450 + 300 + 144 + 300 = 9135

            expect(resultLowFreq).toBe(9135);

            // Test mixed frequency (high then low)
            values.byLeg[0].headwaySeconds = 300;
            values.byLeg[1].headwaySeconds = 900;

            const resultMixedFreq = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for mixed frequency:
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            //   Headway: 300 * 0.09 = 27
            //   Boarding penalty (300 <= 600): high = 180
            // Leg 1:
            //   In-vehicle: 2790
            //   Transfer waiting: 480
            //   Transfer travel: 450
            //   Transfer penalty[0]: 300
            //   Headway: 900 * 0.12 = 108
            //   Boarding penalty (900 > 600): low = 300
            // Total: 600 + 480 + 600 + 2610 + 27 + 180 + 2790 + 480 + 450 + 300 + 108 + 300 = 8925

            expect(resultMixedFreq).toBe(8925);

        });

        test('should use transferPenaltyMax when no penalty is defined for transfer index', () => {
            // Use custom weights with only 1 penalty to force transferPenaltyMax usage
            const customWeights = createDefaultWeights();
            customWeights.transferPenaltyByIndex = [300]; // Only 1 penalty defined
            customWeights.transferPenaltyMax = 999;

            const gcf = new GeneralizedCostFunction(customWeights, 'urban');
            const values = createDefaultValues();

            // Remove headway to simplify calculation
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for 2 legs:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (covered): 2.0 * 300 = 600
            // Leg 0:
            //   In-vehicle: 900 * (0.9 + 1.0 + 1.0) = 2610
            // Leg 1:
            //   In-vehicle: 900 * (1.2 + 0.85 + 1.05) = 2790
            //   Transfer waiting (indoor): 240 * 2.0 = 480
            //   Transfer travel: 180 * 2.5 = 450
            //   Transfer penalty[0]: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(result).toBe(8310);

            // Add another leg to test transferPenaltyMax
            values.byLeg.push({
                weatherProtectionAtBoardingStop: 'covered' as WeatherProtection,
                inVehicleTravelTimeSeconds: 800,
                transferTravelTimeSeconds: 150,
                waitingTimeSeconds: 200,
                rightOfWayCategory: 'B' as RightOfWayCategory,
                verticalAlignment: 'surface',
                support: 'tires'
            });

            const resultWith3Legs = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for 3 legs:
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            // Leg 1:
            //   In-vehicle: 2790
            //   Transfer waiting: 480
            //   Transfer travel: 450
            //   Transfer penalty[0]: 300
            // Leg 2:
            //   In-vehicle: 800 * (0.9 + 1.0 + 1.0) = 2320
            //   Transfer waiting (covered): 200 * 2.5 = 500
            //   Transfer travel: 150 * 2.5 = 375
            //   Transfer penalty (transferPenaltyMax): 999
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 + 2320 + 500 + 375 + 999 = 12504

            expect(resultWith3Legs).toBe(12504);
        });

        test('should apply correct access mode weights', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');

            const walkingValues = createDefaultValues();
            walkingValues.accessMode = 'walking';
            delete walkingValues.byLeg[0].headwaySeconds;
            delete walkingValues.byLeg[1].headwaySeconds;
            const walkingResult = gcf.calculateWeightedTravelTimeSeconds(walkingValues);

            // Manual calculation for walking access:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting: 2.0 * 300 = 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 180 * 2.5 = 450, Transfer penalty: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(walkingResult).toBe(8310);

            const cyclingValues = createDefaultValues();
            cyclingValues.accessMode = 'cycling';
            delete cyclingValues.byLeg[0].headwaySeconds;
            delete cyclingValues.byLeg[1].headwaySeconds;
            const cyclingResult = gcf.calculateWeightedTravelTimeSeconds(cyclingValues);

            // Manual calculation for cycling access:
            // Access: 1.5 * 300 = 450
            // Egress: 2.0 * 240 = 480
            // First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 180 * 2.0 = 360, Transfer penalty: 300
            // Total: 450 + 480 + 600 + 2610 + 2790 + 480 + 360 + 300 = 8070

            expect(cyclingResult).toBe(8070);

            const drivingValues = createDefaultValues();
            drivingValues.accessMode = 'driving';
            delete drivingValues.byLeg[0].headwaySeconds;
            delete drivingValues.byLeg[1].headwaySeconds;
            const drivingResult = gcf.calculateWeightedTravelTimeSeconds(drivingValues);

            // Manual calculation for driving access:
            // Access: 1.0 * 300 = 300
            // Egress: 2.0 * 240 = 480
            // First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 180 * 1.5 = 270, Transfer penalty: 300
            // Total: 300 + 480 + 600 + 2610 + 2790 + 480 + 270 + 300 = 7830

            expect(drivingResult).toBe(7830);
        });

        test('should apply correct egress mode weights', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');

            const walkingValues = createDefaultValues();
            walkingValues.egressMode = 'walking';
            delete walkingValues.byLeg[0].headwaySeconds;
            delete walkingValues.byLeg[1].headwaySeconds;
            const walkingResult = gcf.calculateWeightedTravelTimeSeconds(walkingValues);

            // Manual calculation for walking egress:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(walkingResult).toBe(8310);

            const cyclingValues = createDefaultValues();
            cyclingValues.egressMode = 'cycling';
            delete cyclingValues.byLeg[0].headwaySeconds;
            delete cyclingValues.byLeg[1].headwaySeconds;
            const cyclingResult = gcf.calculateWeightedTravelTimeSeconds(cyclingValues);

            // Manual calculation for cycling egress:
            // Access: 2.0 * 300 = 600
            // Egress: 1.5 * 240 = 360
            // First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 360 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8190

            expect(cyclingResult).toBe(8190);

            const drivingValues = createDefaultValues();
            drivingValues.egressMode = 'driving';
            delete drivingValues.byLeg[0].headwaySeconds;
            delete drivingValues.byLeg[1].headwaySeconds;
            const drivingResult = gcf.calculateWeightedTravelTimeSeconds(drivingValues);

            // Manual calculation for driving egress:
            // Access: 2.0 * 300 = 600
            // Egress: 1.0 * 240 = 240
            // First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 240 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8070

            expect(drivingResult).toBe(8070);
        });

        test('should apply weather protection weights correctly', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');

            const noneValues = createDefaultValues();
            noneValues.byLeg[0].weatherProtectionAtBoardingStop = 'none';
            delete noneValues.byLeg[0].headwaySeconds;
            delete noneValues.byLeg[1].headwaySeconds;
            const noneResult = gcf.calculateWeightedTravelTimeSeconds(noneValues);

            // Manual calculation with 'none' weather protection:
            // Access: 600
            // Egress: 480
            // First waiting (none): 2.5 * 300 = 750
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 480 + 750 + 2610 + 2790 + 480 + 450 + 300 = 8460

            expect(noneResult).toBe(8460);

            const coveredValues = createDefaultValues();
            coveredValues.byLeg[0].weatherProtectionAtBoardingStop = 'covered';
            delete coveredValues.byLeg[0].headwaySeconds;
            delete coveredValues.byLeg[1].headwaySeconds;
            const coveredResult = gcf.calculateWeightedTravelTimeSeconds(coveredValues);

            // Manual calculation with 'covered' weather protection:
            // Access: 600
            // Egress: 480
            // First waiting (covered): 2.0 * 300 = 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(coveredResult).toBe(8310);

            const indoorValues = createDefaultValues();
            indoorValues.byLeg[0].weatherProtectionAtBoardingStop = 'indoor';
            delete indoorValues.byLeg[0].headwaySeconds;
            delete indoorValues.byLeg[1].headwaySeconds;
            const indoorResult = gcf.calculateWeightedTravelTimeSeconds(indoorValues);

            // Manual calculation with 'indoor' weather protection:
            // Access: 600
            // Egress: 480
            // First waiting (indoor): 1.5 * 300 = 450
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 480 + 450 + 2610 + 2790 + 480 + 450 + 300 = 8160

            expect(indoorResult).toBe(8160);
        });

        test('should combine ROW, support, and vertical alignment weights for in-vehicle time', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const values = createDefaultValues();
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation:
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0: In-vehicle: 900 * (ROW B: 0.9 + support tires: 1.0 + vertical surface: 1.0) = 900 * 2.9 = 2610
            // Leg 1: In-vehicle: 900 * (ROW C: 1.2 + support rail: 0.85 + vertical underground: 1.05) = 900 * 3.1 = 2790
            //        Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(result).toBe(8310);
        });

        test('should apply transfer travel time weight based on access mode', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');

            const walkingValues = createDefaultValues();
            walkingValues.accessMode = 'walking'; // weight = 2.5 for transfer
            delete walkingValues.byLeg[0].headwaySeconds;
            delete walkingValues.byLeg[1].headwaySeconds;
            const walkingResult = gcf.calculateWeightedTravelTimeSeconds(walkingValues);

            // Manual calculation for walking:
            // Access: 600, Egress: 480, First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 180 * 2.5 = 450, Transfer penalty: 300
            // Total: 600 + 480 + 600 + 2610 + 2790 + 480 + 450 + 300 = 8310

            expect(walkingResult).toBe(8310);

            const cyclingValues = createDefaultValues();
            cyclingValues.accessMode = 'cycling'; // weight = 2.0 for transfer
            delete cyclingValues.byLeg[0].headwaySeconds;
            delete cyclingValues.byLeg[1].headwaySeconds;
            const cyclingResult = gcf.calculateWeightedTravelTimeSeconds(cyclingValues);

            // Manual calculation for cycling:
            // Access: 450, Egress: 480, First waiting: 600
            // Leg 0: In-vehicle: 2610
            // Leg 1: In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 180 * 2.0 = 360, Transfer penalty: 300
            // Total: 450 + 480 + 600 + 2610 + 2790 + 480 + 360 + 300 = 8070

            expect(cyclingResult).toBe(8070);
        });

        test('should correctly handle headway threshold for different contexts', () => {
            const urbanGcf = new GeneralizedCostFunction(createDefaultWeights(), 'urban');
            const regionalGcf = new GeneralizedCostFunction(createDefaultWeights(), 'regional');
            const intercityGcf = new GeneralizedCostFunction(createDefaultWeights(), 'intercity');

            const values = createDefaultValues();
            values.byLeg[0].headwaySeconds = 700; // 11.67 minutes
            values.byLeg[1].headwaySeconds = 1200; // 20 minutes

            const urbanResult = urbanGcf.calculateWeightedTravelTimeSeconds(values);
            const regionalResult = regionalGcf.calculateWeightedTravelTimeSeconds(values);
            const intercityResult = intercityGcf.calculateWeightedTravelTimeSeconds(values);

            // Context thresholds:
            // - Urban: 600s (10 min) | Regional: 900s (15 min) | Intercity: 1800s (30 min)
            //
            // Leg 0 (700s = 11.67 min):
            // - Urban: 700 > 600 → LOW (300) | Regional: 700 < 900 → HIGH (180) | Intercity: 700 < 1800 → HIGH (180)
            //
            // Leg 1 (1200s = 20 min):
            // - Urban: 1200 > 600 → LOW (300) | Regional: 1200 > 900 → LOW (300) | Intercity: 1200 < 1800 → HIGH (180)

            // Manual calculation for urban (threshold 600s):
            // Access: 600, Egress: 480, First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            //   Headway: 700 * 0.09 = 63
            //   Boarding penalty (700 > 600): low = 300
            // Leg 1:
            //   In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            //   Headway: 1200 * 0.12 = 144
            //   Boarding penalty (1200 > 600): low = 300
            // Total: 600 + 480 + 600 + 2610 + 63 + 300 + 2790 + 480 + 450 + 300 + 144 + 300 = 9117

            expect(urbanResult).toBe(9117);

            // Manual calculation for regional (threshold 900s):
            // Access: 600, Egress: 480, First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            //   Headway: 700 * 0.09 = 63
            //   Boarding penalty (700 < 900): high = 180
            // Leg 1:
            //   In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            //   Headway: 1200 * 0.12 = 144
            //   Boarding penalty (1200 > 900): low = 300
            // Total: 600 + 480 + 600 + 2610 + 63 + 180 + 2790 + 480 + 450 + 300 + 144 + 300 = 8997

            expect(regionalResult).toBe(8997);

            // Manual calculation for intercity (threshold 1800s):
            // Access: 600, Egress: 480, First waiting: 600
            // Leg 0:
            //   In-vehicle: 2610
            //   Headway: 700 * 0.09 = 63
            //   Boarding penalty (700 < 1800): high = 180
            // Leg 1:
            //   In-vehicle: 2790, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            //   Headway: 1200 * 0.12 = 144
            //   Boarding penalty (1200 < 1800): high = 180
            // Total: 600 + 480 + 600 + 2610 + 63 + 180 + 2790 + 480 + 450 + 300 + 144 + 180 = 8877

            expect(intercityResult).toBe(8877);

            // Verify three distinct results: urban > regional > intercity
            expect(urbanResult).toBeGreaterThan(regionalResult);
            expect(regionalResult).toBeGreaterThan(intercityResult);
        });
    });
});
