/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import Path from './Path';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const weekendDays = ['saturday', 'sunday'] as const;
const allDayKeys = [...weekdays, ...weekendDays];

/** A group of services with similar travel time patterns for a given path */
export type ServiceGroup = {
    /** IDs of the services in this group */
    serviceIds: string[];
    /** Days of the week covered by regular (non-holiday) services in this group */
    activeDays: string[];
    /** Whether this group contains holiday services */
    hasHolidayService: boolean;
    /** Average travel times per segment, keyed by period shortname */
    averageTimesByPeriod: Record<string, number[]>;
    /** Shared token extracted from the service names, used to differentiate groups */
    commonName?: string;
};

/**
 * Find the longest alphanumeric substring (length >= 3) that appears in every
 * groupNames entry and in none of the otherNames entries. This distinguishes
 * a group from other groups that share the same base label (e.g. "H55" vs
 * "H59" across STM service names like "25S-H55S000S-82-S").
 * Leading/trailing non-alphanumeric characters are trimmed from the result.
 */
const findDistinguishingToken = (groupNames: string[], otherNames: string[]): string | undefined => {
    if (groupNames.length === 0) return undefined;

    const isValid = (candidate: string) =>
        groupNames.every((name) => name.includes(candidate)) &&
        !otherNames.some((name) => name.includes(candidate));

    const first = groupNames[0];
    for (let len = first.length; len >= 3; len--) {
        for (let start = 0; start + len <= first.length; start++) {
            const candidate = first.substring(start, start + len);
            if (!isValid(candidate)) continue;

            const trimmed = candidate.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
            if (trimmed.length < 2 || !/[A-Za-z]/.test(trimmed)) continue;
            // The trimmed token must still be exclusive to this group
            if (isValid(trimmed)) return trimmed;
        }
    }
    return undefined;
};

/**
 * Calculate average segment travel times per period from actual trip data in a schedule.
 * For each period, averages the travel time of each segment across all trips on the given path.
 *
 * @param path - The path object (provides segments data)
 * @param serviceId - The service ID to look up the schedule
 * @returns Record keyed by period shortname, each value is an array of average times per segment,
 * or an empty array if there is no corresponding service for a given period
 */
const getAverageSegmentTimesByPeriod = (path: Path, serviceId: string): Record<string, number[]> => {
    const segmentsByPeriodAndService = path.attributes.data.segmentsByPeriodAndService ?? {};
    const periodShortnames = Object.keys(segmentsByPeriodAndService);
    const result: Record<string, number[]> = {};

    for (const shortname of periodShortnames) {
        // WARN: The specified serviceId could return undefined,
        // if the path doesn't have the specified service
        const segments = segmentsByPeriodAndService[shortname][serviceId]?.segments;
        if (!segments) continue;

        result[shortname] = segments.map((segment) => segment.travelTimeSeconds);
    }
    return result;
};

/**
 * Determine if a service is a holiday service based on its duration.
 * A service lasting 7 days or less is considered a holiday.
 */
const isHolidayService = (service: any): boolean => {
    if (!service) return false;
    const startDate = service.get('start_date');
    const endDate = service.get('end_date');
    if (!startDate || !endDate) return false;
    const durationDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    return durationDays <= 7;
};

/**
 * Build a travel time key for a service by bucketing total travel times per period.
 * Services with similar times (within the tolerance) produce the same key.
 *
 * @param path - The path object (provides segments data)
 * @param serviceId - The service to compute the key for
 * @param tolerance - Bucketing tolerance in seconds (times within this range produce the same bucket)
 * @returns A string key like "AM:5|PM:3" where each number is the bucketed total for that period
 */
const getServiceTravelTimeKey = (path: Path, serviceId: string, tolerance: number): string => {
    const avgTimes = getAverageSegmentTimesByPeriod(path, serviceId);
    return Object.keys(avgTimes)
        .sort()
        .map((shortname) => {
            const periodTotal = avgTimes[shortname].reduce((sum, t) => sum + t, 0);
            return `${shortname}:${Math.round(periodTotal / tolerance)}`;
        })
        .join('|');
};

