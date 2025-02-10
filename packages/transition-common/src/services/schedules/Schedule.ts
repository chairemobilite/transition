/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _isNumber from 'lodash/isNumber';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitPath from '../path/Path';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';

export enum UnitLocation {
    ORIGIN = 'origin',
    DESTINATION = 'destination',
    IN_TRANSIT = 'in_transit'
}

export enum UnitDirection {
    OUTBOUND = 'outbound',
    INBOUND = 'inbound'
}

const SCHEDULE_DEFAULTS: ScheduleDefaults = {
    DEFAULT_TOTAL_CAPACITY: 50,
    DEFAULT_SEATED_CAPACITY: 20
};

// When adding new modes, the string value has to be the same as the key in the translation files
export enum ScheduleCalculationMode {
    ASYMMETRIC = 'AsymmetricSchedule',
    BASIC = 'SymmetricSchedule'
}

export interface SchedulePeriodTrip extends GenericAttributes {
    schedule_period_id?: number;
    path_id: string;
    unit_id?: string;
    block_id?: string;
    departure_time_seconds: number;
    arrival_time_seconds: number;
    seated_capacity?: number;
    total_capacity?: number;
    node_arrival_times_seconds: number[];
    node_departure_times_seconds: number[];
    nodes_can_board: boolean[];
    nodes_can_unboard: boolean[];
}

export interface SchedulePeriod extends GenericAttributes {
    schedule_id?: number;
    outbound_path_id?: string;
    inbound_path_id?: string;
    period_shortname?: string;
    interval_seconds?: number;
    inbound_interval_seconds?: number;
    number_of_units?: number;
    calculated_interval_seconds?: number;
    calculated_number_of_units?: number;
    start_at_hour: number;
    end_at_hour: number;
    // FIXME: Use seconds since midnight format instead of string, which can be anything
    custom_start_at_str?: string;
    custom_end_at_str?: string;
    trips: SchedulePeriodTrip[];
}

export interface ScheduleAttributes extends GenericAttributes {
    line_id: string;
    service_id: string;
    periods_group_shortname?: string;
    calculation_mode?: ScheduleCalculationMode;
    allow_seconds_based_schedules?: boolean;
    // TODO Create classes for periods and trips
    periods: SchedulePeriod[];
}

export interface TransitUnit {
    id: number;
    totalCapacity: number;
    seatedCapacity: number;
    currentLocation: UnitLocation;
    expectedArrivalTime: number;
    expectedReturnTime: number | null;
    direction: UnitDirection | null;
    lastTripEndTime: number | null;
    timeInCycle: number;
}

interface ScheduleDefaults {
    DEFAULT_TOTAL_CAPACITY: number;
    DEFAULT_SEATED_CAPACITY: number;
}

// Interface for generateTrips options
export interface GenerateTripsOptions {
    startAtSecondsSinceMidnight: number;
    endAtSecondsSinceMidnight: number;
    outboundIntervalSeconds: number;
    inboundIntervalSeconds: number;
    outboundTotalTimeSeconds: number;
    inboundTotalTimeSeconds: number;
    units: TransitUnit[];
    outboundPath: TransitPath;
    inboundPath?: TransitPath;
    period?: any;
}

// Interface for calculateResourceRequirements options
interface CalculateResourcesOptions {
    period: any;
    startAtSecondsSinceMidnight: number;
    endAtSecondsSinceMidnight: number;
    outboundTotalTimeSeconds: number;
    inboundTotalTimeSeconds: number;
    secondAllowed?: boolean;
}

export interface GenerateTripsWithIntervalsOptions {
    startAtSecondsSinceMidnight: number;
    endAtSecondsSinceMidnight: number;
    outboundIntervalSeconds: number;
    inboundIntervalSeconds: number;
    outboundTotalTimeSeconds: number;
    inboundTotalTimeSeconds: number;
    units: TransitUnit[];
    outboundPath: TransitPath;
    inboundPath?: TransitPath;
}

// Interface for initializeUnits
export interface InitializeUnitsOptions {
    units: TransitUnit[];
    startFromDestination: boolean;
    startTime: number;
}

// Interface for generateDepartureSchedules
export interface GenerateDepartureSchedulesOptions {
    startTime: number;
    endTime: number;
    outboundIntervalSeconds: number;
    inboundIntervalSeconds: number;
    outboundTotalTimeSeconds: number;
    inboundTotalTimeSeconds: number;
    startFromDestination: boolean;
    hasInboundPath: boolean;
}

// Interface for processing scheduled departures
export interface ProcessDeparturesOptions {
    currentTime: number;
    nextOutbound: number;
    nextInbound: number;
    units: TransitUnit[];
    outboundPath: TransitPath;
    inboundPath?: TransitPath;
    outboundTotalTimeSeconds: number;
    inboundTotalTimeSeconds: number;
    trips: any[];
    usedUnitsIds: Set<number>;
    outboundDepartures: number[];
    inboundDepartures: number[];
}

// Interface for processDeparture
export interface ProcessDepartureOptions {
    currentTime: number;
    totalTimeSeconds: number;
    units: TransitUnit[];
    path: TransitPath;
    trips: any[];
    direction: UnitDirection;
}

// Interface for generateTrip
export interface GenerateTripOptions {
    tripStartAtSeconds: number;
    unit: TransitUnit;
    path: TransitPath;
    segments: any[];
    nodes: string[];
    dwellTimes: number[];
    blockId?: string | null;
}

// interface for schedule generation strategies
export interface ScheduleGenerationStrategy {
    calculateResourceRequirements(options: CalculateResourcesOptions): {
        units: TransitUnit[];
        outboundIntervalSeconds: number;
        inboundIntervalSeconds: number;
    };

