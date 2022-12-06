/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Line, { LineAttributes } from 'transition-common/lib/services/line/Line';
import {
    SchedulePeriodTrip,
    SchedulePeriod,
    ScheduleAttributes
} from 'transition-common/lib/services/schedules/Schedule';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import {
    deleteObjectCache as defaultDeleteObjectCache,
    deleteObjectsCache as defaultDeleteObjectsCache,
    objectToCache as defaultObjectToCache,
    objectsToCache as defaultObjectsToCache,
    objectFromCache as defaultObjectFromCache,
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import { _isBlank, _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    nullToMinusOne,
    minusOneToUndefined,
    boolToInt8,
    int8ToBool
} from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';
import { LineCollection as CacheCollection } from '../capnpDataModel/lineCollection.capnp';
import { Line as CacheObjectClass } from '../capnpDataModel/line.capnp';
import {
    secondsSinceMidnightToTimeStr,
    timeStrToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';

// TODO Revisit some lodash extension functions to limit the types once all
// consumers are in typescript, we'll know if some of the expected types are
// wrong
const importParser = function (cacheObject: CacheObjectClass) {
    const attributes: Partial<LineAttributes> = {
        id: cacheObject.getUuid(),
        mode: _emptyStringToNull(cacheObject.getMode()),
        category: _emptyStringToNull(cacheObject.getCategory()),
        internal_id: _emptyStringToNull(cacheObject.getInternalId()),
        agency_id: cacheObject.getAgencyUuid(),
        shortname: _emptyStringToNull(cacheObject.getShortname()),
        longname: _emptyStringToNull(cacheObject.getLongname()),
        color: _emptyStringToNull(cacheObject.getColor()),
        is_enabled: int8ToBool(cacheObject.getIsEnabled()),
        is_autonomous: int8ToBool(cacheObject.getIsAutonomous()) || undefined,
        is_frozen: int8ToBool(cacheObject.getIsFrozen()),
        allow_same_line_transfers: int8ToBool(cacheObject.getAllowSameLineTransfers()) || undefined,
        description: _emptyStringToNull(cacheObject.getDescription()),
        data: JSON.parse(cacheObject.getData())
    };

    const schedulesCache = cacheObject.getSchedules();
    const scheduleByServiceId = {};

    schedulesCache.forEach((scheduleCache) => {
        const schedule: Partial<ScheduleAttributes> = {
            id: scheduleCache.getUuid(),
            line_id: attributes.id as string,
            service_id: scheduleCache.getServiceUuid(),
            periods_group_shortname: scheduleCache.getPeriodsGroupShortname(),
            allow_seconds_based_schedules: int8ToBool(scheduleCache.getAllowSecondsBasedSchedules()),
            is_frozen: int8ToBool(scheduleCache.getIsFrozen()),
            periods: []
        };

        const periodsCache = scheduleCache.getPeriods();
        const periods: Partial<SchedulePeriod>[] = [];

        periodsCache.forEach((periodCache) => {
            const periodShortname = periodCache.getPeriodShortname();
            const period: Partial<SchedulePeriod> = {
                period_shortname: periodShortname,
                schedule_id: schedule.id,
                outbound_path_id: periodCache.getOutboundPathUuid(),
                inbound_path_id: _emptyStringToNull(periodCache.getInboundPathUuid()),
                custom_start_at_str:
                    periodCache.getCustomStartAtSeconds() > -1
                        ? secondsSinceMidnightToTimeStr(periodCache.getCustomStartAtSeconds())
                        : undefined,
                custom_end_at_str:
                    periodCache.getCustomEndAtSeconds() > -1
                        ? secondsSinceMidnightToTimeStr(periodCache.getCustomEndAtSeconds())
                        : undefined,
                start_at_hour: periodCache.getStartAtSeconds() / 3600,
                end_at_hour: periodCache.getEndAtSeconds() / 3600,
                interval_seconds: minusOneToUndefined(periodCache.getIntervalSeconds()),
                number_of_units: minusOneToUndefined(periodCache.getNumberOfUnits()),
                is_frozen: int8ToBool(periodCache.getIsFrozen())
            };

            const tripsCache = periodCache.getTrips();
            const trips: Partial<SchedulePeriodTrip>[] = [];

            tripsCache.forEach((tripCache) => {
                const trip = {
                    id: tripCache.getUuid(),
                    schedule_id: schedule.id,
                    path_id: tripCache.getPathUuid(),
                    departure_time_seconds: tripCache.getDepartureTimeSeconds(),
                    arrival_time_seconds: tripCache.getArrivalTimeSeconds(),
                    node_arrival_times_seconds: tripCache.getNodeArrivalTimesSeconds().map((arrivalTimeSeconds) => {
                        return arrivalTimeSeconds !== -1 ? arrivalTimeSeconds : (null as any);
                    }),
                    node_departure_times_seconds: tripCache.getNodeDepartureTimesSeconds().map((arrivalTimeSeconds) => {
                        return arrivalTimeSeconds !== -1 ? arrivalTimeSeconds : (null as any);
                    }),
                    nodes_can_board: tripCache.getNodesCanBoard().map((canBoardInt8) => {
                        return int8ToBool(canBoardInt8) as any;
                    }),
                    nodes_can_unboard: tripCache.getNodesCanUnboard().map((canUnboardInt8) => {
                        return int8ToBool(canUnboardInt8) as any;
                    }),
                    block_id: _emptyStringToNull(tripCache.getBlockUuid()),
                    total_capacity: minusOneToUndefined(tripCache.getTotalCapacity()),
                    seated_capacity: minusOneToUndefined(tripCache.getSeatedCapacity()),
                    is_frozen: int8ToBool(tripCache.getIsFrozen())
                };

                trips.push(trip);
            });

            period.trips = trips as any;
            periods.push(period);
        });

        schedule.periods = periods as any;
        scheduleByServiceId[schedule.service_id as string] = schedule;
    });

    attributes.scheduleByServiceId = scheduleByServiceId;

    return new Line(attributes, false);
};

const exportParser = function (object: Line, cacheObject: CacheObjectClass) {
    const attributes = object.getAttributes();

    const schedules: ScheduleAttributes[] = [];
    for (const serviceId in attributes.scheduleByServiceId) {
        const schedule = attributes.scheduleByServiceId[serviceId];
        schedules.push(schedule);
    }
    const schedulesCache = cacheObject.initSchedules(schedules.length);

    cacheObject.setUuid(attributes.id);
    cacheObject.setMode(attributes.mode || '');
    cacheObject.setCategory(attributes.category || '');
    cacheObject.setAgencyUuid(attributes.agency_id);
    cacheObject.setShortname(attributes.shortname || '');
    cacheObject.setLongname(attributes.longname || '');
    cacheObject.setInternalId(attributes.internal_id || '');
    cacheObject.setColor(attributes.color || '');
    cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
    cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
    cacheObject.setIsAutonomous(boolToInt8(attributes.is_autonomous));
    cacheObject.setAllowSameLineTransfers(boolToInt8(attributes.allow_same_line_transfers));
    cacheObject.setDescription(attributes.description || '');
    cacheObject.setData(JSON.stringify(attributes.data || {}));

    for (let i = 0, count = schedules.length; i < count; i++) {
        const schedule = schedules[i];
        const periods = !_isBlank(schedule.periods) ? schedule.periods : [];

        const scheduleCache = schedulesCache.get(i);
        scheduleCache.setUuid(schedule.id);
        scheduleCache.setServiceUuid(schedule.service_id as string);
        scheduleCache.setPeriodsGroupShortname(schedule.periods_group_shortname || '');
        scheduleCache.setAllowSecondsBasedSchedules(boolToInt8(schedule.allow_seconds_based_schedules));
        scheduleCache.setIsFrozen(boolToInt8(schedule.is_frozen));

        const periodsCache = scheduleCache.initPeriods(periods.length);

        for (let j = 0, countJ = periods.length; j < countJ; j++) {
            const period = periods[j];
            const periodCache = periodsCache.get(j);

            periodCache.setPeriodShortname(period.period_shortname || '');
            // TODO: That was previously _nullToMinusOne, but rust uses optional_string!! and the number does not compile!!
            periodCache.setOutboundPathUuid(period.outbound_path_id || '');
            periodCache.setInboundPathUuid(period.inbound_path_id || '');

            // !!! in the rust encoder, we need to send the times as seconds after midnight! No conversion will occur.

            periodCache.setCustomStartAtSeconds(
                period.custom_start_at_str ? (timeStrToSecondsSinceMidnight(period.custom_start_at_str) as number) : -1
            );
            periodCache.setCustomEndAtSeconds(
                period.custom_end_at_str ? (timeStrToSecondsSinceMidnight(period.custom_end_at_str) as number) : -1
            );
            periodCache.setStartAtSeconds(period.start_at_hour * 3600);
            periodCache.setEndAtSeconds(period.end_at_hour * 3600);
            periodCache.setIntervalSeconds(nullToMinusOne(period.interval_seconds) as number);
            periodCache.setNumberOfUnits(period.number_of_units || -1);
            periodCache.setIsFrozen(boolToInt8(period.is_frozen));

            if (_isBlank(period.trips)) {
                period.trips = [];
            }

            const tripsCache = periodCache.initTrips(period.trips.length);

            for (let k = 0, countK = period.trips.length; k < countK; k++) {
                const trip = period.trips[k];
                const tripCache = tripsCache.get(k);
                tripCache.setUuid(trip.id);
                tripCache.setPathUuid(trip.path_id);
                tripCache.setDepartureTimeSeconds(trip.departure_time_seconds);
                tripCache.setArrivalTimeSeconds(trip.arrival_time_seconds);
                tripCache.setIsFrozen(boolToInt8(trip.is_frozen));
                const nodesArrival = tripCache.initNodeArrivalTimesSeconds(trip.node_arrival_times_seconds.length);
                for (let l = 0, countL = trip.node_arrival_times_seconds.length; l < countL; l++) {
                    const arrivalTimeSeconds = trip.node_arrival_times_seconds[l];
                    nodesArrival.set(l, arrivalTimeSeconds !== null ? arrivalTimeSeconds : -1);
                }
                const nodesDeparture = tripCache.initNodeDepartureTimesSeconds(
                    trip.node_departure_times_seconds.length
                );
                for (let l = 0, countL = trip.node_departure_times_seconds.length; l < countL; l++) {
                    const departureTimeSeconds = trip.node_departure_times_seconds[l];
                    nodesDeparture.set(l, departureTimeSeconds !== null ? departureTimeSeconds : -1);
                }
                const nodesCanBoard = tripCache.initNodesCanBoard(trip.nodes_can_board.length);
                for (let l = 0, countL = trip.nodes_can_board.length; l < countL; l++) {
                    const canBoardBoolean = trip.nodes_can_board[l];
                    nodesCanBoard.set(l, boolToInt8(canBoardBoolean));
                }
                const nodesCanUnboard = tripCache.initNodesCanUnboard(trip.nodes_can_unboard.length);
                for (let l = 0, countL = trip.nodes_can_unboard.length; l < countL; l++) {
                    const canUnboardBoolean = trip.nodes_can_unboard[l];
                    nodesCanUnboard.set(l, boolToInt8(canUnboardBoolean));
                }
                tripCache.setBlockUuid(trip.block_id || '');
                tripCache.setTotalCapacity(nullToMinusOne(trip.total_capacity) as number);
                tripCache.setSeatedCapacity(nullToMinusOne(trip.seated_capacity) as number);
            }
        }
    }
};

const deleteObjectCache = function (objectId: string, cachePathDirectory?: string) {
    return defaultDeleteObjectCache({
        cacheName: 'line',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/lines` : 'lines',
        objectId
    });
};

const deleteObjectsCache = function (objectIds: string[], cachePathDirectory?: string) {
    return defaultDeleteObjectsCache({
        cacheName: 'line',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/lines` : 'lines',
        objectIds
    });
};

const objectToCache = function (object: Line, cachePathDirectory?: string) {
    return defaultObjectToCache({
        cacheName: 'line',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/lines` : 'lines',
        object,
        ObjectClass: Line,
        CacheObjectClass,
        capnpParser: exportParser
    });
};

const objectsToCache = function (objects: Line[], cachePathDirectory?: string) {
    return defaultObjectsToCache(objectToCache, {
        cachePathDirectory,
        objects
    });
};

const objectFromCache = function (lineId: string, cachePathDirectory?: string) {
    return defaultObjectFromCache({
        cacheName: 'line',
        cachePathDirectory: cachePathDirectory ? `${cachePathDirectory}/lines` : 'lines',
        objectId: lineId,
        ObjectClass: Line,
        CacheObjectClass,
        capnpParser: importParser
    });
};

const collectionToCache = function (collection, cachePathDirectory?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'lines',
        cachePathDirectory,
        pluralizedCollectionName: 'Lines',
        maxNumberOfObjectsPerFile: 1000,
        CollectionClass: LineCollection,
        CacheCollection,
        parser: function (object: Line) {
            const attributes = object.getAttributes();

            return attributes;
        },
        capnpParser: function (object: Line, cacheObject: CacheObjectClass) {
            const attributes = object.getAttributes();

            cacheObject.setUuid(attributes.id);
            cacheObject.setMode(attributes.mode || '');
            cacheObject.setCategory(attributes.category || '');
            cacheObject.setAgencyUuid(attributes.agency_id);
            cacheObject.setShortname(attributes.shortname || '');
            cacheObject.setLongname(attributes.longname || '');
            cacheObject.setInternalId(attributes.internal_id || '');
            cacheObject.setColor(attributes.color || '');
            cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setIsAutonomous(boolToInt8(attributes.is_autonomous));
            cacheObject.setAllowSameLineTransfers(boolToInt8(attributes.allow_same_line_transfers));
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setData(JSON.stringify(attributes.data || {}));
        }
    });
};

const collectionFromCache = function (cachePathDirectory?: string) {
    return defaultCollectionFromCache({
        cacheName: 'lines',
        cachePathDirectory,
        collection: new LineCollection([], {}),
        pluralizedCollectionName: 'Lines',
        CollectionClass: LineCollection,
        CacheCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Line(object.attributes, false);
            } else {
                return new Line(object, false);
            }
        },
        capnpParser: function (cacheObject: CacheObjectClass) {
            return new Line(
                {
                    id: cacheObject.getUuid(),
                    mode: _emptyStringToNull(cacheObject.getMode()),
                    agency_id: cacheObject.getAgencyUuid(),
                    category: _emptyStringToNull(cacheObject.getCategory()),
                    shortname: _emptyStringToNull(cacheObject.getShortname()),
                    longname: _emptyStringToNull(cacheObject.getLongname()),
                    internal_id: _emptyStringToNull(cacheObject.getInternalId()),
                    color: _emptyStringToNull(cacheObject.getColor()),
                    is_enabled: int8ToBool(cacheObject.getIsEnabled()),
                    is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                    is_autonomous: int8ToBool(cacheObject.getIsAutonomous()),
                    description: _emptyStringToNull(cacheObject.getDescription()),
                    allow_same_line_transfers: int8ToBool(cacheObject.getAllowSameLineTransfers()),
                    data: JSON.parse(cacheObject.getData())
                },
                false
            );
        }
    });
};

export {
    objectToCache,
    objectsToCache,
    objectFromCache,
    deleteObjectCache,
    deleteObjectsCache,
    collectionToCache,
    collectionFromCache
};