/**
 * Parse a travel time key into a map of period shortname to bucketed total.
 *
 * @param key - A travel time key like "AM:5|PM:3"
 * @returns A Map where keys are period shortnames and values are bucketed totals
 */
const parseTravelTimeKey = (key: string): Map<string, string> =>
    new Map(
        key.split('|').map((p) => {
            const [k, v] = p.split(':');
            return [k, v];
        })
    );

/**
 * Separate service IDs into regular and holiday services.
 * Holiday services have a duration of 7 days or less.
 *
 * @param serviceIds - All service IDs to classify
 * @param servicesCollection - Collection to look up service attributes (dates)
 * @returns Object with regularIds and holidayIds arrays
 */
const separateHolidayServices = (
    serviceIds: string[],
    servicesCollection: any
): { regularIds: string[]; holidayIds: string[] } => {
    const regularIds: string[] = [];
    const holidayIds: string[] = [];
    for (const serviceId of serviceIds) {
        const service = servicesCollection?.getById(serviceId);
        if (isHolidayService(service)) {
            holidayIds.push(serviceId);
        } else {
            regularIds.push(serviceId);
        }
    }
    return { regularIds, holidayIds };
};

/**
 * Group regular services by their travel time similarity.
 * Services with the same bucketed total per period get the same key.
 *
 * @param regularIds - Service IDs of regular (non-holiday) services
 * @param path - The path object (provides segments data)
 * @param tolerance - Bucketing tolerance in seconds
 *
 * @returns Record keyed by travel time key, each value is an array of service IDs
 */
const groupRegularServicesByTravelTimes = (
    regularIds: string[],
    path: Path,
    tolerance: number
): Record<string, string[]> => {
    const groups: Record<string, string[]> = {};
    for (const serviceId of regularIds) {
        const key = getServiceTravelTimeKey(path, serviceId, tolerance);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(serviceId);
    }
    return groups;
};

/**
 * Merge groups whose travel time key is a subset of another group's key.
 * A service with fewer periods but matching totals gets absorbed into the larger group.
 *
 * @param serviceGroups - Record keyed by travel time key, mutated in place
 */
const mergeServicesWithSubsetPeriods = (serviceGroups: Record<string, string[]>): void => {
    const keys = Object.keys(serviceGroups);
    const merged = new Set<string>();
    for (const key of keys) {
        if (merged.has(key)) continue;
        const keyParts = parseTravelTimeKey(key);
        for (const otherKey of keys) {
            if (key === otherKey || merged.has(otherKey)) continue;
            const otherParts = parseTravelTimeKey(otherKey);
            if (keyParts.size < otherParts.size) {
                const isSubset = [...keyParts.entries()].every(([k, v]) => otherParts.get(k) === v);
                if (isSubset) {
                    serviceGroups[otherKey].push(...serviceGroups[key]);
                    delete serviceGroups[key];
                    merged.add(key);
                    break;
                }
            }
        }
    }
};

/**
 * Try to match each holiday service to an existing regular group by travel time similarity.
 *
 * @param holidayIds - Service IDs of holiday services to match
 * @param serviceGroups - Existing groups to match against, mutated in place when matched
 * @param path - The path object (provides segments data)
 * @param tolerance - Bucketing tolerance in seconds
 * @returns IDs of holidays that couldn't be matched to any group
 */
