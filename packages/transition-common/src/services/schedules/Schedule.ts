/*
 * Copyright 2022, Polytechnique Montreal and contributors
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

export interface SchedulePeriodTrip extends GenericAttributes {
    schedule_id: string;
    schedule_period_id: string;
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
    schedule_id: string;
    outbound_path_id?: string;
    inbound_path_id?: string;
    period_shortname?: string;
    interval_seconds?: number;
    number_of_units?: number;
    calculated_interval_seconds?: number;
    calculated_number_of_units?: number;
    start_at_hour: number;
    end_at_hour: number;
    custom_start_at_str?: string;
    custom_end_at_str?: string;
    trips: SchedulePeriodTrip[];
}

export interface ScheduleAttributes extends GenericAttributes {
    line_id: string;
    service_id: string;
    periods_group_shortname?: string;
    allow_seconds_based_schedules?: boolean;
    // TODO Create classes for periods and trips
    periods: SchedulePeriod[];
}

class Schedule extends ObjectWithHistory<ScheduleAttributes> implements Saveable {
    protected static displayName = 'Schedule';
    private _collectionManager: any;

    constructor(attributes = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew);
        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    _prepareAttributes(attributes: Partial<ScheduleAttributes>) {
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
            const periods = clonedAttributes.periods;
            if (periods) {
                for (let i = 0; i < periods.length; i++) {
                    const period = periods[i] as Partial<SchedulePeriod>;
                    delete period.id;
                    delete period.schedule_id;
                    delete period.created_at;
                    delete period.updated_at;
                    const trips = period.trips;
                    if (trips) {
                        for (let j = 0; j < trips.length; j++) {
                            const trip = trips[j] as Partial<SchedulePeriodTrip>;
                            delete trip.id;
                            delete trip.schedule_id;
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

    async getRequiredFleetForPeriod(periodShortname) {
        // todo
        const period = this.getPeriod(periodShortname);
        if (period) {
            const minInterval = Infinity;
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

    getAssociatedPathIds() {
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
    getNextAvailableUnit(units: any[], direction: any, timeSeconds: number, numberOfUnits?: number) {
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

    generateTrips(
        startAtSecondsSinceMidnight,
        endAtSecondsSinceMidnight,
        intervalSeconds: number,
        outboundTotalTimeSeconds: number,
        inboundTotalTimeSeconds: number,
        units: any[],
        outboundPath: TransitPath,
        inboundPath?: TransitPath
    ) {
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

        let timeSoFar = startAtSecondsSinceMidnight;

        while (timeSoFar < endAtSecondsSinceMidnight) {
            for (let i = 0; i < unitsCount; i++) {
                const unit = units[i];
                if (unit.timeInCycle === 0) {
                    trips.push(
                        this.generateTrip(
                            timeSoFar,
                            'outbound',
                            unit,
                            outboundPath,
                            outboundSegments,
                            outboundNodes,
                            outboundDwellTimes
                        )
                    );
                } else if (inboundPath && unit.timeInCycle === outboundTotalTimeSeconds) {
                    trips.push(
                        this.generateTrip(
                            timeSoFar,
                            'inbound',
                            unit,
                            inboundPath,
                            inboundSegments,
                            inboundNodes,
                            inboundDwellTimes
                        )
                    );
                }
                unit.timeInCycle++;
                if (unit.timeInCycle >= cycleTimeSeconds) {
                    if ((timeSoFar - startAtSecondsSinceMidnight) % intervalSeconds === 0) {
                        unit.timeInCycle = 0;
                    }
                }
            }
            timeSoFar++;
        }

        //console.log(trips);
        return trips;
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

    generateTrip(tripStartAtSeconds, direction, unit, path, segments, nodes, dwellTimes, blockId = null) {
        try {
            const tripArrivalTimesSeconds: (number | null)[] = [];
            const tripDepartureTimesSeconds: (number | null)[] = [];
            const canBoards: boolean[] = [];
            const canUnboards: boolean[] = [];
            const nodesCount = nodes.length;
            let tripTimeSoFar = tripStartAtSeconds;
            for (let i = 0; i < nodesCount; i++) {
                const segment = segments[i];
                const dwellTimeSeconds = dwellTimes[i];
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
                unitDirection: unit.isReadyDirection,
                unitReadyAt: unit.isReadyAtTimeSeconds
            };
            return trip;
        } catch (error) {
            throw `The path ${path.getId()} for line ${path.getLine().getAttributes().shortname} (${path
                .getLine()
                .getId()}) is not valid. Please recalculate routing for this path`;
        }
    }

    private generateForPeriodFunction(
        periodShortname: string
    ): { status: 'success'; trips: SchedulePeriodTrip[] } | { status: 'failed'; error: string } {
        const period = this.getPeriod(periodShortname);
        if (!period) {
            return {
                status: 'failed',
                error: `Period ${periodShortname} does not exist`
            };
        }
        const intervalSeconds = period.interval_seconds;
        const numberOfUnits = period.number_of_units;
        if (!this._collectionManager.get('lines') || !this._collectionManager.get('paths')) {
            console.log('missing lines and/or paths collections');
            return {
                status: 'failed',
                error: 'missing lines and/or paths collections'
            };
        }
        if (_isBlank(intervalSeconds) && _isBlank(numberOfUnits)) {
            console.log('missing interval or number of units');
            return {
                status: 'failed',
                error: 'missing interval or number of units'
            };
        }
        //const line                              = this._collectionManager.get('lines').getById(this.get('line_id'));
        const outboundPathId = period.outbound_path_id;
        if (_isBlank(outboundPathId)) {
            console.log('missing outbound path id');
            return {
                status: 'failed',
                error: 'missing outbound path id'
            };
        }
        const outboundPath = new TransitPath(
            this._collectionManager.get('paths').getById(outboundPathId).properties,
            false,
            this._collectionManager
        );
        const inboundPathId = period.inbound_path_id;
        const inboundPath = !_isBlank(inboundPathId)
            ? new TransitPath(
                this._collectionManager.get('paths').getById(inboundPathId).properties,
                false,
                this._collectionManager
            )
            : undefined;
        const customStartAtStr = period.custom_start_at_str;
        const startAtSecondsSinceMidnight = customStartAtStr
            ? timeStrToSecondsSinceMidnight(customStartAtStr)
            : period.start_at_hour * 3600;
        const customEndAtStr = period.custom_end_at_str;
        const endAtSecondsSinceMidnight = customEndAtStr
            ? timeStrToSecondsSinceMidnight(customEndAtStr)
            : period.end_at_hour * 3600;

        // get outbound/inbound paths info to calculate number of units required or minimum interval and travel times:
        const outboundHalfCycleTimeSeconds = outboundPath.getAttributes().data.operatingTimeWithLayoverTimeSeconds || 0;
        const inboundHalfCycleTimeSeconds = inboundPath
            ? inboundPath.getAttributes().data.operatingTimeWithLayoverTimeSeconds || 0
            : 0;
        const cycleTimeSeconds = outboundHalfCycleTimeSeconds + inboundHalfCycleTimeSeconds;

        // TODO: add a way to ask the user if we need to return back to first stop when there is no inbound path.

        let tripsIntervalSeconds = -1;
        let tripsNumberOfUnits: number | null = null;
        let tripsNumberOfUnitsFloat: number | null = null;

        delete period.calculated_interval_seconds;
        delete period.calculated_number_of_units;

        if (_isNumber(intervalSeconds)) {
            // ignore number of units if interval is set
            tripsIntervalSeconds = intervalSeconds;
            tripsNumberOfUnitsFloat = cycleTimeSeconds / intervalSeconds;
            tripsNumberOfUnits = Math.ceil(cycleTimeSeconds / intervalSeconds);
            period.calculated_interval_seconds = tripsIntervalSeconds;
            period.calculated_number_of_units = tripsNumberOfUnitsFloat;
        } else if (_isNumber(numberOfUnits)) {
            tripsIntervalSeconds = Math.ceil(cycleTimeSeconds / numberOfUnits);
            tripsIntervalSeconds =
                this.get('allow_seconds_based_schedules') === true
                    ? tripsIntervalSeconds
                    : Math.ceil(tripsIntervalSeconds / 60) * 60;
            tripsNumberOfUnits = numberOfUnits;
            period.calculated_interval_seconds = tripsIntervalSeconds;
            period.calculated_number_of_units = numberOfUnits;
        }

        if (tripsNumberOfUnits === null) {
            return { status: 'success', trips: [] };
        }

        const units: any[] = [];
        for (let i = 0; i < tripsNumberOfUnits; i++) {
            const unit = {
                // unit proxy until we create unit class
                // TODO When we have units, set this to a uuid
                // id: i + 1,
                totalCapacity: 50,
                seatedCapacity: 20
            };
            units.push(unit);
        }

        /*console.log('tripsIntervalSeconds', tripsIntervalSeconds);
        console.log('tripsNumberOfUnits', tripsNumberOfUnits);
        console.log('outboundTotalTimeSeconds', outboundTotalTimeSeconds/60);
        console.log('inboundTotalTimeSeconds', inboundTotalTimeSeconds/60);
        console.log('cycleTimeSeconds', cycleTimeSeconds/60);*/

        const trips = this.generateTrips(
            startAtSecondsSinceMidnight,
            endAtSecondsSinceMidnight,
            tripsIntervalSeconds,
            outboundHalfCycleTimeSeconds,
            inboundHalfCycleTimeSeconds,
            units,
            outboundPath,
            inboundPath
        );
        period.trips = trips;

        return { status: 'success', trips };
    }

    updateForAllPeriods() {
        // re-generate (after modifying path by instance)
        const periods = this.attributes.periods;
        for (let i = 0, countI = periods.length; i < countI; i++) {
            // TODO period_shortname can be undefined, fix typing to avoid this or add check
            this.generateForPeriodFunction(periods[i].period_shortname as string);
        }
    }

    async generateForPeriod(periodShortname: string): Promise<{ trips: SchedulePeriodTrip[] }> {
        const trips = this.generateForPeriodFunction(periodShortname);
        return { trips: trips.status === 'success' ? trips.trips : [] };
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
