/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { GeneralizedCostFunction } from '../GeneralizedCostFunction';
import { GeneralizedCostFunctionValues, GeneralizedCostFunctionWeights } from '../types';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
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
        hybridRailTires: 0.9,
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
    inVehicleTravelTimeWeightForLoadFactor: 0.1,
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
    transferPenaltySecondsByIndex: [300, 400, 500],
    transferPenaltySecondsMax: 600,
    headwayPenaltyWeightByROW: {
        A: 0.08,
        B: 0.09,
        'B-': 0.1,
        'C+': 0.11,
        C: 0.12,
        unknown: 0.1
    },
    reliabilityRatioPenaltyWeight: 100
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
            support: 'tires',
            loadFactor: undefined,
            reliabilityRatio: undefined
        },
        {
            weatherProtectionAtBoardingStop: 'indoor',
            inVehicleTravelTimeSeconds: 900,
            transferTravelTimeSeconds: 180,
            waitingTimeSeconds: 240,
            headwaySeconds: 600,
            rightOfWayCategory: 'C',
            verticalAlignment: 'underground',
            support: 'rail',
            loadFactor: undefined,
            reliabilityRatio: undefined
        }
    ]
});

describe('GeneralizedCostFunction', () => {

    describe('calculateWeightedTravelTimeSeconds', () => {
        test('should return error when byLeg is empty', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();
            values.byLeg = [];

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            expect(Status.isStatusError(result)).toBe(true);
            if (Status.isStatusError(result)) {
                expect((result.error as Error).message).toBe('At least one leg is required');
            }
        });

        // Time value validation tests
        test.each([
            { field: 'accessTravelTimeSeconds', value: NaN, errorCode: 'GCO002' },
            { field: 'accessTravelTimeSeconds', value: -100, errorCode: 'GCO002' },
            { field: 'accessTravelTimeSeconds', value: Infinity, errorCode: 'GCO002' },
            { field: 'egressTravelTimeSeconds', value: NaN, errorCode: 'GCO003' },
            { field: 'egressTravelTimeSeconds', value: -100, errorCode: 'GCO003' },
            { field: 'egressTravelTimeSeconds', value: Infinity, errorCode: 'GCO003' }
        ])(
            'should return error when $field is $value',
            ({ field, value, errorCode }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                (values as any)[field] = value;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                expect(Status.isStatusError(result)).toBe(true);
                if (Status.isStatusError(result)) {
                    expect((result.error as TrError).getCode()).toBe(errorCode);
                }
            }
        );

        test.each([
            { legIndex: 0, field: 'waitingTimeSeconds', value: NaN, errorCode: 'GCO004' },
            { legIndex: 0, field: 'waitingTimeSeconds', value: -100, errorCode: 'GCO004' },
            { legIndex: 0, field: 'inVehicleTravelTimeSeconds', value: NaN, errorCode: 'GCO005' },
            { legIndex: 0, field: 'inVehicleTravelTimeSeconds', value: -100, errorCode: 'GCO005' },
            { legIndex: 1, field: 'inVehicleTravelTimeSeconds', value: Infinity, errorCode: 'GCO005' },
            { legIndex: 1, field: 'waitingTimeSeconds', value: NaN, errorCode: 'GCO006' },
            { legIndex: 1, field: 'waitingTimeSeconds', value: -100, errorCode: 'GCO006' },
            { legIndex: 1, field: 'transferTravelTimeSeconds', value: NaN, errorCode: 'GCO007' },
            { legIndex: 1, field: 'transferTravelTimeSeconds', value: -100, errorCode: 'GCO007' }
        ])(
            'should return error when leg $legIndex $field is $value',
            ({ legIndex, field, value, errorCode }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                (values.byLeg[legIndex] as any)[field] = value;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                expect(Status.isStatusError(result)).toBe(true);
                if (Status.isStatusError(result)) {
                    expect((result.error as TrError).getCode()).toBe(errorCode);
                }
            }
        );

        test('should calculate weighted travel time with two legs and headway', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation with MULTIPLICATIVE in-vehicle weights:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (leg 0, covered weather protection): 2.0 * 300 = 600
            // Leg 0:
            //   In-vehicle: 900 * (0.9 * 1.0 * 1.0) = 900 * 0.9 = 810
            //   No transfer penalties (first leg)
            //   Headway: 480 * 0.09 = 43.2
            // Leg 1:
            //   In-vehicle: 900 * (1.2 * 0.85 * 1.05) = 900 * 1.071 = 963.9
            //   Transfer waiting (indoor weather protection): 240 * 2.0 = 480
            //   Transfer travel (walking): 180 * 2.5 = 450
            //   Transfer penalty by index (transfer 0): 300
            //   Headway: 600 * 0.12 = 72
            // Total: 600 + 480 + 600 + 810 + 43.2 + 963.9 + 480 + 450 + 300 + 72 = 4799.1

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(4799.1, 1);
            }
        });

        test('should calculate weighted travel time without headway', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation (same as above but without headway parts):
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0:
            //   In-vehicle: 900 * 0.9 = 810
            //   No transfer penalties
            // Leg 1:
            //   In-vehicle: 900 * 1.071 = 963.9
            //   Transfer waiting: 480
            //   Transfer travel: 450
            //   Transfer penalty by index: 300
            // Total: 600 + 480 + 600 + 810 + 963.9 + 480 + 450 + 300 = 4683.9

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(4683.9, 1);
            }
        });

        test('should skip all headway costs if any leg is missing headway (all-or-nothing behavior)', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());

            // Case 1: Both legs have headway
            const valuesWithBothHeadways = createDefaultValues();
            valuesWithBothHeadways.byLeg[0].headwaySeconds = 480;
            valuesWithBothHeadways.byLeg[1].headwaySeconds = 600;
            const resultWithBothHeadways = gcf.calculateWeightedTravelTimeSeconds(valuesWithBothHeadways);

            // Case 2: Only first leg has headway (second is missing)
            const valuesWithFirstHeadwayOnly = createDefaultValues();
            valuesWithFirstHeadwayOnly.byLeg[0].headwaySeconds = 480;
            delete valuesWithFirstHeadwayOnly.byLeg[1].headwaySeconds;
            const resultWithFirstHeadwayOnly = gcf.calculateWeightedTravelTimeSeconds(valuesWithFirstHeadwayOnly);

            // Case 3: Only second leg has headway (first is missing)
            const valuesWithSecondHeadwayOnly = createDefaultValues();
            delete valuesWithSecondHeadwayOnly.byLeg[0].headwaySeconds;
            valuesWithSecondHeadwayOnly.byLeg[1].headwaySeconds = 600;
            const resultWithSecondHeadwayOnly = gcf.calculateWeightedTravelTimeSeconds(valuesWithSecondHeadwayOnly);

            // Case 4: Neither leg has headway
            const valuesWithNoHeadway = createDefaultValues();
            delete valuesWithNoHeadway.byLeg[0].headwaySeconds;
            delete valuesWithNoHeadway.byLeg[1].headwaySeconds;
            const resultWithNoHeadway = gcf.calculateWeightedTravelTimeSeconds(valuesWithNoHeadway);

            // Verify all results are successful
            expect(Status.isStatusOk(resultWithBothHeadways)).toBe(true);
            expect(Status.isStatusOk(resultWithFirstHeadwayOnly)).toBe(true);
            expect(Status.isStatusOk(resultWithSecondHeadwayOnly)).toBe(true);
            expect(Status.isStatusOk(resultWithNoHeadway)).toBe(true);

            if (
                Status.isStatusOk(resultWithBothHeadways) &&
                Status.isStatusOk(resultWithFirstHeadwayOnly) &&
                Status.isStatusOk(resultWithSecondHeadwayOnly) &&
                Status.isStatusOk(resultWithNoHeadway)
            ) {
                // When ANY leg is missing headway, the result should be the same as when NO leg has headway
                // This verifies the all-or-nothing behavior of getHeadways
                expect(resultWithFirstHeadwayOnly.result).toBeCloseTo(resultWithNoHeadway.result, 1);
                expect(resultWithSecondHeadwayOnly.result).toBeCloseTo(resultWithNoHeadway.result, 1);

                // Verify the base calculation without headway is ~4683.9 (from previous test)
                expect(resultWithNoHeadway.result).toBeCloseTo(4683.9, 1);

                // Verify the calculation with headway adds the expected costs:
                // Headway costs for leg 0: 480 * 0.09 = 43.2
                // Headway costs for leg 1: 600 * 0.12 = 72
                // Total headway costs: 43.2 + 72 = 115.2
                // Expected total: 4683.9 + 115.2 = 4799.1
                expect(resultWithBothHeadways.result).toBeCloseTo(4799.1, 1);
            }
        });

        // Invalid headway values (NaN, Infinity, -Infinity) should be treated like missing headway
        // and skip all headway costs (all-or-nothing behavior)
        test.each([
            { scenario: 'NaN headway on one leg', leg0Headway: NaN, leg1Headway: 600 },
            { scenario: 'NaN headway on both legs', leg0Headway: NaN, leg1Headway: NaN },
            { scenario: 'undefined headway on one leg', leg0Headway: undefined, leg1Headway: 600 },
            { scenario: 'undefined headway on both legs', leg0Headway: undefined, leg1Headway: undefined },
            { scenario: 'Infinity headway on one leg', leg0Headway: Infinity, leg1Headway: 600 },
            { scenario: 'Negative number headway on one leg', leg0Headway: 480, leg1Headway: -233 },
            { scenario: 'Negative number headway on both legs', leg0Headway: -1, leg1Headway: -1 }
        ])(
            'should skip headway costs when $scenario',
            ({ leg0Headway, leg1Headway }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                values.byLeg[0].headwaySeconds = leg0Headway;
                values.byLeg[1].headwaySeconds = leg1Headway;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                // Should succeed and return the base calculation without headway costs
                expect(Status.isStatusOk(result)).toBe(true);
                if (Status.isStatusOk(result)) {
                    // Base calculation without headway is ~4683.9
                    expect(result.result).toBeCloseTo(4683.9, 1);
                    // Verify result is not NaN
                    expect(Number.isFinite(result.result)).toBe(true);
                }
            }
        );

        test('should handle single leg trip (no transfers)', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
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
                        support: 'rail',
                        loadFactor: undefined,
                        reliabilityRatio: undefined
                    }
                ]
            };

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation:
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (none weather protection): 2.5 * 300 = 750
            // Leg 0:
            //   In-vehicle: 900 * (0.8 * 0.85 * 1.0) = 900 * 0.68 = 612
            //   No transfer penalties (single leg, no transfers)
            //   Headway: 480 * 0.08 = 38.4
            // Total: 600 + 480 + 750 + 612 + 38.4 = 2480.4

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(2480.4, 1);
            }
        });

        test('should use transferPenaltySecondsMax when transfer index exceeds provided penalties', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();

            // Add more legs to exceed transferPenaltySecondsByIndex length
            values.byLeg.push(
                {
                    weatherProtectionAtBoardingStop: 'covered',
                    inVehicleTravelTimeSeconds: 600,
                    transferTravelTimeSeconds: 120,
                    waitingTimeSeconds: 180,
                    headwaySeconds: 720,
                    rightOfWayCategory: 'B-',
                    verticalAlignment: 'aerial',
                    support: 'tires',
                    loadFactor: undefined,
                    reliabilityRatio: undefined
                },
                {
                    weatherProtectionAtBoardingStop: 'indoor',
                    inVehicleTravelTimeSeconds: 500,
                    transferTravelTimeSeconds: 100,
                    waitingTimeSeconds: 150,
                    headwaySeconds: 800,
                    rightOfWayCategory: 'C+',
                    verticalAlignment: 'surface',
                    support: 'rail',
                    loadFactor: undefined,
                    reliabilityRatio: undefined
                }
            );

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation for 4 legs with 3 transfers (MULTIPLICATIVE weights):
            // Access: 2.0 * 300 = 600
            // Egress: 2.0 * 240 = 480
            // First waiting (leg 0, covered): 2.0 * 300 = 600
            //
            // Leg 0 (i=0, no transfer):
            //   In-vehicle: 900 * (0.9 * 1.0 * 1.0) = 810
            //   Headway: 480 * 0.09 = 43.2
            //
            // Leg 1 (i=1, transfer index 0):
            //   In-vehicle: 900 * (1.2 * 0.85 * 1.05) = 963.9
            //   Transfer waiting (indoor): 240 * 2.0 = 480
            //   Transfer travel: 180 * 2.5 = 450
            //   Transfer penalty[0]: 300
            //   Headway: 600 * 0.12 = 72
            //
            // Leg 2 (i=2, transfer index 1):
            //   In-vehicle: 600 * (1.0 * 1.0 * 0.95) = 570
            //   Transfer waiting (covered): 180 * 2.5 = 450
            //   Transfer travel: 120 * 2.5 = 300
            //   Transfer penalty[1]: 400
            //   Headway: 720 * 0.1 = 72
            //
            // Leg 3 (i=3, transfer index 2):
            //   In-vehicle: 500 * (1.1 * 0.85 * 1.0) = 467.5
            //   Transfer waiting (indoor): 150 * 2.0 = 300
            //   Transfer travel: 100 * 2.5 = 250
            //   Transfer penalty[2]: 500
            //   Headway: 800 * 0.11 = 88
            //
            // Total: 600 + 480 + 600 + 810 + 43.2 + 963.9 + 480 + 450 + 300 + 72
            //      + 570 + 450 + 300 + 400 + 72 + 467.5 + 300 + 250 + 500 + 88 = 8196.6

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(8196.6, 1);
            }
        });

        // Tests transferPenaltySecondsMax when transfer index exceeds defined penalties.
        // Custom weights: transferPenaltySecondsByIndex = [300], transferPenaltySecondsMax = 999
        // - 2 legs (1 transfer): uses transferPenaltySecondsByIndex[0] = 300
        // - 3 legs (2 transfers): uses transferPenaltySecondsByIndex[0] = 300, then transferPenaltySecondsMax = 999
        test.each([
            {
                scenario: '2 legs using transferPenaltySecondsByIndex[0]',
                addThirdLeg: false,
                expected: 4683.9 // Base without headway
            },
            {
                scenario: '3 legs using transferPenaltySecondsMax for second transfer',
                addThirdLeg: true,
                // Base + leg 2 in-vehicle (800 * 0.9 * 1.0 * 1.0 = 720) + transfer waiting (200 * 2.5 = 500)
                // + transfer travel (150 * 2.5 = 375) + transferPenaltySecondsMax (999) = 4683.9 + 720 + 500 + 375 + 999 = 7277.9
                expected: 7277.9
            }
        ])(
            'should apply correct transfer penalty for $scenario',
            ({ addThirdLeg, expected }) => {
                const customWeights = createDefaultWeights();
                customWeights.transferPenaltySecondsByIndex = [300]; // Only 1 penalty defined
                customWeights.transferPenaltySecondsMax = 999;

                const gcf = new GeneralizedCostFunction(customWeights);
                const values = createDefaultValues();
                delete values.byLeg[0].headwaySeconds;
                delete values.byLeg[1].headwaySeconds;

                if (addThirdLeg) {
                    values.byLeg.push({
                        weatherProtectionAtBoardingStop: 'covered' as WeatherProtection,
                        inVehicleTravelTimeSeconds: 800,
                        transferTravelTimeSeconds: 150,
                        waitingTimeSeconds: 200,
                        rightOfWayCategory: 'B' as RightOfWayCategory,
                        verticalAlignment: 'surface',
                        support: 'tires',
                        loadFactor: undefined,
                        reliabilityRatio: undefined
                    });
                }

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                expect(Status.isStatusOk(result)).toBe(true);
                if (Status.isStatusOk(result)) {
                    expect(result.result).toBeCloseTo(expected, 1);
                }
            }
        );

        // Access mode affects both access time weight and transfer travel time weight:
        // - walking: access weight = 2.0, transfer weight = 2.5
        // - cycling: access weight = 1.5, transfer weight = 2.0
        // - driving: access weight = 1.0, transfer weight = 1.5
        // Base (no headway): Egress: 480, First waiting: 600, Leg 0 in-vehicle: 810,
        // Leg 1 in-vehicle: 963.9, Transfer waiting: 480, Transfer penalty: 300
        // Variable: Access (300s) * access weight + Transfer travel (180s) * transfer weight
        test.each([
            // walking: 300 * 2.0 + 180 * 2.5 = 600 + 450 = 1050, Total = 4683.9
            { accessMode: 'walking' as const, expected: 4683.9 },
            // cycling: 300 * 1.5 + 180 * 2.0 = 450 + 360 = 810, Total = 4443.9
            { accessMode: 'cycling' as const, expected: 4443.9 },
            // driving: 300 * 1.0 + 180 * 1.5 = 300 + 270 = 570, Total = 4203.9
            { accessMode: 'driving' as const, expected: 4203.9 }
        ])('should apply correct weights for $accessMode access mode', ({ accessMode, expected }) => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();
            values.accessMode = accessMode;
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(expected, 1);
            }
        });

        // Egress mode weights (egress time = 240s):
        // - walking: weight = 2.0 → 480
        // - cycling: weight = 1.5 → 360
        // - driving: weight = 1.0 → 240
        // Base (no headway, egress excluded): Access: 600, First waiting: 600, Leg 0 in-vehicle: 810,
        // Leg 1 in-vehicle: 963.9, Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300 = 4203.9
        // Total = 4203.9 + egress
        test.each([
            { egressMode: 'walking' as const, expected: 4683.9 },
            { egressMode: 'cycling' as const, expected: 4563.9 },
            { egressMode: 'driving' as const, expected: 4443.9 }
        ])('should apply correct weight for $egressMode egress mode', ({ egressMode, expected }) => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();
            values.egressMode = egressMode;
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(expected, 1);
            }
        });

        // Weather protection weights for first waiting time (waiting time = 300s):
        // - none: weight = 2.5 → 750
        // - covered: weight = 2.0 → 600
        // - indoor: weight = 1.5 → 450
        // Base calculation (no headway, first waiting excluded): Access: 600, Egress: 480,
        // Leg 0 in-vehicle: 810, Leg 1 in-vehicle: 963.9, Transfer waiting: 480,
        // Transfer travel: 450, Transfer penalty: 300 = 4083.9
        // Total = 4083.9 + first waiting
        test.each([
            { weatherProtection: 'none' as WeatherProtection, expected: 4833.9 },
            { weatherProtection: 'covered' as WeatherProtection, expected: 4683.9 },
            { weatherProtection: 'indoor' as WeatherProtection, expected: 4533.9 }
        ])(
            'should apply $weatherProtection weather protection weight correctly',
            ({ weatherProtection, expected }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                values.byLeg[0].weatherProtectionAtBoardingStop = weatherProtection;
                delete values.byLeg[0].headwaySeconds;
                delete values.byLeg[1].headwaySeconds;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                expect(Status.isStatusOk(result)).toBe(true);
                if (Status.isStatusOk(result)) {
                    expect(result.result).toBeCloseTo(expected, 1);
                }
            }
        );

        test('should multiply ROW, support, and vertical alignment weights for in-vehicle time', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation with MULTIPLICATIVE weights:
            // Access: 600
            // Egress: 480
            // First waiting: 600
            // Leg 0: In-vehicle: 900 * (ROW B: 0.9 * support tires: 1.0 * vertical surface: 1.0) = 900 * 0.9 = 810
            // Leg 1: In-vehicle: 900 * (ROW C: 1.2 * support rail: 0.85 * vertical underground: 1.05) = 900 * 1.071 = 963.9
            //        Transfer waiting: 480, Transfer travel: 450, Transfer penalty: 300
            // Total: 600 + 480 + 600 + 810 + 963.9 + 480 + 450 + 300 = 4683.9

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(4683.9, 1);
            }
        });

        test('should apply load factor weight when provided', () => {
            // Use weight = 1.0 for clearer semantics: empty = no effect, crowded = penalty
            const customWeights = createDefaultWeights();
            customWeights.inVehicleTravelTimeWeightForLoadFactor = 1.0;

            const gcf = new GeneralizedCostFunction(customWeights);
            const values = createDefaultValues();
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            // Set load factor for leg 0 (factor of 0.5 with weight 1.0 means 1.0 * (0.5 + 1.0) = 1.5 multiplier)
            // This represents moderate crowding increasing perceived travel time by 50%
            values.byLeg[0].loadFactor = 0.5;

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation:
            // Leg 0 with load factor: 900 * (0.9 * 1.0 * 1.0 * 1.5) = 900 * 1.35 = 1215
            // Leg 1 without load factor: 963.9 (unchanged)
            // Base without headway is 4683.9, with leg 0 in-vehicle = 810
            // Difference from load factor: 1215 - 810 = 405
            // Total: 4683.9 + 405 = 5088.9

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(5088.9, 1);
            }
        });

        // Invalid load factor values should be ignored (treated as 1.0 multiplier)
        test.each([
            { scenario: 'undefined', loadFactor: undefined },
            { scenario: 'NaN', loadFactor: NaN },
            { scenario: 'Infinity', loadFactor: Infinity },
            { scenario: '-Infinity', loadFactor: -Infinity },
            { scenario: 'negative number', loadFactor: -0.5 }
        ])(
            'should ignore load factor when $scenario',
            ({ loadFactor }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                delete values.byLeg[0].headwaySeconds;
                delete values.byLeg[1].headwaySeconds;
                values.byLeg[0].loadFactor = loadFactor;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                // Should give the same result as the base calculation (4683.9)
                expect(Status.isStatusOk(result)).toBe(true);
                if (Status.isStatusOk(result)) {
                    expect(result.result).toBeCloseTo(4683.9, 1);
                    // Verify result is not NaN
                    expect(Number.isFinite(result.result)).toBe(true);
                }
            }
        );

        test('should apply reliability ratio penalty when provided', () => {
            const gcf = new GeneralizedCostFunction(createDefaultWeights());
            const values = createDefaultValues();
            delete values.byLeg[0].headwaySeconds;
            delete values.byLeg[1].headwaySeconds;

            // Set reliability ratio for both legs
            values.byLeg[0].reliabilityRatio = 0.9; // 90% on-time
            values.byLeg[1].reliabilityRatio = 0.85; // 85% on-time

            const result = gcf.calculateWeightedTravelTimeSeconds(values);

            // Manual calculation using (1 - reliabilityRatio):
            // Base without reliability: 4683.9
            // Unreliability penalty leg 0: 100 * (1 - 0.9) = 100 * 0.1 = 10
            // Unreliability penalty leg 1: 100 * (1 - 0.85) = 100 * 0.15 = 15
            // Total: 4683.9 + 10 + 15 = 4708.9

            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toBeCloseTo(4708.9, 1);
            }
        });

        test.each([
            { scenario: 'undefined', reliabilityRatio: undefined },
            { scenario: 'NaN', reliabilityRatio: NaN },
            { scenario: 'Infinity', reliabilityRatio: Infinity },
            { scenario: '-Infinity', reliabilityRatio: -Infinity },
            { scenario: 'negative number', reliabilityRatio: -0.5 },
            { scenario: 'greater than 1', reliabilityRatio: 1.5 }
        ])(
            'should ignore reliability ratio when $scenario',
            ({ reliabilityRatio }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                delete values.byLeg[0].headwaySeconds;
                delete values.byLeg[1].headwaySeconds;
                values.byLeg[0].reliabilityRatio = reliabilityRatio;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                // Should give the same result as the base calculation (4683.9)
                expect(Status.isStatusOk(result)).toBe(true);
                if (Status.isStatusOk(result)) {
                    expect(result.result).toBeCloseTo(4683.9, 1);
                    // Verify result is not NaN
                    expect(Number.isFinite(result.result)).toBe(true);
                }
            }
        );

        // Headway penalty is now simply headway * headwayPenaltyWeightByROW
        test.each([
            {
                scenario: 'short headway',
                leg0Headway: 300,
                leg1Headway: 450,
                // Leg 0: 300 * 0.09 = 27, Leg 1: 450 * 0.12 = 54, Total headway = 81
                expected: 4764.9 // 4683.9 + 81
            },
            {
                scenario: 'long headway',
                leg0Headway: 900,
                leg1Headway: 1200,
                // Leg 0: 900 * 0.09 = 81, Leg 1: 1200 * 0.12 = 144, Total headway = 225
                expected: 4908.9 // 4683.9 + 225
            }
        ])(
            'should apply headway penalty for $scenario',
            ({ leg0Headway, leg1Headway, expected }) => {
                const gcf = new GeneralizedCostFunction(createDefaultWeights());
                const values = createDefaultValues();
                values.byLeg[0].headwaySeconds = leg0Headway;
                values.byLeg[1].headwaySeconds = leg1Headway;

                const result = gcf.calculateWeightedTravelTimeSeconds(values);

                expect(Status.isStatusOk(result)).toBe(true);
                if (Status.isStatusOk(result)) {
                    expect(result.result).toBeCloseTo(expected, 1);
                }
            }
        );

    });
});