const matchHolidaysToGroups = (
    holidayIds: string[],
    serviceGroups: Record<string, string[]>,
    path: Path,
    tolerance: number
): string[] => {
    const unmatchedIds: string[] = [];
    const groupKeys = Object.keys(serviceGroups);
    for (const holidayId of holidayIds) {
        const holidayKey = getServiceTravelTimeKey(path, holidayId, tolerance);
        const holidayParts = parseTravelTimeKey(holidayKey);
        let matched = false;
        if (serviceGroups[holidayKey]) {
            serviceGroups[holidayKey].push(holidayId);
            matched = true;
        } else {
            for (const groupKey of groupKeys) {
                const groupParts = parseTravelTimeKey(groupKey);
                const isSubset = [...holidayParts.entries()].every(([k, v]) => groupParts.get(k) === v);
                if (isSubset) {
                    serviceGroups[groupKey].push(holidayId);
                    matched = true;
                    break;
                }
            }
        }
        if (!matched) {
            unmatchedIds.push(holidayId);
        }
    }
    return unmatchedIds;
};

/**
 * Look up each service's name from the collection and return the list of names
 * (ignoring services with no name or missing from the collection).
 */
const collectServiceNames = (serviceIds: string[], servicesCollection: any): string[] => {
    const names: string[] = [];
    for (const serviceId of serviceIds) {
        const service = servicesCollection?.getById(serviceId);
        const name = service?.get('name');
        if (typeof name === 'string' && name.length > 0) names.push(name);
    }
    return names;
};

/**
 * Compute a distinguishing token for the given group's service names by
 * searching for a substring that appears in all its names but not in any
 * sibling group's names. Returns undefined when the group has fewer than two
 * services with names or no token is found.
 */
const computeGroupCommonName = (
    groupNames: string[],
    otherGroupsNames: string[]
): string | undefined => {
    if (groupNames.length < 2) return undefined;
    return findDistinguishingToken(groupNames, otherGroupsNames);
};

/**
 * Build the final ServiceGroup array from grouped service IDs.
 * Collects active days from regular services and computes average times per period.
 *
 * @param serviceGroups - Record keyed by travel time key, each value is an array of service IDs
 * @param unmatchedHolidayIds - Holiday service IDs that didn't match any group
 * @param path - The path object (provides segments data)
 * @param servicesCollection - Collection to look up service attributes (days)
 * @returns Array of ServiceGroup objects
 */
const buildServiceGroups = (
    serviceGroups: Record<string, string[]>,
    unmatchedHolidayIds: string[],
    path: Path,
    servicesCollection: any
): ServiceGroup[] => {
    // All services are holidays — keep each one separate
    if (Object.keys(serviceGroups).length === 0 && unmatchedHolidayIds.length > 0) {
        return unmatchedHolidayIds.map((holidayId) => ({
            serviceIds: [holidayId],
            activeDays: [],
            hasHolidayService: true,
            averageTimesByPeriod: getAverageSegmentTimesByPeriod(path, holidayId)
        }));
    }

    const builtServiceGroups = Object.values(serviceGroups).map((ids): ServiceGroup => {
        const activeDaysSet = new Set<string>();
        for (const serviceId of ids) {
            const service = servicesCollection?.getById(serviceId);
            if (!service || isHolidayService(service)) continue;
            allDayKeys.filter((day) => service.get(day)).forEach((d) => activeDaysSet.add(d));
        }
        const averageTimesByPeriod = getAverageSegmentTimesByPeriod(path, ids[0]);
        return {
            serviceIds: ids,
            activeDays: [...activeDaysSet],
            hasHolidayService: false,
            averageTimesByPeriod
        };
    });

    if (unmatchedHolidayIds.length === 0) return builtServiceGroups;

    builtServiceGroups.push({
        serviceIds: unmatchedHolidayIds,
        activeDays: [],
        hasHolidayService: true,
        averageTimesByPeriod: getAverageSegmentTimesByPeriod(path, unmatchedHolidayIds[0])
    });

    return builtServiceGroups;
};

/**
 * Assigns commonName to groups that share the same day-pattern signature with
 * at least one other group (so the user can distinguish them). Groups with a
 * unique base label are left with commonName undefined. Tokens are chosen to
 * be present in the group's service names but absent from sibling groups.
 */
