/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as GtfsTypes from 'gtfs-types';
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import pQueue from 'p-queue';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { hoursToSeconds, secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { GtfsInternalData, StopTime, Frequencies, Period } from './GtfsImportTypes';
import Schedule, { SchedulePeriod } from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';
import linesDbQueries from '../../models/db/transitLines.db.queries';
import scheduleDbQueries from '../../models/db/transitSchedules.db.queries';
import { objectToCache as lineObjectToCache } from '../../models/capnpCache/transitLines.cache.queries';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';

type TripAndStopTimes = { trip: GtfsTypes.Trip; stopTimes: StopTime[] };

const getNextStopTimes = (
    previousTripStart: number,
    stopTimes: StopTime[],
    frequency: Frequencies
): StopTime[] | undefined => {
    const firstStopTimeDeparture = stopTimes[0].departureTimeSeconds;
    // Offset to start time if the previous trip is not for current frequency, otherwise, apply headway
    const offsetToApply =
        previousTripStart < frequency.startTimeSeconds
            ? frequency.startTimeSeconds - firstStopTimeDeparture
            : previousTripStart + frequency.headway_secs - firstStopTimeDeparture;
    // Frequency end time is not included in the current frequency count, as it changes frequency at that point
    if (stopTimes[0].departureTimeSeconds + offsetToApply >= frequency.endTimeSeconds) {
        // Stop times for this frequency is finished
        return undefined;
    }
    const nextStopTimes = _cloneDeep(stopTimes);
    nextStopTimes.forEach((stopTime) => {
        stopTime.arrivalTimeSeconds = stopTime.arrivalTimeSeconds + offsetToApply;
        stopTime.arrival_time = secondsSinceMidnightToTimeStr(stopTime.arrivalTimeSeconds);
        stopTime.departureTimeSeconds = stopTime.departureTimeSeconds + offsetToApply;
        stopTime.departure_time = secondsSinceMidnightToTimeStr(stopTime.departureTimeSeconds);
    });
    return nextStopTimes;
};

const sortLineTrips = (tripsForLine: { [key: string]: TripAndStopTimes[] }) => {
    Object.keys(tripsForLine).forEach((line) => {
        tripsForLine[line].sort(
            (elementA, elementB) => elementA.stopTimes[0].arrivalTimeSeconds - elementB.stopTimes[0].arrivalTimeSeconds
        );
    });
    return tripsForLine;
};

/**
 * Prepare the trips data and group them by line.
 *
 * @param {GtfsInternalData} importData The imported data
 * @return {*}  {{ [key: string]: { trip: GtfsTypes.Trip; stopTimes:
 * StopTime[]}[] }} A map of trips, where the key is the GTFS route ID and the
 * value is an ordered array of objects including the trip and stop times.
 */
const prepareTripData = (importData: GtfsInternalData): { [key: string]: TripAndStopTimes[] } => {
    const trips = importData.tripsToImport;
    const tripDataByGtfsLineId = {};
    const stopTimesByTripId = importData.stopTimesByTripId;
    const frequenciesByTripId = importData.frequenciesByTripId;

    for (let i = 0; i < trips.length; i++) {
        const trip = trips[i];
        let stopTimes = stopTimesByTripId[trip.trip_id];
        if (!stopTimes || stopTimes.length === 0) {
            // This trip has no stop times, it won't be imported
            console.log(`GTFS import: trip ${trip.trip_id} has no stop times. It won't be imported.`);
            continue;
        }
        const tripsForLine = tripDataByGtfsLineId[trip.route_id] || [];
        tripDataByGtfsLineId[trip.route_id] = tripsForLine;

        const frequencies = frequenciesByTripId[trip.trip_id];
        if (frequencies === undefined) {
            // No frequencies, just add this trip with stop times
            tripsForLine.push({ trip, stopTimes });
            continue;
        }

        // If a trip has frequencies, the stop times should be copied at that frequency rate to create a new trip
        for (let j = 0; j < frequencies.length; j++) {
            const frequency = frequencies[j];
            let nextStopTimes = getNextStopTimes(0, stopTimes, frequency);
            while (nextStopTimes) {
                tripsForLine.push({ trip, stopTimes: nextStopTimes });
                stopTimes = nextStopTimes;
                nextStopTimes = getNextStopTimes(stopTimes[0].departureTimeSeconds, stopTimes, frequency);
            }
        }
    }
    return sortLineTrips(tripDataByGtfsLineId);
};

const generateAndImportSchedules = async (
    tripByGtfsLineId: { [key: string]: TripAndStopTimes[] },
    importData: GtfsInternalData,
    collectionManager: CollectionManager,
    generateFrequencyBasedSchedules = false
): Promise<{ status: 'success'; warnings: ErrorMessage[] } | { status: 'failed'; errors: ErrorMessage[] }> => {
    const warnings: string[] = [];

    const gtfsLineIds = Object.keys(tripByGtfsLineId);
    const promiseQueue = new pQueue({ concurrency: 1 });

    const schedulesForLine = gtfsLineIds.map(async (gtfsLineId) => {
        const lineId = importData.lineIdsByRouteGtfsId[gtfsLineId];
        const line = collectionManager.get('lines').getById(lineId) as Line;
        if (!line) {
            throw `GTFS schedule import: No line imported for gtfs route ${gtfsLineId}`;
        }
        await promiseQueue.add(async () => {
            try {
                console.log(`generating schedules for route id ${gtfsLineId}`);
                const newSchedules = await generateSchedulesForLine(
                    line,
                    tripByGtfsLineId[gtfsLineId],
                    importData,
                    generateFrequencyBasedSchedules,
                    collectionManager
                );
                // save line and its schedules to cache file:
                // FIXME: Remove this step? Line is not supposed to be modified
                await linesDbQueries.update(line.getId(), line.attributes, { returning: 'id' });
                // Save schedules for line
                const saveSchedPromises = newSchedules.map((schedule) => {
                    scheduleDbQueries.create(schedule.attributes);
                });
                await Promise.all(saveSchedPromises);
                await lineObjectToCache(line);
            } catch (err) {
                console.error('Error importing line', err);
                warnings.push(String(err));
                if (warnings.length >= 15) {
                    // TODO Stop the queue and exit
                    promiseQueue.clear();
                    warnings.push('transit:gtfs:errors:TooManyErrorsImportingSchedules');
                    console.error('Too many errors importing schedules, aborting.');
                    throw { errors: warnings };
                }
            }
        });
    });

    await Promise.allSettled(schedulesForLine);

    return { status: 'success', warnings: warnings };
};

const findPeriodShortname = (periods: Period[], timeSecondsSinceMidnight: number) => {
    for (let i = 0, count = periods.length; i < count; i++) {
        const period = periods[i];
        if (
            timeSecondsSinceMidnight >= period.startAtHour * 3600 &&
            timeSecondsSinceMidnight < period.endAtHour * 3600
        ) {
            return period.shortname;
        }
    }
    if (timeSecondsSinceMidnight >= periods[periods.length - 1].endAtHour) {
        // assign to last period if outside range
        return periods[periods.length - 1].shortname;
    }
    return null;
};

const isTripValid = (stopTimes: StopTime[]) => {
    // verify that all stop times for this trip are sequential
    // (ignore trips with erroneous or reversed times)
    let previousArrivalTimeSeconds = 0;
    let previousDepartureTimeSeconds = 0;
    for (let stopTimeI = 0, countStopTimes = stopTimes.length; stopTimeI < countStopTimes; stopTimeI++) {
        const stopTime = stopTimes[stopTimeI];
        const arrivalTimeSeconds = stopTime.arrivalTimeSeconds;
        const departureTimeSeconds = stopTime.departureTimeSeconds;
        if (
            arrivalTimeSeconds > departureTimeSeconds ||
            departureTimeSeconds < previousArrivalTimeSeconds ||
            departureTimeSeconds < previousDepartureTimeSeconds
        ) {
            return false;
        }
        previousArrivalTimeSeconds = arrivalTimeSeconds;
        previousDepartureTimeSeconds = departureTimeSeconds;
    }
    return true;
};

/**
 * Create a new, empty, schedule for the line, with all periods initialized
 *
 * @param line The line for which to create the schedule
 * @param serviceId The ID of the service
 * @param importData The import parameters
 * @param periods The array of periods this schedule will contain
 * @returns
 */
const createSchedule = (
    line: Line,
    serviceId: string,
    importData: GtfsInternalData,
    periods: Period[],
    collectionManager: CollectionManager
) => {
    const schedule = new Schedule(
        {
            allow_seconds_based_schedules: true,
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [],
            service_id: serviceId,
            line_id: line.getId()
        },
        true,
        collectionManager
    );

    for (let j = 0, countJ = periods.length; j < countJ; j++) {
        const period = periods[j];
        const periodSchedule = {
            id: uuidV4(),
            schedule_id: schedule.getId(),
            start_at_hour: period.startAtHour,
            end_at_hour: period.endAtHour,
            period_shortname: period.shortname,
            trips: [],
            data: {}
        };
        schedule.getAttributes().periods.push(periodSchedule);
    }
    return schedule;
};

/**
 * For the line, group the trips to import by service and periods
 * @param line The line, with any existing schedules
 * @param tripsWithStopTimes The trips with stop times in the GTFS
 * @param importData The import data
 */
const groupSchedulesAndTripsToImport = (
    line: Line,
    tripsWithStopTimes: TripAndStopTimes[],
    importData: GtfsInternalData,
    collectionManager: CollectionManager
): { schedule: Schedule; periods: TripAndStopTimes[][] }[] => {
    const ignoreExisting = importData.doNotUpdateAgencies.includes(line.attributes.agency_id);
    const existingSchedules = line.getSchedules();
    const scheduleByServiceId: {
        [key: string]: { schedule: Schedule; periods: TripAndStopTimes[][] };
    } = {};
    const periods = importData.periodsGroup.periods;
    const periodShortnameByIndex = {};

    for (let periodIdx = 0; periodIdx < periods.length; periodIdx++) {
        const period = periods[periodIdx];
        periodShortnameByIndex[period.shortname] = periodIdx;
    }
    if (!tripsWithStopTimes || tripsWithStopTimes.length === 0) {
        return [];
    }

    for (let tripIdx = 0; tripIdx < tripsWithStopTimes.length; tripIdx++) {
        const { trip, stopTimes } = tripsWithStopTimes[tripIdx];

        if (trip && stopTimes && stopTimes.length > 0) {
            const serviceId = importData.serviceIdsByGtfsId[trip.service_id];
            const pathId = importData.pathIdsByTripId[trip.trip_id];

            // Ignore trip is invalid, no path, or the service already exists for this line and should not be updated
            if (!isTripValid(stopTimes) || !pathId || (existingSchedules[serviceId] !== undefined && ignoreExisting)) {
                continue;
            }
            const scheduleAndTrips = scheduleByServiceId[serviceId];
            const schedule =
                scheduleAndTrips !== undefined
                    ? scheduleAndTrips.schedule
                    : createSchedule(line, serviceId, importData, periods, collectionManager);
            const schedulePeriods =
                scheduleAndTrips !== undefined
                    ? scheduleAndTrips.periods
                    : Array.from({ length: periods.length }, () => []);

            // generate new trip for schedule/service id:
            const tripDepartureTimeSeconds = stopTimes[0].departureTimeSeconds;
            const periodShortname = findPeriodShortname(importData.periodsGroup.periods, tripDepartureTimeSeconds);
            if (periodShortname === null) {
                console.log(
                    `GTFS Schedule import: Cannot find period for stopTime with departure time of ${tripDepartureTimeSeconds}`
                );
                continue;
            }
            const periodIndex = periodShortnameByIndex[periodShortname];
            schedulePeriods[periodIndex].push({ trip, stopTimes });

            scheduleByServiceId[serviceId] = { schedule, periods: schedulePeriods };
        }
    }
    return Object.values(scheduleByServiceId);
};

const generateExactTrips = (schedule: Schedule, periods: TripAndStopTimes[][], importData: GtfsInternalData) => {
    // Generate the schedule for each period
    for (let periodIndex = 0; periodIndex < periods.length; periodIndex++) {
        const trips = periods[periodIndex];
        trips.forEach(({ trip, stopTimes }) => {
            const pathId = importData.pathIdsByTripId[trip.trip_id];
            // generate new trip for schedule/service id:
            const tripDepartureTimeSeconds = stopTimes[0].departureTimeSeconds;
            const tripArrivalTimeSeconds = stopTimes[stopTimes.length - 1].arrivalTimeSeconds;
            const tripArrivalTimesSeconds: number[] = [];
            const tripDepartureTimesSeconds: number[] = [];
            const canBoards: boolean[] = [];
            const canUnboards: boolean[] = [];

            for (let j = 0, countJ = stopTimes.length; j < countJ; j++) {
                const stopTime = stopTimes[j];
                tripArrivalTimesSeconds.push(stopTime.arrivalTimeSeconds);
                tripDepartureTimesSeconds.push(stopTime.departureTimeSeconds);
                canBoards.push(j === countJ - 1 ? false : stopTime.pickup_type !== 1);
                canUnboards.push(j === 0 ? false : stopTime.drop_off_type !== 1);
            }

            const newTrip = {
                id: uuidV4(),
                schedule_id: schedule.getId(),
                schedule_period_id: schedule.getAttributes().periods[periodIndex].id,
                path_id: pathId,
                departure_time_seconds: tripDepartureTimeSeconds,
                arrival_time_seconds: tripArrivalTimeSeconds,
                node_arrival_times_seconds: tripArrivalTimesSeconds,
                node_departure_times_seconds: tripDepartureTimesSeconds,
                nodes_can_board: canBoards,
                nodes_can_unboard: canUnboards,
                data: {}
                // TODO: We ignore the block_id during import, so we set it to null here. When we do something with the block,
            };

            (schedule as Schedule).getAttributes().periods[periodIndex].trips.push(newTrip);
        });
    }
};

const getMostFrequentPath = (trips: TripAndStopTimes[], importData: GtfsInternalData): string | undefined => {
    const byPathCnt = trips.reduce((byPathCnt, currentTrip) => {
        byPathCnt[importData.pathIdsByTripId[currentTrip.trip.trip_id]] =
            (byPathCnt[importData.pathIdsByTripId[currentTrip.trip.trip_id]] || 0) + 1;
        return byPathCnt;
    }, {});
    let mostFrequent: string | undefined = undefined;
    Object.keys(byPathCnt).forEach((pathId) => {
        if (mostFrequent === undefined || byPathCnt[pathId] > byPathCnt[mostFrequent]) {
            mostFrequent = pathId;
        }
    });
    return mostFrequent;
};

//TODO: Add functionality to the _period argument, or remove it.
const getPeriodDataForDirection = (trips: TripAndStopTimes[], _period: SchedulePeriod) => {
    const customPeriodStartSeconds = trips[0].stopTimes[0].departureTimeSeconds;
    const customPeriodEndSeconds = trips[trips.length - 1].stopTimes[0].departureTimeSeconds;
    const frequencySeconds =
        trips.length === 1 ? 60 : (customPeriodEndSeconds - customPeriodStartSeconds) / (trips.length - 1);
    // TODO Determine if we should use custom start/end if the interval between start/end of period and actual is higher than frequency, but for now, simply use the observed period
    return {
        actualStart: customPeriodStartSeconds,
        actualEnd: customPeriodEndSeconds,
        frequencySeconds
    };
};

const generateFrequencyBasedTrips = (
    schedule: Schedule,
    periods: TripAndStopTimes[][],
    importData: GtfsInternalData
) => {
    // Prepare frequency data (paths, times and frequencies) for each period
    for (let periodIndex = 0; periodIndex < periods.length; periodIndex++) {
        const trips = periods[periodIndex];
        if (trips.length === 0) {
            continue;
        }
        const currentPeriod = schedule.attributes.periods[periodIndex];

        // Find the most frequent path in each direction
        const inboundTrips = trips.filter(({ trip }) => (trip.direction_id || 0) !== 0);
        const outboundTrips = trips.filter(({ trip }) => (trip.direction_id || 0) === 0);

        const mostFrequentOutbound = getMostFrequentPath(outboundTrips, importData);
        const mostFrequentInbound = getMostFrequentPath(inboundTrips, importData);

        currentPeriod.outbound_path_id =
            mostFrequentOutbound !== undefined ? mostFrequentOutbound : mostFrequentInbound;
        currentPeriod.inbound_path_id = mostFrequentOutbound !== undefined ? mostFrequentInbound : undefined;

        // Get custom times and frequencies for each direction
        const outboundData =
            mostFrequentOutbound !== undefined
                ? getPeriodDataForDirection(outboundTrips, currentPeriod)
                : getPeriodDataForDirection(inboundTrips, currentPeriod);
        const inboundData =
            mostFrequentOutbound !== undefined && inboundTrips.length > 0
                ? getPeriodDataForDirection(inboundTrips, currentPeriod)
                : undefined;

        const customPeriodStart =
            inboundData !== undefined
                ? Math.min(outboundData.actualStart, inboundData.actualStart)
                : outboundData.actualStart;
        const customPeriodEnd =
            inboundData !== undefined
                ? Math.min(outboundData.actualEnd, inboundData.actualEnd)
                : outboundData.actualEnd;
        currentPeriod.custom_start_at_str =
            customPeriodStart !== hoursToSeconds(currentPeriod.start_at_hour)
                ? secondsSinceMidnightToTimeStr(customPeriodStart)
                : undefined;
        // Add one minute to the custom end time, so that the end time is included in the period calculation
        currentPeriod.custom_end_at_str =
            customPeriodEnd !== hoursToSeconds(currentPeriod.end_at_hour)
                ? secondsSinceMidnightToTimeStr(customPeriodEnd + 60)
                : undefined;

        // For interval, take the average of inbound/outbound frequencies
        currentPeriod.interval_seconds =
            inboundData !== undefined
                ? Math.ceil((outboundData.frequencySeconds + inboundData.frequencySeconds) / 2)
                : Math.ceil(outboundData.frequencySeconds);

        schedule.generateForPeriod(currentPeriod.period_shortname as string);
    }
};

/**
 * Generate the schedules to import for the lines. The line will be modified to
 * contain the new updated schedules.
 * @param line The line to update
 * @param tripsWithStopTimes The trip with stop times for this line
 * @param importData
 * @returns
 */
const generateSchedulesForLine = async (
    line: Line,
    tripsWithStopTimes: TripAndStopTimes[],
    importData: GtfsInternalData,
    generateFrequencyBasedSchedules: boolean,
    collectionManager: CollectionManager
): Promise<Schedule[]> => {
    try {
        await line.refreshSchedules(serviceLocator.socketEventManager);
        const existingSchedules = line.getSchedules();

        const groupedSchedulesForLine = groupSchedulesAndTripsToImport(
            line,
            tripsWithStopTimes,
            importData,
            collectionManager
        );

        // For each schedule, generate the trips
        for (let scheduleGroupIdx = 0; scheduleGroupIdx < groupedSchedulesForLine.length; scheduleGroupIdx++) {
            const { schedule, periods } = groupedSchedulesForLine[scheduleGroupIdx];

            if (!generateFrequencyBasedSchedules) {
                generateExactTrips(schedule, periods, importData);
            } else {
                generateFrequencyBasedTrips(schedule, periods, importData);
            }

            line.addSchedule(schedule);
            if (existingSchedules[schedule.attributes.service_id]) {
                // Delete previous schedules for this service
                await scheduleDbQueries.delete(existingSchedules[schedule.attributes.service_id].getId());
            }
        }

        return groupedSchedulesForLine.map((sched) => sched.schedule);
    } catch (err) {
        console.error('Error importing line %s %s', line.get('shortname'), line.get('longname'), err);
        throw {
            text: GtfsMessages.ErrorImportingSchedulesForLine,
            params: { shortname: line.get('shortname'), longname: line.get('longname') }
        };
    }
};

export default {
    prepareTripData,
    generateAndImportSchedules
};