    generateTrips(options: GenerateTripsOptions): {
        trips: SchedulePeriodTrip[];
        realUnitCount: number;
    };
}
export abstract class BaseScheduleStrategy implements ScheduleGenerationStrategy {
    // Shared methods for all strategies
    protected generateTrip(options: GenerateTripOptions) {
        try {
            const { tripStartAtSeconds, unit, path, segments, nodes, dwellTimes, blockId = null } = options;

            const tripArrivalTimesSeconds: (number | null)[] = [];
            const tripDepartureTimesSeconds: (number | null)[] = [];
            const canBoards: boolean[] = [];
            const canUnboards: boolean[] = [];
            const nodesCount = nodes.length;
            let tripTimeSoFar = tripStartAtSeconds;

            // The rest of the implementation remains unchanged..
            for (let i = 0; i < nodesCount; i++) {
                const segment = segments[i];
                const dwellTimeSeconds = dwellTimes[i] || 0;
                if (i > 0) {
                    tripArrivalTimesSeconds.push(tripTimeSoFar);
                    canUnboards.push(true);
                    if (i === nodesCount - 1) {
                        tripDepartureTimesSeconds.push(null);
                        canBoards.push(false);
                    }
                }
                if (i < nodesCount - 1) {
                    tripTimeSoFar += dwellTimeSeconds;
                    tripDepartureTimesSeconds.push(tripTimeSoFar);
                    tripTimeSoFar += segment.travelTimeSeconds;
                    canBoards.push(true);
                    if (i === 0) {
                        tripArrivalTimesSeconds.push(null);
                        canUnboards.push(false);
                    }
                }
            }

            const trip = {
                id: uuidV4(),
                path_id: path.get('id'),
                departure_time_seconds: tripStartAtSeconds,
                arrival_time_seconds: tripTimeSoFar,
                node_arrival_times_seconds: tripArrivalTimesSeconds,
                node_departure_times_seconds: tripDepartureTimesSeconds,
                nodes_can_board: canBoards,
                nodes_can_unboard: canUnboards,
                block_id: blockId,
                total_capacity: unit.totalCapacity,
                seated_capacity: unit.seatedCapacity,
                // TODO Add unit management and see if any of this data should go in the 'data' field
                unit_id: null,
                unitDirection: unit.direction,
                unitReadyAt: unit.expectedReturnTime || unit.expectedArrivalTime
            };

            return trip;
        } catch (error) {
            throw `The path ${options.path.getId()} for line ${options.path.getLine()?.getAttributes().shortname} (${
                options.path.attributes.line_id
            }) is not valid. Please recalculate routing for this path, error : ${error}`;
        }
    }

    // Abstract methods that sub classes need to implement
    abstract calculateResourceRequirements(options: CalculateResourcesOptions): {
        units: TransitUnit[];
        outboundIntervalSeconds: number;
        inboundIntervalSeconds: number;
    };

    abstract generateTrips(options: GenerateTripsOptions): {
        trips: SchedulePeriodTrip[];
        realUnitCount: number;
    };
}

export class ScheduleStrategyFactory {
    static createStrategy(mode: ScheduleCalculationMode): ScheduleGenerationStrategy {
        switch (mode) {
        case ScheduleCalculationMode.ASYMMETRIC:
            return new AsymmetricScheduleStrategy();
        case ScheduleCalculationMode.BASIC:
            return new SymmetricScheduleStrategy();
        default:
            return new SymmetricScheduleStrategy(); // Default strategy
        }
    }
}

/**
 * Asymmetric Schedule Generation Strategy
 *
 * This strategy supports asymmetric transit schedules, allowing different intervals and logic
 * for outbound and inbound directions. It dynamically assigns transit units to departures based on availability,
 * direction, and scheduling constraints.
 *
 * Main Features:
 * - Different intervals for outbound and inbound directions
 * - Resource allocation based on either fixed unit count or defined intervals
 * - Dynamic unit availability tracking and optimal assignment
 * - Simulation of return trips when no inbound path is defined
 *
 * Schedule Generation Process:
 * 1. Resource Calculation
 *    - Method: `calculateResourceRequirements`
 *    - Determines number of units and intervals using either:
 *        a) Fixed unit count
 *        b) Specified interval(s)
 *
 * 2. Unit Initialization
 *    - Method: `initializeUnits`
 *    - Sets initial state for each unit (location, direction, availability)
 *
 * 3. Departure Planning
 *    - Method: `generateDepartureSchedules`
 *    - Computes outbound and inbound departure timestamps based on intervals and total times
 *
 * 4. Trip Generation Loop
 *    - Method: `generateTripsWithIntervals` or `generateTripsWithFixedUnits`
 *    - At each timestamp, the strategy:
 *        a) Updates unit availability (`updateAllUnitsAvailability`)
 *        b) Selects appropriate unit (`findBestUnit`)
 *        c) Creates and assigns trips (`processDeparture`, `generateTrip`)
 *        d) Handles:
 *           -  departures (`processDepartures`)
 *
 * Helper Methods:
 * - `updateUnitAvailability`: Updates a single unit's location and direction based on time
 * - `findBestUnit`: Chooses the best available unit for a departure
 * - `processDeparture`: Builds a trip and updates unit state
 * - `generateTrip`: Constructs trip data (arrival/departure per node)
 *
 * Special Case Handling:
 * - No inbound path: Simulates ghost return trips by resetting units to origin
 * - Different intervals: Handles out-of-sync departures for each direction
 *
 * Entrypoint:
 * - `generateTrips`: Delegates to interval-based or unit-count-based generation strategies
 */