const assignCommonNamesForDuplicates = (groups: ServiceGroup[], servicesCollection: any): void => {
    const buildSignature = (group: ServiceGroup) =>
        `${[...group.activeDays].sort().join(',')}|${group.hasHolidayService}`;

    const signatureToGroups = new Map<string, ServiceGroup[]>();
    for (const group of groups) {
        const signature = buildSignature(group);
        const bucket = signatureToGroups.get(signature) || [];
        bucket.push(group);
        signatureToGroups.set(signature, bucket);
    }

    for (const bucket of signatureToGroups.values()) {
        if (bucket.length < 2) continue;
        const namesByGroupIndex = bucket.map((g) => collectServiceNames(g.serviceIds, servicesCollection));
        for (let i = 0; i < bucket.length; i++) {
            const otherNames = namesByGroupIndex
                .filter((_, index) => index !== i)
                .flat();
            bucket[i].commonName = computeGroupCommonName(namesByGroupIndex[i], otherNames);
        }
    }
};

/**
 * Group services by average travel times for a path. Services with similar
 * total travel times (within 1% tolerance) per period are grouped together.
 * Holiday services (duration <= 7 days) are matched to existing groups when possible,
 * or placed in their own group(s). Each group includes the active days of the week
 * from its regular services and average segment times per period.
 *
 * @param path - The path object (provides segments data)
 * @param serviceIds - All service IDs to consider for grouping
 * @param totalPathTime - Total path travel time in seconds (used to compute 1% tolerance)
 * @param servicesCollection - Collection to look up service attributes (days, dates)
 * @returns Array of service groups with their active days and average times
 */
export const groupServicesByTravelTimes = (
    path: Path,
    serviceIds: string[],
    totalPathTime: number,
    servicesCollection: any,
    noGrouping: boolean = false
): ServiceGroup[] => {
    if (noGrouping) {
        return serviceIds.map((serviceId): ServiceGroup => {
            const service = servicesCollection?.getById(serviceId);
            const hasHolidayService = service ? isHolidayService(service) : false;
            const activeDays = service && !hasHolidayService ? allDayKeys.filter((day) => service.get(day)) : [];
            return {
                serviceIds: [serviceId],
                activeDays,
                hasHolidayService,
                averageTimesByPeriod: getAverageSegmentTimesByPeriod(path, serviceId)
            };
        });
    }

    const tolerance = Math.max(1, totalPathTime * 0.01);

    const { regularIds, holidayIds } = separateHolidayServices(serviceIds, servicesCollection);
    const serviceGroupsByKey = groupRegularServicesByTravelTimes(regularIds, path, tolerance);
    mergeServicesWithSubsetPeriods(serviceGroupsByKey);
    const unmatchedHolidayIds = matchHolidaysToGroups(holidayIds, serviceGroupsByKey, path, tolerance);

    const groups = buildServiceGroups(serviceGroupsByKey, unmatchedHolidayIds, path, servicesCollection);
    assignCommonNamesForDuplicates(groups, servicesCollection);
    return groups;
};

/**
 * Expand grouped segment time overrides to all services in each group.
 * When saving, the edits made on the representative service of a group
 * are copied to all other services in the same group.
 *
 * @param localData - Edited segment times keyed by service ID then period shortname
 * @param serviceGroups - The service groups to expand across
 * @returns A copy of localData with edits propagated to all services in each group
 */
export const expandGroupedDataToServices = (
    localData: Record<string, Record<string, number[]>>,
    serviceGroups: ServiceGroup[]
): Record<string, Record<string, number[]>> => {
    const expanded = { ...localData };
    for (const group of serviceGroups) {
        const editedServiceId = group.serviceIds.find((id) => expanded[id]);
        if (editedServiceId) {
            for (const otherId of group.serviceIds) {
                if (otherId !== editedServiceId) {
                    expanded[otherId] = { ...expanded[editedServiceId] };
                }
            }
        }
    }
    return expanded;
};
