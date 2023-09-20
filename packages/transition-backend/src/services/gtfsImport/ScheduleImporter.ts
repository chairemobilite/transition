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
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { GtfsInternalData, StopTime, Frequencies, Period } from './GtfsImportTypes';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';
import linesDbQueries from '../../models/db/transitLines.db.queries';
import scheduleDbQueries from '../../models/db/transitSchedules.db.queries';
import { objectToCache as lineObjectToCache } from '../../models/capnpCache/transitLines.cache.queries';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const getNextStopTimes = (previousStopTimes: StopTime[], frequency: Frequencies): StopTime[] | undefined => {
    if (previousStopTimes[0].arrivalTimeSeconds + frequency.headway_secs > frequency.endTimeSeconds) {
        // Stop times for this frequency is finished
        return undefined;
    }
    const nextStopTimes = _cloneDeep(previousStopTimes);
    nextStopTimes.forEach((stopTime) => {
        stopTime.arrivalTimeSeconds = stopTime.arrivalTimeSeconds + frequency.headway_secs;
        stopTime.arrival_time = secondsSinceMidnightToTimeStr(stopTime.arrivalTimeSeconds);
        stopTime.departureTimeSeconds = stopTime.departureTimeSeconds + frequency.headway_secs;
        stopTime.departure_time = secondsSinceMidnightToTimeStr(stopTime.departureTimeSeconds);
    });
    return nextStopTimes;
};

const sortLineTrips = (tripsForLine: { [key: string]: { trip: GtfsTypes.Trip; stopTimes: StopTime[] }[] }) => {
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
const prepareTripData = (
    importData: GtfsInternalData
): { [key: string]: { trip: GtfsTypes.Trip; stopTimes: StopTime[] }[] } => {
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
        tripsForLine.push({ trip, stopTimes });
        tripDataByGtfsLineId[trip.route_id] = tripsForLine;

        // If a trip has frequencies, the stop times should be copied at that frequency rate to create a new trip
        const frequencies = frequenciesByTripId[trip.trip_id] || [];
        for (let j = 0; j < frequencies.length; j++) {
            const frequency = frequencies[j];
            let nextStopTimes = getNextStopTimes(stopTimes, frequency);
            while (nextStopTimes) {
                tripsForLine.push({ trip, stopTimes: nextStopTimes });
                stopTimes = nextStopTimes;
                nextStopTimes = getNextStopTimes(stopTimes, frequency);
            }
        }
    }
    return sortLineTrips(tripDataByGtfsLineId);
};

const generateAndImportSchedules = async (
    tripByGtfsLineId: { [key: string]: { trip: GtfsTypes.Trip; stopTimes: StopTime[] }[] },
    importData: GtfsInternalData,
    collectionManager
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
                const newSchedules = await generateSchedulesForLine(line, tripByGtfsLineId[gtfsLineId], importData);
                // save line and its schedules to cache file:
                await linesDbQueries.update(line.getId(), line.attributes, 'id');
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

const createSchedule = (line: Line, serviceId: string, importData: GtfsInternalData, periods: Period[]) => {
    const schedule = new Schedule(
        {
            allow_seconds_based_schedules: true,
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [],
            service_id: serviceId,
            line_id: line.getId()
        },
        true
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

const generateSchedulesForLine = async (
    line: Line,
    tripsWithStopTimes: { trip: GtfsTypes.Trip; stopTimes: StopTime[] }[],
    importData: GtfsInternalData
): Promise<Schedule[]> => {
    try {
        const ignoreExisting = importData.doNotUpdateAgencies.includes(line.attributes.agency_id);
        await line.refreshSchedules(serviceLocator.socketEventManager);
        const existingSchedules = line.getSchedules();
        const scheduleByServiceId: { [key: string]: Schedule } = {};
        const periods = importData.periodsGroup.periods;
        const periodShortnameByIndex = {};

        for (let j = 0, countJ = periods.length; j < countJ; j++) {
            const period = periods[j];
            periodShortnameByIndex[period.shortname] = j;
        }
        if (!tripsWithStopTimes || tripsWithStopTimes.length === 0) {
            return [];
        }

        for (let i = 0, countI = tripsWithStopTimes.length; i < countI; i++) {
            const { trip, stopTimes } = tripsWithStopTimes[i];

            if (trip && stopTimes && stopTimes.length > 0) {
                const serviceId = importData.serviceIdsByGtfsId[trip.service_id];
                const pathId = importData.pathIdsByTripId[trip.trip_id];

                // Ignore trip is invalid, no path, or the service already exists for this line and should not be updated
                if (
                    !isTripValid(stopTimes) ||
                    !pathId ||
                    (existingSchedules[serviceId] !== undefined && ignoreExisting)
                ) {
                    continue;
                }
                const schedule = scheduleByServiceId[serviceId]
                    ? scheduleByServiceId[serviceId]
                    : createSchedule(line, serviceId, importData, periods);
                scheduleByServiceId[serviceId] = schedule;

                // generate new trip for schedule/service id:
                const tripDepartureTimeSeconds = stopTimes[0].departureTimeSeconds;
                const tripArrivalTimeSeconds = stopTimes[stopTimes.length - 1].arrivalTimeSeconds;
                const periodShortname = findPeriodShortname(importData.periodsGroup.periods, tripDepartureTimeSeconds);
                if (periodShortname === null) {
                    console.log(
                        `GTFS Schedule import: Cannot find period for stopTime with departure time of ${tripDepartureTimeSeconds}`
                    );
                    continue;
                }
                const periodIndex = periodShortnameByIndex[periodShortname];
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
            }
        }
        Object.keys(scheduleByServiceId).forEach(async (key) => {
            line.addSchedule(scheduleByServiceId[key]);
            if (existingSchedules[key]) {
                // Delete previous schedules for this service
                await scheduleDbQueries.delete(existingSchedules[key].getId());
            }
        });
        return Object.values(scheduleByServiceId);
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