export class AsymmetricScheduleStrategy extends BaseScheduleStrategy {
    /**
     * Calculates resource requirements for transit scheduling
     *
     * This method determines the number of transit units and departure intervals
     * based on two possible input scenarios:
     * 1. Fixed number of units
     * 2. Specified departure intervals
     *
     * @param options - Object containing scheduling calculation parameters
     * @param options.period - Scheduling period configuration
     * @param options.startAtSecondsSinceMidnight - Start time of the service period
     * @param options.endAtSecondsSinceMidnight - End time of the service period
     * @param options.outboundTotalTimeSeconds - Total duration of the outbound trip
     * @param options.inboundTotalTimeSeconds - Total duration of the inbound trip
     * @param options.secondAllowed - Flag to allow precise second-level intervals
     *
     * @returns Object containing:
     *  - units: Array of initialized transit units
     *  - outboundIntervalSeconds: Interval between outbound departures
     *  - inboundIntervalSeconds: Interval between inbound departures
     */
    calculateResourceRequirements(options: CalculateResourcesOptions) {
        const {
            period,
            startAtSecondsSinceMidnight,
            endAtSecondsSinceMidnight,
            outboundTotalTimeSeconds,
            inboundTotalTimeSeconds,
            secondAllowed
        } = options;

        const cycleTimeSeconds = outboundTotalTimeSeconds + inboundTotalTimeSeconds;
        let tripsIntervalSeconds: number = 0;
        let tripsNumberOfUnits: number = 0;
        let totalPeriod = -1;

        // Scenario 1: Fixed number of units specified
        if (_isNumber(period.number_of_units)) {
            period.inboundIntervalSeconds = 0;
            tripsNumberOfUnits = period.number_of_units;
            tripsIntervalSeconds = Math.ceil(cycleTimeSeconds / period.number_of_units);
            if (secondAllowed !== true) {
                tripsIntervalSeconds = Math.ceil(tripsIntervalSeconds / 60) * 60;
            }

            period.calculated_interval_seconds = tripsIntervalSeconds;
            period.calculated_number_of_units = period.numberOfUnits;
        } else if (_isNumber(period.interval_seconds) && _isNumber(period.inbound_interval_seconds)) {
            // Scenario 2: Specified intervals for outbound and inbound trips
            totalPeriod = endAtSecondsSinceMidnight - startAtSecondsSinceMidnight;

            // Precise calculation of unit requirements for each direction

            // For outbound trips: how many units are needed to maintain the interval
            const outboundUnitsNeeded = Math.ceil(outboundTotalTimeSeconds / period.interval_seconds);

            // For inbound trips: how many units are needed to maintain the interval
            const inboundUnitsNeeded = Math.ceil(inboundTotalTimeSeconds / period.inbound_interval_seconds);

            // We need enough units for both directions
            tripsNumberOfUnits = outboundUnitsNeeded + inboundUnitsNeeded;

            // Check if additional units are needed for simultaneous starts
            const simultaneousStartsNeeded = Math.min(
                Math.ceil(totalPeriod / period.interval_seconds),
                Math.ceil(totalPeriod / period.inbound_interval_seconds)
            );

            // Ensure a minimum number of units for initial simultaneous departures
            if (simultaneousStartsNeeded > tripsNumberOfUnits) {
                tripsNumberOfUnits = simultaneousStartsNeeded;
            }
        }

        // Initialize units with default properties
        const units: TransitUnit[] = Array.from({ length: tripsNumberOfUnits }, (_, i) => ({
            id: i + 1,
            totalCapacity: SCHEDULE_DEFAULTS.DEFAULT_TOTAL_CAPACITY,
            seatedCapacity: SCHEDULE_DEFAULTS.DEFAULT_SEATED_CAPACITY,
            currentLocation: UnitLocation.ORIGIN, // Will be adjusted later
            expectedArrivalTime: startAtSecondsSinceMidnight,
            expectedReturnTime: null,
            direction: null,
            lastTripEndTime: null,
            timeInCycle: 0
        }));

        return {
            units,
            outboundIntervalSeconds: tripsIntervalSeconds !== 0 ? tripsIntervalSeconds : period.interval_seconds,
            inboundIntervalSeconds: period.inbound_interval_seconds
        };
    }

    //Set Current position of Unit
    protected updateUnitAvailability(unit: TransitUnit, currentTimeSeconds: number): void {
        if (unit.expectedArrivalTime <= currentTimeSeconds) {
            if (unit.direction === UnitDirection.OUTBOUND) {
                unit.currentLocation = UnitLocation.DESTINATION;
                unit.direction = null;
                unit.lastTripEndTime = currentTimeSeconds;
            } else if (unit.direction === UnitDirection.INBOUND) {
                unit.currentLocation = UnitLocation.ORIGIN;
                unit.direction = null;
                unit.lastTripEndTime = currentTimeSeconds;
            }
        }
    }

    //choose the best unit to optimize generation. We prioritize those already in circulation
    protected findBestUnit(
        currentTime: number,
        direction: UnitDirection.OUTBOUND | UnitDirection.INBOUND,
        units: TransitUnit[]
    ): TransitUnit | null {
        const availableUnits = units.filter((unit) => {
            const correctLocation =
                direction === UnitDirection.OUTBOUND
                    ? unit.currentLocation === UnitLocation.ORIGIN
                    : unit.currentLocation === UnitLocation.DESTINATION;
            const isAvailable = unit.direction === null;
            const isReady = unit.lastTripEndTime === null || currentTime >= unit.lastTripEndTime;
            return correctLocation && isAvailable && isReady;
        });
        const usedUnits = availableUnits.filter((unit) => unit.lastTripEndTime !== null);
        const unusedUnits = availableUnits.filter((unit) => unit.lastTripEndTime === null);

        if (usedUnits.length > 0) {
            return usedUnits.sort((a, b) => (a.lastTripEndTime || 0) - (b.lastTripEndTime || 0))[0];
        }

        return unusedUnits[0] || null;
    }

