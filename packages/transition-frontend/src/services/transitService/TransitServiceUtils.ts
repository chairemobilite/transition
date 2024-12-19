/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as ScheduleUtils from '../schedule/TransitScheduleUtils';
import Service, { serviceDays } from 'transition-common/lib/services/service/Service';
import Line from 'transition-common/lib/services/line/Line';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import Schedule from 'transition-common/lib/services/schedules/Schedule';

export const getServiceLabel = (service: Service, t: (arg0: string) => string): string => {
    let label = service.toString();
    const serviceWeekdays: string[] = [];
    for (let i = 0, count = serviceDays.length; i < count; i++) {
        if (service.getAttributes()[serviceDays[i]] === true) {
            serviceWeekdays.push(t(`main:dateTime:weekdaysAbbr:${serviceDays[i]}`));
        }
    }
    if (serviceWeekdays.length > 0) {
        label += ` (${serviceWeekdays.join(', ')})`;
    }
    return label;
};

// TODO Refactor to use the serviceMatches method instead to avoid duplication
export const canMergeServices = (service: Service, mergee: Service): boolean => {
    // Check the weekdays of the mergee are include or identical to the service dates
    for (let i = 0, count = serviceDays.length; i < count; i++) {
        const hasService = service.get(serviceDays[i]);
        const mergeeHasService = mergee.get(serviceDays[i]);
        if (
            hasService !== undefined &&
            hasService === false &&
            mergeeHasService !== undefined &&
            mergeeHasService !== null &&
            hasService !== mergeeHasService
        ) {
            return false;
        }
    }
    // Check that the dates correspond
    const serviceStartDate = service.getAttributes().start_date;
    const serviceEndDate = service.getAttributes().end_date;
    if (serviceStartDate && serviceEndDate) {
        const start = Date.parse(serviceStartDate);
        const end = Date.parse(serviceEndDate);
        const mergeeStart = Date.parse(mergee.getAttributes().start_date);
        const mergeeEnd = Date.parse(mergee.getAttributes().end_date);
        if (mergeeEnd < start || mergeeStart > end) {
            return false;
        }
    }

    return true;
};

/**
 * Verify if a service matches a given filter
 *
 * @param service The service to match
 * @param filter The filter to match
 * @returns Whether the service matches the filter
 */
export const serviceMatches = (
    service: Service,
    filter: {
        name?: string;
        days?: number[];
        startDate?: Date;
        endDate?: Date;
    }
): boolean => {
    if (filter.name) {
        const serviceName = service.getAttributes().name;
        // The name can be a string contained in the serviceName, or a regex
        try {
            if (serviceName && !(serviceName.includes(filter.name) || serviceName.match(filter.name))) {
                return false;
            }
        } catch {
            console.error(`Error interpreting regular expression ${filter.name}. Returning false`);
            return false;
        }
    }
    // Check that weekdays of the service are in the filter, empty days, or undefined is always true
    const days = filter.days || [];
    // TODO Assume AND behavior for days, add a filter to specify AND or OR
    for (let i = 0, count = days.length; i < count; i++) {
        const dayIndex = days[i];
        const hasService = service.get(serviceDays[dayIndex]);
        if (hasService === false) {
            return false;
        }
    }
    // Validate the service dates
    if (filter.startDate) {
        if (service.isValidForDate(filter.startDate, filter.endDate) === false) {
            return false;
        }
    }
    return true;
};

export const mergeServices = async (
    newServiceId: string,
    mergedServices: Service[],
    serviceLocator: any
): Promise<{ line: Line; incompatible: [string, string] }[]> => {
    if (mergedServices.length === 0) {
        return [];
    }
    const mergedServiceIds = mergedServices.map((s) => s.getId());
    const allLines: LineCollection = serviceLocator.collectionManager.get('lines');
    const messages: { line: any; incompatible: [string, string] }[] = [];
    const unmergedDict: { [key: string]: number } = {};

    for (const line of allLines.getFeatures()) {
        await line.refreshSchedules(serviceLocator.socketEventManager);

        // Get a list of merged service IDs that have trips for this line
        const byServiceId = line.getSchedules();
        const schedules: Schedule[] = [];
        for (const serviceId in byServiceId) {
            if (mergedServiceIds.includes(serviceId)) {
                schedules.push(line.getSchedule(serviceId));
            }
        }
        if (schedules.length === 0) {
            // No schedules to merge
            continue;
        }
        if (schedules.length === 1) {
            // Only one schedule, just update the service ID
            const schedule = schedules[0];
            schedule.startEditing();
            schedule.set('service_id', newServiceId);
            await schedule.save(serviceLocator.socketEventManager);
            await line.refreshSchedules(serviceLocator.socketEventManager);
            continue;
        }
        let canMerge = true;
        // There is more than one schedule, make sure they have the same periods
        for (let i = 0; i < schedules.length - 1; i++) {
            for (let j = i + 1; j < schedules.length; j++) {
                if (!ScheduleUtils.haveSamePeriods(schedules[i], schedules[j])) {
                    messages.push({
                        line: line,
                        incompatible: [schedules[i].attributes.service_id, schedules[j].attributes.service_id]
                    });
                    canMerge = false;
                    unmergedDict[schedules[i].attributes.service_id] = 1;
                    unmergedDict[schedules[j].attributes.service_id] = 1;
                }
            }
        }
        if (!canMerge) {
            continue;
        }
        // Schedules can be merged
        const schedule = schedules[0];
        schedule.startEditing();
        for (let i = 1; i < schedules.length; i++) {
            const schedToMerge = schedules[i];
            ScheduleUtils.mergeScheduleTrips(schedule, schedToMerge);
            await schedToMerge.delete(serviceLocator.socketEventManager);
        }
        schedule.set('service_id', newServiceId);
        await schedule.save(serviceLocator.socketEventManager);
        await line.refreshSchedules(serviceLocator.socketEventManager);
    }

    const allScenarios = serviceLocator.collectionManager.get('scenarios');
    for (const scenario of allScenarios.getFeatures()) {
        const serviceIds = scenario.get('services');
        if (!serviceIds || !serviceIds.some((service) => mergedServiceIds.includes(service))) {
            continue;
        }
        const newServices = serviceIds.filter((service) => !mergedServiceIds.includes(service));
        newServices.push(newServiceId);
        scenario.set('services', newServices);
        scenario.save(serviceLocator.socketEventManager);
    }

    // Delete services for which there was no issue
    for (const mergedService of mergedServices) {
        if (!unmergedDict[mergedService.getId()]) {
            mergedService.delete(serviceLocator.socketEventManager).then((_response) => {
                serviceLocator.collectionManager?.refresh('services');
            });
        }
    }

    return messages;
};
