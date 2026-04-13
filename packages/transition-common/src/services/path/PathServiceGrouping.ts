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
    /** Days of the week covered by the services in this group */
    activeDays: string[];
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
        groupNames.every((name) => name.includes(candidate)) && !otherNames.some((name) => name.includes(candidate));

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
 * Read the stored per-segment travel times for a service from the path's
 * segmentsByServiceAndPeriod cache. The values were averaged upstream (at GTFS
 * import time or when the segment times modal was saved)
 *
 * @param path - The path object (provides segmentsByServiceAndPeriod)
 * @param serviceId - The service ID to look up
 * @returns Record keyed by period shortname, each value is the array of stored
 * segment travel times for that period. Returns an empty object if the service
 * has no stored data on this path.
 */
const getAverageSegmentTimesByPeriod = (path: Path, serviceId: string): Record<string, number[]> => {
    const serviceData = path.attributes.data.segmentsByServiceAndPeriod?.[serviceId];
    if (!serviceData) return {};

    const result: Record<string, number[]> = {};
    for (const [shortname, periodData] of Object.entries(serviceData)) {
        if (!periodData?.segments) continue;
        result[shortname] = periodData.segments.map((segment) => segment.travelTimeSeconds);
    }
    return result;
};

/**
 * Return the list of day-of-week keys for which the service has its flag set to true.
 */
