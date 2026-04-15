/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { ServiceGroup } from 'transition-common/lib/services/path/PathServiceGrouping';

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
 * Assigns commonName to groups that share the same day-pattern signature with
 * at least one other group (so the user can distinguish them). Groups with a
 * unique base label are left with commonName undefined. Tokens are chosen to
 * be present in the group's service names but absent from sibling groups.
 */
export const assignCommonNamesForDuplicates = (groups: ServiceGroup[], servicesCollection: any): void => {
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