    protected processDeparture(options: ProcessDepartureOptions) {
        const { currentTime, totalTimeSeconds, units, path, trips, direction } = options;

        const unitTransit = this.findBestUnit(currentTime, direction, units);
        if (unitTransit) {
            const dwellTimesData = path.getData('dwellTimeSeconds');

            const dwellTimes: number[] = Array.isArray(dwellTimesData)
                ? dwellTimesData.map((time) => Number(time))
                : new Array(Node.length).fill(0);

            const segments = path.getAttributes().data.segments || [];

            const trip = this.generateTrip({
                tripStartAtSeconds: currentTime,
                unit: unitTransit,
                path: path,
                segments: segments,
                nodes: path.getAttributes().nodes,
                dwellTimes: dwellTimes
            });

            trips.push(trip);
            unitTransit.direction = direction;
            unitTransit.currentLocation = UnitLocation.IN_TRANSIT;
            unitTransit.expectedArrivalTime = currentTime + totalTimeSeconds;
            return { unitId: unitTransit.id };
        }
        return { unitId: null };
    }

    // Helper method to initialize all units
    protected initializeUnits(options: InitializeUnitsOptions): void {
        const { units, startFromDestination, startTime } = options;

        units.forEach((unit) => {
            unit.currentLocation = startFromDestination ? UnitLocation.DESTINATION : UnitLocation.ORIGIN;
            unit.direction = null;
            unit.expectedArrivalTime = startTime;
            unit.expectedReturnTime = null;
            unit.lastTripEndTime = null;
        });
    }

    // Helper method to generate departure schedules
    protected generateDepartureSchedules(options: GenerateDepartureSchedulesOptions): {
        outboundDepartures: number[];
        inboundDepartures: number[];
    } {
        const outboundDepartures: number[] = [];
        const inboundDepartures: number[] = [];

        // Generate outbound (departure) schedules with strict intervals
        let time = options.startTime;
        outboundDepartures.push(time);
        while ((time += options.outboundIntervalSeconds) < options.endTime) {
            outboundDepartures.push(time);
        }

        // Generate inbound (return) departures with strict intervals
        if (options.hasInboundPath) {
            // Also start at the departure time
            time = options.startTime;
            inboundDepartures.push(time);
            while ((time += options.inboundIntervalSeconds) < options.endTime) {
                inboundDepartures.push(time);
            }
        }

        return { outboundDepartures, inboundDepartures };
    }
    // Update all units availability based on current time
    protected updateAllUnitsAvailability(units: TransitUnit[], currentTime: number, inboundPath?: TransitPath): void {
        units.forEach((unit) => {
            // Handle "ghost trip" simulation when there's no inbound path
            if (
                !inboundPath &&
                unit.currentLocation === UnitLocation.DESTINATION &&
                currentTime >= unit.expectedArrivalTime
            ) {
                unit.currentLocation = UnitLocation.ORIGIN;
                unit.direction = null;
                unit.lastTripEndTime = currentTime;
            } else {
                this.updateUnitAvailability(unit, currentTime);
            }
        });
    }

    // Process departures
    protected processDepartures(options: ProcessDeparturesOptions): void {
        // Process outbound departure if scheduled for current time
        if (options.currentTime === options.nextOutbound) {
            options.outboundDepartures.shift();
            const result = this.processDeparture({
                currentTime: options.currentTime,
                totalTimeSeconds: options.outboundTotalTimeSeconds,
                units: options.units,
                path: options.outboundPath,
                trips: options.trips,
                direction: UnitDirection.OUTBOUND
            });
            if (result.unitId) options.usedUnitsIds.add(result.unitId);
        }

        // Process inbound departure if scheduled for current time
        if (options.currentTime === options.nextInbound && options.inboundPath) {
            options.inboundDepartures.shift();
            const result = this.processDeparture({
                currentTime: options.currentTime,
                totalTimeSeconds: options.inboundTotalTimeSeconds,
                units: options.units,
                path: options.inboundPath,
                trips: options.trips,
                direction: UnitDirection.INBOUND
            });
            if (result.unitId) options.usedUnitsIds.add(result.unitId);
        }
    }