const getServiceActiveDays = (service: any): string[] => {
    if (!service) return [];
    return allDayKeys.filter((day) => service.get(day));
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
 * Group services by their travel time similarity.
 * Services with the same bucketed total per period get the same key.
 *
 * @param serviceIds - Service IDs to group
 * @param path - The path object (provides segments data)
 * @param tolerance - Bucketing tolerance in seconds
 *
 * @returns Record keyed by travel time key, each value is an array of service IDs
 */
const groupServicesByTravelTimeKey = (
    serviceIds: string[],
    path: Path,
    tolerance: number
): Record<string, string[]> => {
    const groups: Record<string, string[]> = {};
    for (const serviceId of serviceIds) {
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
const computeGroupCommonName = (groupNames: string[], otherGroupsNames: string[]): string | undefined => {
    if (groupNames.length < 2) return undefined;
    return findDistinguishingToken(groupNames, otherGroupsNames);
};

/**
 * Build the final ServiceGroup array from grouped service IDs.
 * Aggregates active days across each group's services and computes average times per period.
 *
 * @param serviceGroups - Record keyed by travel time key, each value is an array of service IDs
 * @param path - The path object (provides segments data)
 * @param servicesCollection - Collection to look up service attributes (days)
 * @returns Array of ServiceGroup objects
 */
const buildServiceGroups = (
    serviceGroups: Record<string, string[]>,
    path: Path,
    servicesCollection: any
): ServiceGroup[] => {
    return Object.values(serviceGroups).map((ids): ServiceGroup => {
        const activeDaysSet = new Set<string>();
        for (const serviceId of ids) {
            const service = servicesCollection?.getById(serviceId);
            getServiceActiveDays(service).forEach((d) => activeDaysSet.add(d));
        }
        return {
            serviceIds: ids,
            activeDays: [...activeDaysSet],
            averageTimesByPeriod: getAverageSegmentTimesByPeriod(path, ids[0])
        };
    });
};

/**
 * Assigns commonName to groups that share the same day-pattern signature with
 * at least one other group (so the user can distinguish them). Groups with a
 * unique base label are left with commonName undefined. Tokens are chosen to
 * be present in the group's service names but absent from sibling groups.
 */
const assignCommonNamesForDuplicates = (groups: ServiceGroup[], servicesCollection: any): void => {
    const buildSignature = (group: ServiceGroup) => [...group.activeDays].sort().join(',');

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
            const otherNames = namesByGroupIndex.filter((_, index) => index !== i).flat();
            bucket[i].commonName = computeGroupCommonName(namesByGroupIndex[i], otherNames);
        }
    }
};

/**
 * Build a single-service ServiceGroup for a serviceId, bypassing any grouping.
 * Used for services that cannot or should not be grouped with others (e.g. when
 * grouping is disabled, or when a service has no day-of-week flags and is thus
 * not comparable on a recurring-day basis).
 *
 * @param path - The path object (provides segments data)
 * @param serviceId - The service to wrap in its own group
 * @param servicesCollection - Collection to look up the service's day flags
 * @returns A ServiceGroup containing only this service
 */
const buildSingletonGroup = (path: Path, serviceId: string, servicesCollection: any): ServiceGroup => {
    const service = servicesCollection?.getById(serviceId);
    return {
        serviceIds: [serviceId],
        activeDays: getServiceActiveDays(service),
        averageTimesByPeriod: getAverageSegmentTimesByPeriod(path, serviceId)
    };
};

/**
 * Group services by average travel times for a path. Services with similar
 * total travel times (within 1% tolerance) per period are grouped together,
 * and groups whose period signature is a subset of another group's signature
 * are merged into it. Services that have no day-of-week flags set (e.g.
 * calendar_dates-only GTFS services) are not grouped and each become their
 * own single-service group.
 *
 * When `periodsGroupByServiceId` is provided, services are first partitioned
 * by their schedule's periods group shortname: services belonging to different
 * periods groups are never grouped together, even if their travel time
 * fingerprints happen to match or be a subset of one another. This prevents
 * cross-periods-group merges when period shortnames collide between groups.
 *
 * Each group includes the aggregated active days and average segment times per
 * period.
 *
 * @param path - The path object (provides segments data)
 * @param serviceIds - All service IDs to consider for grouping
 * @param totalPathTime - Total path travel time in seconds (used to compute the 1% tolerance)
 * @param servicesCollection - Collection to look up service attributes (day flags, name)
 * @param noGrouping - When true, bypass grouping and return one singleton group per service
 * @param periodsGroupByServiceId - Optional map from serviceId to the periods_group_shortname
 * of its schedule. When provided, services with different periods groups stay in
 * separate buckets and are never merged together.
 * @returns Array of service groups with their active days and average times
 */
export const groupServicesByTravelTimes = (
    path: Path,
    serviceIds: string[],
    totalPathTime: number,
    servicesCollection: any,
    noGrouping: boolean = false,
    periodsGroupByServiceId?: Record<string, string | undefined>
): ServiceGroup[] => {
    if (noGrouping) {
        return serviceIds.map((serviceId) => buildSingletonGroup(path, serviceId, servicesCollection));
    }

    const tolerance = Math.max(1, totalPathTime * 0.01);

    // Partition groupable services by their schedule's periods group shortname so
    // that services on different periods groups (e.g. default vs extended_morning_peak)
    // are never considered for merging together, even if their keys happen to overlap.
    // Services with no day flags or no segment data stay as singletons.
    const serviceIdsByPeriodsGroup = new Map<string, string[]>();
    const ungroupedSingletons: ServiceGroup[] = [];
    for (const serviceId of serviceIds) {
        const service = servicesCollection?.getById(serviceId);
        const hasDays = getServiceActiveDays(service).length > 0;
        const hasFingerprint = hasDays && getServiceTravelTimeKey(path, serviceId, tolerance) !== '';
        if (!hasFingerprint) {
            ungroupedSingletons.push(buildSingletonGroup(path, serviceId, servicesCollection));
            continue;
        }
        const periodsGroup = periodsGroupByServiceId?.[serviceId] ?? '';
        const serviceIdsForPeriodsGroup = serviceIdsByPeriodsGroup.get(periodsGroup) ?? [];
        serviceIdsForPeriodsGroup.push(serviceId);
        serviceIdsByPeriodsGroup.set(periodsGroup, serviceIdsForPeriodsGroup);
    }

    const groups: ServiceGroup[] = [];
    for (const serviceIds of serviceIdsByPeriodsGroup.values()) {
        const serviceGroupsByKey = groupServicesByTravelTimeKey(serviceIds, path, tolerance);
        mergeServicesWithSubsetPeriods(serviceGroupsByKey);
        groups.push(...buildServiceGroups(serviceGroupsByKey, path, servicesCollection));
    }
    groups.push(...ungroupedSingletons);
    assignCommonNamesForDuplicates(groups, servicesCollection);
    return groups;
};

/**
 * Expand grouped segment time overrides to all services in each group.
 * When saving, edits made on the representative service of a group are
 * propagated to the other services in the same group — but only for
 * periods that those services already had in their original data.
 * Periods that exist only on the representative (e.g. when a smaller
 * service was merged into a superset via mergeServicesWithSubsetPeriods)
 * are not injected into services that never had them.
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
        if (!editedServiceId) continue;
        const editedEntries = expanded[editedServiceId];
        for (const otherId of group.serviceIds) {
            if (otherId === editedServiceId) continue;
            const existing = expanded[otherId];
            if (!existing) continue;
            const merged: Record<string, number[]> = {};
            for (const period of Object.keys(existing)) {
                merged[period] = editedEntries[period] ? [...editedEntries[period]] : existing[period];
            }
            expanded[otherId] = merged;
        }
    }
    return expanded;
};