    /**
     * Generates trips when intervals are specified
     * Handles complex scheduling with dynamic unit assignments
     */
    protected generateTripsWithIntervals(options: GenerateTripsWithIntervalsOptions) {
        const trips: any[] = [];
        const usedUnitsIds = new Set<number>();

        // Check if we have a return trip
        const hasInboundPath = !!options.inboundPath;

        // Precise calculation of unit distribution
        let outboundUnits = options.units.length;
        let inboundUnits = 0;

        if (hasInboundPath) {
            // If we have a return trip, distribute units based on needs
            // More precise calculation based on the total number of units and the needs of each direction

            // Estimate the number of cycles during the period
            const periodDuration = options.endAtSecondsSinceMidnight - options.startAtSecondsSinceMidnight;

            // Estimated number of departures in each direction during the period
            const outboundDepartures = Math.ceil(periodDuration / options.outboundIntervalSeconds);
            const inboundDepartures = Math.ceil(periodDuration / options.inboundIntervalSeconds);

            // Calculate the distribution ratio based on the number of departures
            const totalDepartures = outboundDepartures + inboundDepartures;
            const outboundRatio = outboundDepartures / totalDepartures;
            const inboundRatio = inboundDepartures / totalDepartures;

            // Distribute units based on ratios, with a minimum of 1 unit per direction
            outboundUnits = Math.max(1, Math.floor(options.units.length * outboundRatio));
            inboundUnits = Math.max(1, options.units.length - outboundUnits);

            // Ensure at least one unit on each side
            if (outboundUnits === 0) outboundUnits = 1;
            if (inboundUnits === 0) inboundUnits = 1;

            // Adjust if necessary to respect the total number of units
            while (outboundUnits + inboundUnits > options.units.length) {
                if (outboundRatio <= inboundRatio && outboundUnits > 1) {
                    outboundUnits--;
                } else if (inboundUnits > 1) {
                    inboundUnits--;
                } else {
                    break;
                }
            }
        }

        // Initialize all units at the origin first
        this.initializeUnits({
            units: options.units,
            startFromDestination: false,
            startTime: options.startAtSecondsSinceMidnight
        });

        // Then manually distribute units for return trips
        if (hasInboundPath && inboundUnits > 0) {
            for (let i = options.units.length - inboundUnits; i < options.units.length; i++) {
                const unit = options.units[i];
                unit.currentLocation = UnitLocation.DESTINATION;
            }
        }

        // Generate precise departure schedules
        const { outboundDepartures, inboundDepartures } = this.generateDepartureSchedules({
            startTime: options.startAtSecondsSinceMidnight,
            endTime: options.endAtSecondsSinceMidnight,
            outboundIntervalSeconds: options.outboundIntervalSeconds,
            inboundIntervalSeconds: options.inboundIntervalSeconds,
            outboundTotalTimeSeconds: options.outboundTotalTimeSeconds,
            inboundTotalTimeSeconds: options.inboundTotalTimeSeconds,
            startFromDestination: false,
            hasInboundPath: hasInboundPath
        } as GenerateDepartureSchedulesOptions);

        // Process all departures chronologically
        while (outboundDepartures.length > 0 || inboundDepartures.length > 0) {
            const nextOutbound = outboundDepartures[0] || Infinity;
            const nextInbound = inboundDepartures[0] || Infinity;
            const currentTime = Math.min(nextOutbound, nextInbound);

            // Update unit availability
            this.updateAllUnitsAvailability(options.units, currentTime, options.inboundPath);

            // Process any departures scheduled for the current time
            this.processDepartures({
                currentTime,
                nextOutbound,
                nextInbound,
                units: options.units,
                outboundPath: options.outboundPath,
                inboundPath: options.inboundPath,
                outboundTotalTimeSeconds: options.outboundTotalTimeSeconds,
                inboundTotalTimeSeconds: options.inboundTotalTimeSeconds,
                trips,
                usedUnitsIds,
                outboundDepartures,
                inboundDepartures
            } as ProcessDeparturesOptions);
        }

        return {
            trips,
            realUnitCount: usedUnitsIds.size
        };
    }
    /**
     * Generates trips when a fixed number of units is specified
     * Uses a time-based approach to distribute trips across units
     */
    protected generateTripsWithFixedUnits(options: {
        startAtSecondsSinceMidnight: number;
        endAtSecondsSinceMidnight: number;
        outboundIntervalSeconds: number;
        outboundTotalTimeSeconds: number;
        inboundTotalTimeSeconds: number;
        units: TransitUnit[];
        outboundPath: TransitPath;
        inboundPath?: TransitPath;
    }) {
        const trips: any[] = [];
        const unitsCount = options.units.length;

        // Path and time segment extraction
        const outboundSegments = options.outboundPath.getAttributes().data.segments;
        const outboundNodes = options.outboundPath.getAttributes().nodes;
        const outboundDwellTimes = options.outboundPath.getData('dwellTimeSeconds');

        const inboundSegments = options.inboundPath ? options.inboundPath.getAttributes().data.segments : undefined;
        const inboundNodes = options.inboundPath ? options.inboundPath.getAttributes().nodes : undefined;
        const cycleTimeSeconds = options.outboundTotalTimeSeconds + options.inboundTotalTimeSeconds;

        // Initialize units with staggered start times
        for (let i = 0; i < unitsCount; i++) {
            const unit = options.units[i];
            unit.timeInCycle = Math.ceil((i * cycleTimeSeconds) / unitsCount);
        }

        // Trip generation loop
        for (
            let timeSoFar = options.startAtSecondsSinceMidnight;
            timeSoFar < options.endAtSecondsSinceMidnight;
            timeSoFar++
        ) {
            for (let i = 0; i < unitsCount; i++) {
                const unit = options.units[i];

                // Cycle reset logic
                if (unit.timeInCycle >= cycleTimeSeconds) {
                    if ((timeSoFar - options.startAtSecondsSinceMidnight) % options.outboundIntervalSeconds === 0) {
                        unit.timeInCycle = 0;
                    }
                }

                // Outbound trip generation
                if (unit.timeInCycle === 0) {
                    trips.push(
                        this.generateTrip({
                            tripStartAtSeconds: timeSoFar,
                            unit: unit,
                            path: options.outboundPath,
                            segments: outboundSegments || [],
                            nodes: outboundNodes,
                            dwellTimes: Array.isArray(outboundDwellTimes) ? outboundDwellTimes : []
                        })
                    );
                } else if (options.inboundPath && unit.timeInCycle === options.outboundTotalTimeSeconds) {
                    // Inbound trip generation
                    trips.push(
                        this.generateTrip({
                            tripStartAtSeconds: timeSoFar,
                            unit: unit,
                            path: options.inboundPath,
                            segments: inboundSegments || [],
                            nodes: inboundNodes as string[],
                            dwellTimes: Array.isArray(outboundDwellTimes) ? outboundDwellTimes : []
                        })
                    );
                }

                unit.timeInCycle++;
            }
        }

        return {
            trips,
            realUnitCount: options.units.length
        };
    }

    /**
     * Main method for generating trips, delegating to specific strategies
     */
    generateTrips(options: GenerateTripsOptions) {
        const { outboundIntervalSeconds, inboundIntervalSeconds } = options;

        // Check if intervals are specified
        if (outboundIntervalSeconds !== null && inboundIntervalSeconds !== null) {
            return this.generateTripsWithIntervals(options);
        } else {
            const {
                startAtSecondsSinceMidnight,
                endAtSecondsSinceMidnight,
                outboundIntervalSeconds,
                outboundTotalTimeSeconds,
                inboundTotalTimeSeconds,
                units,
                outboundPath,
                inboundPath
            } = options;

            // Fallback to fixed units strategy
            return this.generateTripsWithFixedUnits({
                startAtSecondsSinceMidnight,
                endAtSecondsSinceMidnight,
                outboundIntervalSeconds,
                outboundTotalTimeSeconds,
                inboundTotalTimeSeconds,
                units,
                outboundPath,
                inboundPath
            });
        }
    }
}

export class SymmetricScheduleStrategy extends BaseScheduleStrategy {
    calculateResourceRequirements(options: CalculateResourcesOptions) {
        const {
            period,
            startAtSecondsSinceMidnight,
            outboundTotalTimeSeconds,
            inboundTotalTimeSeconds,
            secondAllowed
        } = options;

        const cycleTimeSeconds = outboundTotalTimeSeconds + inboundTotalTimeSeconds;

        // TODO: add a way to ask the user if we need to return back to first stop when there is no inbound path.

        let tripsIntervalSeconds = -1;
        let tripsNumberOfUnits: number = 0;
        let tripsNumberOfUnitsFloat: number = 0;

        delete period.calculated_interval_seconds;
        delete period.calculated_number_of_units;

        if (_isNumber(period.interval_seconds)) {
            // ignore number of units if interval is set
            tripsIntervalSeconds = period.interval_seconds;
            tripsNumberOfUnitsFloat = cycleTimeSeconds / period.interval_seconds;
            tripsNumberOfUnits = Math.ceil(cycleTimeSeconds / period.interval_seconds);
            period.calculated_interval_seconds = tripsIntervalSeconds;
            period.calculated_number_of_units = tripsNumberOfUnitsFloat;
        } else if (_isNumber(period.number_of_units)) {
            tripsIntervalSeconds = Math.ceil(cycleTimeSeconds / period.number_of_units);
            tripsIntervalSeconds =
                secondAllowed === true ? tripsIntervalSeconds : Math.ceil(tripsIntervalSeconds / 60) * 60;
            tripsNumberOfUnits = period.number_of_units;
            period.calculated_interval_seconds = tripsIntervalSeconds;
            period.calculated_number_of_units = period.number_of_units;
        }

        const units: TransitUnit[] = Array.from({ length: tripsNumberOfUnits }, (_, i) => ({
            id: i + 1,
            totalCapacity: SCHEDULE_DEFAULTS.DEFAULT_TOTAL_CAPACITY,
            seatedCapacity: SCHEDULE_DEFAULTS.DEFAULT_SEATED_CAPACITY,
            currentLocation: UnitLocation.ORIGIN,
            expectedArrivalTime: startAtSecondsSinceMidnight,
            expectedReturnTime: null,
            direction: null,
            lastTripEndTime: null,
            timeInCycle: 0
        }));

        return {
            units,
            outboundIntervalSeconds: tripsIntervalSeconds,
            inboundIntervalSeconds: 0 // symetric mode doesnt use a inbound interval
        };
    }

    generateTrips(options: GenerateTripsOptions) {
        const {
            startAtSecondsSinceMidnight,
            endAtSecondsSinceMidnight,
            outboundIntervalSeconds,
            outboundTotalTimeSeconds,
            inboundTotalTimeSeconds,
            units,
            outboundPath,
            inboundPath
        } = options;

        const outboundSegments = outboundPath.getAttributes().data.segments;
        const outboundNodes = outboundPath.getAttributes().nodes;
        const outboundDwellTimes = outboundPath.getData('dwellTimeSeconds');

        const inboundSegments = inboundPath ? inboundPath.getAttributes().data.segments : undefined;
        const inboundNodes = inboundPath ? inboundPath.getAttributes().nodes : undefined;
        const inboundDwellTimes = inboundPath ? inboundPath.getAttributes().data.dwellTimeSeconds : undefined;

        const trips: any[] = [];
        const unitsCount = units.length;
        const cycleTimeSeconds = outboundTotalTimeSeconds + inboundTotalTimeSeconds;

        for (let i = 0; i < unitsCount; i++) {
            const unit = units[i];
            unit.timeInCycle = Math.ceil((i * cycleTimeSeconds) / unitsCount);
        }

        for (let timeSoFar = startAtSecondsSinceMidnight; timeSoFar < endAtSecondsSinceMidnight; timeSoFar++) {
            // Handle the current time
            for (let i = 0; i < unitsCount; i++) {
                // Verify if unit cycle needs to be reinitialized

                const unit = units[i];

                if (unit.timeInCycle >= cycleTimeSeconds) {
                    if ((timeSoFar - startAtSecondsSinceMidnight) % outboundIntervalSeconds === 0) {
                        unit.timeInCycle = 0;
                    }
                }

                // Handle current unit
                if (unit.timeInCycle === 0) {
                    trips.push(
                        this.generateTrip({
                            tripStartAtSeconds: timeSoFar,
                            unit: unit,
                            path: outboundPath,
                            segments: outboundSegments || [],
                            nodes: outboundNodes,
                            dwellTimes: Array.isArray(outboundDwellTimes) ? outboundDwellTimes : []
                        })
                    );
                } else if (inboundPath && unit.timeInCycle === outboundTotalTimeSeconds) {
                    // FIXME The number of units is not necessarily a rounded number, so there may be more frequent return trips at the beginning of the period until it stabilizes
                    trips.push(
                        this.generateTrip({
                            tripStartAtSeconds: timeSoFar,
                            unit: unit,
                            path: inboundPath,
                            segments: inboundSegments || [],
                            nodes: inboundNodes as string[],
                            dwellTimes: Array.isArray(inboundDwellTimes) ? inboundDwellTimes : []
                        })
                    );
                }
                unit.timeInCycle++;
            }
        }

        return {
            trips,
            realUnitCount: options.period.calculated_number_of_units
        };
    }
}

class Schedule extends ObjectWithHistory<ScheduleAttributes> implements Saveable {
    protected static displayName = 'Schedule';
    private _collectionManager: CollectionManager;

    constructor(attributes = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew);
        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    protected _prepareAttributes(attributes: Partial<ScheduleAttributes>) {
        if (_isBlank(attributes.allow_seconds_based_schedules)) {
            attributes.allow_seconds_based_schedules = false;
        }
        if (!attributes.periods) {
            attributes.periods = [];
        }
        return super._prepareAttributes(attributes);
    }

    static symbol() {
        return 'O';
    }

    validate() {
        super.validate();
        this.errors = [];
        if (!this.getAttributes().service_id) {
            this._isValid = false;
            this.errors.push('transit:transitSchedule:errors:ServiceIsRequired');
        }
        if (!this.getAttributes().periods_group_shortname) {
            this._isValid = false;
            this.errors.push('transit:transitSchedule:errors:PeriodsGroupIsRequired');
        }
        const periods = this.getAttributes().periods;
        for (let i = 0, count = periods.length; i < count; i++) {
            const period = periods[i];
            if (period.interval_seconds && period.number_of_units) {
                this._isValid = false;
                this.errors.push('transit:transitSchedule:errors:ChooseIntervalOrNumberOfUnits');
                break;
            }
        }
        return this._isValid;
    }

    getClonedAttributes(deleteSpecifics = true): Partial<ScheduleAttributes> {
        const clonedAttributes = super.getClonedAttributes(deleteSpecifics);
        if (deleteSpecifics) {
            delete clonedAttributes.integer_id;
            const periods = clonedAttributes.periods;
            if (periods) {
                for (let i = 0; i < periods.length; i++) {
                    const period = periods[i] as Partial<SchedulePeriod>;
                    delete period.id;
                    delete period.integer_id;
                    delete period.schedule_id;
                    delete period.created_at;
                    delete period.updated_at;
                    const trips = period.trips;
                    if (trips) {
                        for (let j = 0; j < trips.length; j++) {
                            const trip = trips[j] as Partial<SchedulePeriodTrip>;
                            delete trip.id;
                            delete trip.integer_id;
                            delete trip.schedule_period_id;
                            delete trip.created_at;
                            delete trip.updated_at;
                        }
                    }
                }
            }
        }
        return clonedAttributes;
    }

    getRequiredFleetForPeriod(periodShortname: string) {
        // todo
        const period = this.getPeriod(periodShortname);
        if (period) {
            const trips = period.trips;
            if (trips && trips.length > 0) {
                for (let i = 0, count = trips.length; i < count - 1; i++) {
                    const trip = trips[i];
                    const nextTrip = trips[i + 1];
                    if (trip && nextTrip) {
                        //const path =
                        //const deadHeadTravelTimeBetweenTrips = await
                        //const intervalSeconds = nextTrip.
                    }
                }
            }
        } else {
            return null;
        }
    }
    getAssociatedPathIds(): string[] {
        const associatedPathIds: { [pathId: string]: boolean } = {};

        const periods = this.getAttributes().periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            const period = periods[i];
            period.trips.forEach((trip) => (associatedPathIds[trip.path_id] = true));
        }

        return Object.keys(associatedPathIds);
    }

    getPeriod(periodShortname: string) {
        const periods = this.getAttributes().periods;
        const index = Schedule.getPeriodIndex(periodShortname, periods);
        return index === null ? null : periods[index];
    }

    static getPeriodIndex(periodShortname: string, periods: any[]): number | null {
        for (let i = 0, countI = periods.length; i < countI; i++) {
            if (periods[i].shortname === periodShortname || periods[i].period_shortname === periodShortname) {
                return i;
            }
        }
        return null;
    }

    // TODO Type the directions somewhere
    private getNextAvailableUnit(units: any[], direction: any, timeSeconds: number, numberOfUnits?: number) {
        if (numberOfUnits === undefined) {
            numberOfUnits = units.length;
        }
        for (let i = 0; i < numberOfUnits; i++) {
            const unit = units[i];
            if (
                (unit.isReadyDirection === direction || unit.isReadyDirection === null) &&
                unit.isReadyAtTimeSeconds <= timeSeconds
            ) {
                unit.isReadyDirection = direction;
                return unit;
            }
        }
        return null;
    }
    static getPeriodsGroupsChoices(periodsGroups, language) {
        const periodsGroupChoices: any[] = [];
        for (const periodsGroupShortname in periodsGroups) {
            const periodsGroup = periodsGroups[periodsGroupShortname];
            if (periodsGroup) {
                periodsGroupChoices.push({
                    value: periodsGroupShortname,
                    label: periodsGroup.name[language] || periodsGroupShortname
                });
            }
        }
        return periodsGroupChoices;
    }

    static getPeriodsChoices(periods, language) {
        const periodsChoices: any[] = [];
        if (periods && periods.length > 0) {
            periods.forEach((period) => {
                periodsChoices.push({
                    value: period.shortname,
                    label: period.name[language]
                });
            });
        }
        return periodsChoices;
    }

    tripsCount() {
        let tripsCount = 0;
        const periods = this.attributes.periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            if (periods[i].trips) {
                tripsCount += periods[i].trips.length;
            }
        }
        return tripsCount;
    }

    private generateForPeriodFunction(periodShortname: string): Status.Status<SchedulePeriodTrip[]> {
        const period = this.getPeriod(periodShortname);

        if (!period) {
            return Status.createError(`Period ${periodShortname} does not exist`);
        }

        // Get schedule generating mode
        const calculationMode = this.getAttributes().calculation_mode || ScheduleCalculationMode.BASIC;

        if (!this._collectionManager.get('lines') || !this._collectionManager.get('paths')) {
            return Status.createError('missing lines and/or paths collections');
        }

        if (
            _isBlank(period.interval_seconds) &&
            _isBlank(period.inbound_interval_seconds) &&
            _isBlank(period.number_of_units)
        ) {
            return Status.createError('missing intervals or number of units');
        }
        //const line = this._collectionManager.get('lines').getById(this.get('line_id'));

        // get the paths
        const outboundPathId = period.outbound_path_id;
        if (_isBlank(outboundPathId)) {
            return Status.createError('missing outbound path id');
        }

        const outboundPath = new TransitPath(
            this._collectionManager.get('paths').getById(outboundPathId as string).properties,
            false,
            this._collectionManager
        );

        const inboundPathId = period.inbound_path_id;
        const inboundPath = !_isBlank(inboundPathId)
            ? new TransitPath(
                this._collectionManager.get('paths').getById(inboundPathId as string).properties,
                false,
                this._collectionManager
            )
            : undefined;

        // Calculating start and end hours
        const customStartAtStr = period.custom_start_at_str;
        const startAtSecondsSinceMidnight = customStartAtStr
            ? (timeStrToSecondsSinceMidnight(customStartAtStr) as number)
            : period.start_at_hour * 3600;

        const customEndAtStr = period.custom_end_at_str;
        const endAtSecondsSinceMidnight = customEndAtStr
            ? (timeStrToSecondsSinceMidnight(customEndAtStr) as number)
            : period.end_at_hour * 3600;

        // get outbound/inbound paths info to calculate number of units required or minimum interval and travel times:

        // calculate durations
        const outboundTotalTimeSeconds = outboundPath.getAttributes().data.operatingTimeWithLayoverTimeSeconds || 0;
        const inboundTotalTimeSeconds = inboundPath
            ? inboundPath.getAttributes().data.operatingTimeWithLayoverTimeSeconds || 0
            : 0;

        // Create the generation strategy
        const strategy = ScheduleStrategyFactory.createStrategy(calculationMode);

        const secondAllowed = this.get('allow_seconds_based_schedules') === true;
        const { units, outboundIntervalSeconds, inboundIntervalSeconds } = strategy.calculateResourceRequirements({
            period,
            startAtSecondsSinceMidnight,
            endAtSecondsSinceMidnight,
            outboundTotalTimeSeconds,
            inboundTotalTimeSeconds,
            secondAllowed
        });

        // Generate trips according to the strategy
        const result = strategy.generateTrips({
            startAtSecondsSinceMidnight,
            endAtSecondsSinceMidnight,
            outboundIntervalSeconds,
            inboundIntervalSeconds,
            outboundTotalTimeSeconds,
            inboundTotalTimeSeconds,
            units,
            outboundPath,
            inboundPath,
            period
        } as GenerateTripsOptions);

        // Update period attributes
        period.trips = result.trips;
        period.calculated_number_of_units = result.realUnitCount;

        return Status.createOk(result.trips);
    }
    updateForAllPeriods() {
        // re-generate (after modifying path by instance)
        const periods = this.attributes.periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            // TODO period_shortname can be undefined, fix typing to avoid this or add check
            this.generateForPeriodFunction(periods[i].period_shortname as string);
        }
    }

    //TODO update test . (probably it's better to test generateForPeriodfunction instead. if the other test works, this one probably works too)
    generateForPeriod(periodShortname: string): { trips: SchedulePeriodTrip[] } {
        const resultStatus = this.generateForPeriodFunction(periodShortname);
        return { trips: Status.isStatusOk(resultStatus) ? Status.unwrap(resultStatus) : [] };
    }

    async delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        return SaveUtils.delete(this, socket, 'transitSchedule', undefined);
    }

    async save(socket) {
        return SaveUtils.save(this, socket, 'transitSchedule', undefined);
    }

    static getPluralName() {
        return 'schedules';
    }

    static getCapitalizedPluralName() {
        return 'Schedules';
    }

    static getDisplayName() {
        return Schedule.displayName;
    }
}

export default Schedule;
