/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _cloneDeep from 'lodash/cloneDeep';
import { useTranslation } from 'react-i18next';

import Path, { PeriodSegmentData } from 'transition-common/lib/services/path/Path';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

import {
    Checkpoint,
    ResolvedCheckpoint,
    EditMode,
    getCheckpointKey,
    checkpointsOverlap,
    resolveCheckpoints
} from 'transition-common/lib/services/path/PathSegmentTimeUtils';
import { pathGeographyUtils } from 'transition-common/lib/services/path/PathGeographyUtils';
import {
    groupServicesByTravelTimes,
    expandGroupedDataToServices,
    ServiceGroup
} from 'transition-common/lib/services/path/PathServiceGrouping';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

const dayKeyMap: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
};

/** Build a human-readable label for a service group based on its active days. */
const buildGroupLabel = (
    activeDays: string[],
    hasHolidayService: boolean,
    t: (key: string) => string,
    commonName?: string
): string => {
    const prefix = 'transit:transitPath:serviceGroupDays';
    const daysSet = new Set(activeDays);
    const hasAllWeekdays = weekdays.every((d) => daysSet.has(d));
    const hasSaturday = daysSet.has('saturday');
    const hasSunday = daysSet.has('sunday');
    const hasWeekend = hasSaturday && hasSunday;

    const parts: string[] = [];

    if (hasAllWeekdays && hasWeekend) {
        parts.push(t(`${prefix}:EveryDay`));
    } else if (hasAllWeekdays) {
        parts.push(t(`${prefix}:Weekday`));
    } else if (hasWeekend) {
        parts.push(t(`${prefix}:Weekend`));
    } else if (hasSaturday) {
        parts.push(t(`${prefix}:Sat`));
    } else if (hasSunday) {
        parts.push(t(`${prefix}:Sun`));
    }

    if (!hasAllWeekdays) {
        const individualDays = weekdays.filter((d) => daysSet.has(d)).map((d) => t(`${prefix}:${dayKeyMap[d]}`));
        if (individualDays.length > 0) {
            parts.push(individualDays.join('-'));
        }
    }

    if (hasHolidayService) {
        if (parts.length > 0) {
            parts[parts.length - 1] = `${parts[parts.length - 1]}, ${t(`${prefix}:Holiday`)}`;
        } else {
            parts.push(t(`${prefix}:Holiday`));
        }
    }

    const baseLabel = parts.join(', ') || '?';
    if (commonName) {
        return `${baseLabel} ${commonName}`;
    }
    return baseLabel;
};

/** Local editing state: serviceId -> periodShortname -> travelTimeSeconds per segment. */
type LocalSegmentTimes = Record<string, Record<string, number[]>>;

type UseSegmentTimesByPeriodArgs = {
    path: Path;
    onClose: () => void;
};

/**
 * Hook managing all state and logic for the segment times editing modal.
 * Handles per-service/period time overrides, checkpoint distribution, dwell time editing, and saving back to the path.
 */
const useSegmentTimesByPeriod = ({ path, onClose }: UseSegmentTimesByPeriodArgs) => {
    const { t, i18n } = useTranslation('transit');
    const language = i18n.language;
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const segments = path.attributes.data.segments || [];
    const segmentCount = segments.length;

    const line: any = path.getLine();
    const pathId = path.getId();
    // Use services associated to this path via the line's schedules. When no schedule
    // references this path id yet (e.g. a copied path that got a fresh UUID but inherited
    // segmentsByServiceAndPeriod from its parent), fall back to the service ids found in
    // that stored data so the copy surfaces the same services as its original. A brand-new
    // path has no stored data and therefore shows no services until a schedule is attached.
    const pathServiceIds: string[] = line ? line.getScheduleServiceIdsForPathId(pathId) : [];
    const storedServiceIds = Object.keys(path.attributes.data.segmentsByServiceAndPeriod || {});
    const serviceIds: string[] = pathServiceIds.length > 0 ? pathServiceIds : storedServiceIds;
    const servicesCollection = serviceLocator.collectionManager?.get('services');
    const totalPathTime = segments.reduce((sum, s) => sum + s.travelTimeSeconds, 0);

    const [noGrouping, setNoGrouping] = React.useState<boolean>(false);
    const serviceGroups: ServiceGroup[] = React.useMemo(
        () => groupServicesByTravelTimes(path, serviceIds, totalPathTime, servicesCollection, noGrouping),
        [serviceIds.join(','), noGrouping]
    );

    const getGroupLabel = (group: ServiceGroup): string => {
        if (noGrouping) {
            const service = servicesCollection?.getById(group.serviceIds[0]);
            return service ? service.toString(false) : group.serviceIds[0];
        }
        return buildGroupLabel(group.activeDays, group.hasHolidayService, t, group.commonName);
    };

    const serviceChoices = serviceGroups.map((group, index) => ({
        value: String(index),
        label: getGroupLabel(group)
    }));

    const [selectedGroupIndex, setSelectedGroupIndex] = React.useState<string>('0');
    const selectedGroup = serviceGroups[parseInt(selectedGroupIndex, 10)] || serviceGroups[0];
    const selectedServiceId = selectedGroup?.serviceIds[0] || '';
    const [localData, setLocalData] = React.useState<LocalSegmentTimes>(() => {
        const stored = path.attributes.data.segmentsByServiceAndPeriod;
        if (!stored) return {};
        const result: LocalSegmentTimes = {};
        for (const [serviceId, periodEntries] of Object.entries(stored)) {
            result[serviceId] = {};
            for (const [periodShortname, data] of Object.entries(periodEntries)) {
                result[serviceId][periodShortname] = data.segments.map((s) => s.travelTimeSeconds);
            }
        }
        return result;
    });
    const [activeSegmentIndex, setActiveSegmentIndex] = React.useState<number>(0);

    // Checkpoint state — stored by node IDs for stability, resolved to indices for calculations
    const nodeIds: string[] = path.attributes.nodes || [];
    const savedCheckpoints = path.attributes.data.segmentTimesCheckpoints || [];
    const [editMode, setEditMode] = React.useState<EditMode>(savedCheckpoints.length > 0 ? 'checkpoint' : 'segment');
    const [checkpoints, setCheckpoints] = React.useState<Checkpoint[]>(() => {
        // Migrate old format (fromNodeIndex/toNodeIndex) to new format (fromNodeId/toNodeId)
        const raw = _cloneDeep(path.attributes.data.segmentTimesCheckpoints || []);
        return raw
            .map((cp: any) => {
                if (cp.fromNodeId && cp.toNodeId) return cp as Checkpoint;
                // Old format: convert indices to node IDs
                const fromId = nodeIds[cp.fromNodeIndex];
                const toId = nodeIds[cp.toNodeIndex];
                if (fromId && toId) return { fromNodeId: fromId, toNodeId: toId };
                return undefined;
            })
            .filter((cp): cp is Checkpoint => cp !== undefined);
    });
    const resolvedCheckpoints: ResolvedCheckpoint[] = React.useMemo(
        () => resolveCheckpoints(checkpoints, nodeIds),
        [checkpoints, nodeIds]
    );
    const [activeCheckpointIndex, setActiveCheckpointIndex] = React.useState<number>(0);
    const [checkpointTargets, setCheckpointTargets] = React.useState<Record<string, Record<string, number>>>({});
    const [newCheckpointFrom, setNewCheckpointFrom] = React.useState<number>(0);
    const [newCheckpointTo, setNewCheckpointTo] = React.useState<number>(Math.min(2, segmentCount));

    // Compute allowed range for new checkpoint endpoints based on existing checkpoints
    const sortedResolved = React.useMemo(
        () => [...resolvedCheckpoints].sort((a, b) => a.fromNodeIndex - b.fromNodeIndex),
        [resolvedCheckpoints]
    );
    const nextCheckpointAfterFrom = sortedResolved.find((cp) => cp.fromNodeIndex > newCheckpointFrom);
    const newCheckpointMaxTo = nextCheckpointAfterFrom ? nextCheckpointAfterFrom.fromNodeIndex : segmentCount;
    const isNodeInsideCheckpoint = React.useCallback(
        (idx: number) => sortedResolved.some((cp) => cp.fromNodeIndex < idx && idx < cp.toNodeIndex),
        [sortedResolved]
    );

    // Clamp "to" when maxTo shrinks (e.g. "from" moved before an existing checkpoint)
    React.useEffect(() => {
        if (newCheckpointTo > newCheckpointMaxTo) {
            setNewCheckpointTo(newCheckpointMaxTo);
        }
    }, [newCheckpointMaxTo, newCheckpointTo]);

    const collectPeriodsWithTripsForGroup = (group: ServiceGroup | undefined): any[] => {
        const periodsByShortname = new Map<string, any>();
        const groupServiceIds = group?.serviceIds || [];
        for (const serviceId of groupServiceIds) {
            const groupSchedule = line ? line.getSchedule(serviceId) : undefined;
            const schedulePeriods = groupSchedule?.attributes?.periods || [];
            for (const period of schedulePeriods) {
                const shortname = period.period_shortname || '';
                if (period.trips && period.trips.length > 0 && !periodsByShortname.has(shortname)) {
                    periodsByShortname.set(shortname, period);
                }
            }
        }
        return Array.from(periodsByShortname.values());
    };

    const buildPeriodChoice = (period: any) => ({
        shortname: period.period_shortname || '',
        name: {
            [language]: `${period.period_shortname || '?'} (${period.start_at_hour}h-${period.end_at_hour}h)`
        }
    });

    const periods = collectPeriodsWithTripsForGroup(selectedGroup)
        .sort((a, b) => a.start_at_hour - b.start_at_hour)
        .map(buildPeriodChoice);

    // Get node names for segment labels
    let nodeGeojsons: GeoJSON.Feature<GeoJSON.Point>[] = [];
    try {
        nodeGeojsons = path.nodesGeojsons();
    } catch {
        // collectionManager not available
    }
    const getNodeLabel = (index: number): string => {
        if (nodeGeojsons[index]) {
            const nodeProps = nodeGeojsons[index].properties as NodeAttributes;
            const label = nodeProps.name || nodeProps.shortname || nodeProps.code;
            return label ? String(label) : String(index + 1);
        }
        return String(index + 1);
    };

    const nodeLabels = Array.from({ length: segmentCount + 1 }, (_, i) => `${i + 1}- ${getNodeLabel(i).toUpperCase()}`);
    const nodeChoices = nodeLabels.map((label, idx) => ({ value: String(idx), label }));

    // Get the default time for a segment in a period (from trip averages, fallback to routing time)
    const getDefaultTime = (segmentIndex: number, periodShortname: string): number => {
        const avgTime = selectedGroup?.averageTimesByPeriod[periodShortname]?.[segmentIndex];
        return avgTime !== undefined ? avgTime : segments[segmentIndex].travelTimeSeconds;
    };

    // Segment helpers
    const getTimeForCell = (segmentIndex: number, periodShortname: string): number => {
        const override = localData[selectedServiceId]?.[periodShortname]?.[segmentIndex];
        return override !== undefined ? override : getDefaultTime(segmentIndex, periodShortname);
    };

    const handleCellChange = React.useCallback(
        (segmentIndex: number, periodShortname: string, newSeconds: number) => {
            setLocalData((prev) => {
                const prevService = prev[selectedServiceId] || {};
                const prevPeriod =
                    prevService[periodShortname] || segments.map((_, i) => getDefaultTime(i, periodShortname));
                const updatedPeriod = [...prevPeriod];
                updatedPeriod[segmentIndex] = newSeconds;
                return {
                    ...prev,
                    [selectedServiceId]: {
                        ...prevService,
                        [periodShortname]: updatedPeriod
                    }
                };
            });
        },
        [selectedServiceId, segments, selectedGroup]
    );

    const isSegmentInAnyCheckpoint = (segIdx: number): boolean =>
        resolvedCheckpoints.some((checkpoint) => segIdx >= checkpoint.fromNodeIndex && segIdx < checkpoint.toNodeIndex);

    const getAverageTotal = (): number => segments.reduce((sum, s) => sum + s.travelTimeSeconds, 0);

    const getPeriodTotal = (periodShortname: string): number => {
        const periodTimes = localData[selectedServiceId]?.[periodShortname];
        if (!periodTimes) {
            const avgTimes = selectedGroup?.averageTimesByPeriod[periodShortname];
            return avgTimes ? avgTimes.reduce((sum, val) => sum + val, 0) : getAverageTotal();
        }
        return periodTimes.reduce((sum, val) => sum + val, 0);
    };

    // Checkpoint helpers (use ResolvedCheckpoint for index-based calculations)
    const getCheckpointCurrentTotal = (checkpoint: ResolvedCheckpoint, periodShortname: string): number => {
        let total = 0;
        for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
            total += getTimeForCell(i, periodShortname);
        }
        return total;
    };

    const getCheckpointAverageTotal = (checkpoint: ResolvedCheckpoint): number => {
        let total = 0;
        for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
            total += segments[i].travelTimeSeconds;
        }
        return total;
    };

    /** Get the total dwell (stop) time for all nodes within a checkpoint span */
    const getCheckpointTotalDwellTime = (checkpoint: ResolvedCheckpoint): number => {
        let total = 0;
        for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
            total += getDwellTimeForSegment(i);
        }
        return total;
    };

    const getCheckpointTargetKey = (checkpoint: ResolvedCheckpoint): string =>
        `${getCheckpointKey(checkpoint)}_${selectedServiceId}`;

    const getCheckpointTarget = (checkpoint: ResolvedCheckpoint, periodShortname: string): number => {
        const key = getCheckpointTargetKey(checkpoint);
        return checkpointTargets[key]?.[periodShortname] ?? getCheckpointCurrentTotal(checkpoint, periodShortname);
    };

    const setCheckpointTarget = (checkpoint: ResolvedCheckpoint, periodShortname: string, value: number) => {
        const key = getCheckpointTargetKey(checkpoint);
        setCheckpointTargets((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [periodShortname]: value
            }
        }));
    };

    const distributeCheckpointForService = (
        data: Record<string, Record<string, number[]>>,
        serviceId: string,
        checkpoint: ResolvedCheckpoint,
        osrmTimes: number[] | null,
        targetTimesByPeriod: Record<string, number>
    ) => {
        if (!data[serviceId]) {
            data[serviceId] = {};
        }

        for (const [periodShortname, targetTotalSeconds] of Object.entries(targetTimesByPeriod)) {
            if (!data[serviceId][periodShortname]) {
                data[serviceId][periodShortname] = segments.map((_, i) => getDefaultTime(i, periodShortname));
            }

            // Skip periods where the target matches the current total
            const currentTotal = getCheckpointCurrentTotal(checkpoint, periodShortname);
            if (currentTotal === targetTotalSeconds) continue;

            let scaledSegmentTimesSeconds: number[] | null = null;
            if (osrmTimes) {
                scaledSegmentTimesSeconds = pathGeographyUtils.scaleTimesToTarget(osrmTimes, targetTotalSeconds);
            }

            if (!scaledSegmentTimesSeconds) {
                // Fallback: distribute evenly if OSRM fails
                const segmentCount = checkpoint.toNodeIndex - checkpoint.fromNodeIndex;
                const timePerSegmentSeconds = Math.floor(targetTotalSeconds / segmentCount);
                const remainderSeconds = targetTotalSeconds - timePerSegmentSeconds * segmentCount;
                scaledSegmentTimesSeconds = Array.from(
                    { length: segmentCount },
                    (_, i) => timePerSegmentSeconds + (i < remainderSeconds ? 1 : 0)
                );
            }

            for (let i = 0; i < scaledSegmentTimesSeconds.length; i++) {
                data[serviceId][periodShortname][checkpoint.fromNodeIndex + i] = scaledSegmentTimesSeconds[i];
            }
        }
    };

    const handleDistribute = async (checkpoint: ResolvedCheckpoint) => {
        const key = getCheckpointTargetKey(checkpoint);
        const targetTimesByPeriod = checkpointTargets[key];
        if (!targetTimesByPeriod) return;

        const osrmTimes = await pathGeographyUtils.calculateSegmentTimesForCheckpoint(
            path,
            checkpoint.fromNodeIndex,
            checkpoint.toNodeIndex
        );

        setLocalData((previousLocalData) => {
            const updatedLocalData = _cloneDeep(previousLocalData);
            distributeCheckpointForService(
                updatedLocalData,
                selectedServiceId,
                checkpoint,
                osrmTimes,
                targetTimesByPeriod
            );
            return updatedLocalData;
        });
    };

    const addCheckpoint = () => {
        if (newCheckpointFrom >= newCheckpointTo) return;
        const newResolved: ResolvedCheckpoint = {
            fromNodeId: nodeIds[newCheckpointFrom],
            toNodeId: nodeIds[newCheckpointTo],
            fromNodeIndex: newCheckpointFrom,
            toNodeIndex: newCheckpointTo
        };
        const overlaps = resolvedCheckpoints.some((checkpoint) => checkpointsOverlap(checkpoint, newResolved));
        if (overlaps) return;
        const newCheckpoint: Checkpoint = {
            fromNodeId: nodeIds[newCheckpointFrom],
            toNodeId: nodeIds[newCheckpointTo]
        };
        setCheckpoints((prev) => [...prev, newCheckpoint]);
        setActiveCheckpointIndex(checkpoints.length);
        setEditMode('checkpoint');
    };

    const removeCheckpoint = (index: number) => {
        const resolved = resolvedCheckpoints[index];
        if (!resolved) return;
        const key = getCheckpointKey(resolved);
        // Find and remove the matching checkpoint from the stored array by node IDs
        setCheckpoints((prev) =>
            prev.filter((cp) => cp.fromNodeId !== resolved.fromNodeId || cp.toNodeId !== resolved.toNodeId)
        );
        setCheckpointTargets((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setActiveCheckpointIndex((prev) => Math.max(0, Math.min(prev, resolvedCheckpoints.length - 2)));
        if (resolvedCheckpoints.length <= 1) {
            setEditMode('segment');
        }
    };

    const handleSave = async () => {
        // Auto-distribute undistributed checkpoint targets for all groups.
        // OSRM times are calculated once per checkpoint and reused across groups.
        const updatedLocalData = _cloneDeep(localData);
        for (const checkpoint of resolvedCheckpoints) {
            // Check if any group has targets that differ from current totals before calling OSRM
            const hasChangedTargets = serviceGroups.some((group) => {
                const targetKey = `${getCheckpointKey(checkpoint)}_${group.serviceIds[0]}`;
                const targets = checkpointTargets[targetKey];
                if (!targets) return false;
                return Object.entries(targets).some(
                    ([periodShortname, targetSeconds]) =>
                        getCheckpointCurrentTotal(checkpoint, periodShortname) !== targetSeconds
                );
            });
            if (!hasChangedTargets) continue;

            const osrmTimes = await pathGeographyUtils.calculateSegmentTimesForCheckpoint(
                path,
                checkpoint.fromNodeIndex,
                checkpoint.toNodeIndex
            );

            for (const group of serviceGroups) {
                const representativeServiceId = group.serviceIds[0];
                const targetKey = `${getCheckpointKey(checkpoint)}_${representativeServiceId}`;
                const targetTimesByPeriod = checkpointTargets[targetKey];
                if (!targetTimesByPeriod) continue;
                distributeCheckpointForService(
                    updatedLocalData,
                    representativeServiceId,
                    checkpoint,
                    osrmTimes,
                    targetTimesByPeriod
                );
            }
        }
        setLocalData(updatedLocalData);

        const expandedData = expandGroupedDataToServices(updatedLocalData, serviceGroups);
        const baseSegments = path.attributes.data.segments || [];
        const baseDwell = localDwellTimes;

        // Convert local flat times back to segmentsByServiceAndPeriod format
        const result: Record<string, Record<string, PeriodSegmentData>> = {};
        for (const [serviceId, periodEntries] of Object.entries(expandedData)) {
            for (const [periodShortname, times] of Object.entries(periodEntries)) {
                if (!times || times.length === 0) continue;
                if (!result[serviceId]) result[serviceId] = {};
                const segmentData: PeriodSegmentData['segments'] = times.map((t, i) => ({
                    travelTimeSeconds: t,
                    distanceMeters: baseSegments[i]?.distanceMeters ?? null
                }));
                const travelTotal = times.reduce((sum, t) => sum + t, 0);
                const dwellTotal = baseDwell.reduce((sum, d) => sum + d, 0);
                const distTotal = baseSegments.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);
                result[serviceId][periodShortname] = {
                    segments: segmentData,
                    dwellTimeSeconds: baseDwell,
                    travelTimeWithoutDwellTimesSeconds: travelTotal,
                    operatingTimeWithoutLayoverTimeSeconds: travelTotal + dwellTotal,
                    averageSpeedWithoutDwellTimesMetersPerSecond:
                        travelTotal > 0 ? Math.round((distTotal / travelTotal) * 100) / 100 : 0,
                    operatingSpeedMetersPerSecond:
                        travelTotal + dwellTotal > 0
                            ? Math.round((distTotal / (travelTotal + dwellTotal)) * 100) / 100
                            : 0,
                    tripCount: 0
                };
            }
        }
        path.set('data.segmentsByServiceAndPeriod', Object.keys(result).length > 0 ? result : undefined);
        path.set('data.segmentTimesCheckpoints', checkpoints.length > 0 ? checkpoints : undefined);
        path.set('data.dwellTimeSeconds', localDwellTimes);

        onClose();
    };

    const hasLengthMismatch = (): boolean => {
        const groupData = localData[selectedServiceId];
        if (!groupData) return false;
        return Object.values(groupData).some((times: number[]) => times.length !== segmentCount);
    };

    // Dwell and arrival time helpers.
    // Initialize from path's stored dwellTimeSeconds; for any missing entry,
    // fall back to the node's default_dwell_time_seconds.
    const [localDwellTimes, setLocalDwellTimes] = React.useState<number[]>(() => {
        const storedDwellTimes = path.attributes.data.dwellTimeSeconds || [];
        const pathNodeIds = (path.attributes.nodes || []) as string[];
        const nodesCollection = path.collectionManager?.get('nodes');
        return pathNodeIds.map((nodeId, index) => {
            if (storedDwellTimes[index] !== undefined) return storedDwellTimes[index];
            if (index === 0) return 0;
            const node = nodesCollection?.getById(nodeId);
            return node?.properties?.default_dwell_time_seconds ?? 0;
        });
    });

    /** Get the dwell (stop) time at the departure node of a segment */
    const getDwellTimeForSegment = (segmentIndex: number): number => {
        return localDwellTimes[segmentIndex] || 0;
    };

    /** Update the dwell (stop) time at the departure node of a segment.
     *  First segment (index 0) is always 0 (layover is separate). */
    const setDwellTimeForSegment = (segmentIndex: number, newSeconds: number) => {
        if (segmentIndex === 0) return;
        setLocalDwellTimes((prev) => {
            const next = [...prev];
            next[segmentIndex] = newSeconds;
            return next;
        });
    };

    /** Get the cumulative arrival time at a node for a given period.
     *  Sums all dwell times + segment times from the start up to (but not including) the given segment. */
    const getArrivalTimeAtSegment = (segmentIndex: number, periodShortname: string): number => {
        let cumulativeTime = 0;
        for (let i = 0; i < segmentIndex; i++) {
            cumulativeTime += getDwellTimeForSegment(i) + getTimeForCell(i, periodShortname);
        }
        return cumulativeTime;
    };

    /** Departure time = arrival at this node + dwell time at this node */
    const getDepartureTimeAtSegment = (segmentIndex: number, periodShortname: string): number => {
        return getArrivalTimeAtSegment(segmentIndex, periodShortname) + getDwellTimeForSegment(segmentIndex);
    };

    /** Arrival time at the end of a segment = departure + segment travel time */
    const getArrivalTimeAfterSegment = (segmentIndex: number, periodShortname: string): number => {
        return getDepartureTimeAtSegment(segmentIndex, periodShortname) + getTimeForCell(segmentIndex, periodShortname);
    };

    /** Average arrival time at the end of a segment (using base segment times) */
    const getAverageArrivalTimeAfterSegment = (segmentIndex: number): number => {
        let cumulativeTime = 0;
        for (let i = 0; i <= segmentIndex; i++) {
            cumulativeTime += (localDwellTimes[i] || 0) + segments[i].travelTimeSeconds;
        }
        return cumulativeTime;
    };

    // Navigation — wrapped in startTransition so the UI stays responsive during re-renders
    const goToPrevSegment = () =>
        React.startTransition(() => setActiveSegmentIndex((prev) => Math.max(0, prev - 1)));
    const goToNextSegment = () =>
        React.startTransition(() => setActiveSegmentIndex((prev) => Math.min(segmentCount - 1, prev + 1)));
    const goToPrevCheckpoint = () =>
        React.startTransition(() => setActiveCheckpointIndex((prev) => Math.max(0, prev - 1)));
    const goToNextCheckpoint = () =>
        React.startTransition(() => setActiveCheckpointIndex((prev) => Math.min(resolvedCheckpoints.length - 1, prev + 1)));

    const handleSegmentClick = (idx: number) => {
        React.startTransition(() => {
            setActiveSegmentIndex(idx);
            setEditMode('segment');
        });
    };

    const handleCheckpointClick = (idx: number) => {
        React.startTransition(() => {
            setActiveCheckpointIndex(idx);
            setEditMode('checkpoint');
        });
    };

    const activeCheckpoint = resolvedCheckpoints[activeCheckpointIndex];

    return {
        // Derived data
        segments,
        segmentCount,
        periods,
        serviceChoices,
        nodeLabels,
        nodeChoices,

        // State
        selectedGroupIndex,
        setSelectedGroupIndex,
        noGrouping,
        setNoGrouping,
        activeSegmentIndex,
        editMode,
        checkpoints: resolvedCheckpoints,
        activeCheckpointIndex,
        activeCheckpoint,
        newCheckpointFrom,
        newCheckpointTo,
        newCheckpointMaxTo,
        isNodeInsideCheckpoint,
        setNewCheckpointFrom,
        setNewCheckpointTo,

        // Segment handlers
        getTimeForCell,
        handleCellChange,
        isSegmentInAnyCheckpoint,
        getAverageTotal,
        getPeriodTotal,
        getDwellTimeForSegment,
        setDwellTimeForSegment,
        getDepartureTimeAtSegment,
        getArrivalTimeAfterSegment,
        getAverageArrivalTimeAfterSegment,

        // Checkpoint handlers
        getCheckpointCurrentTotal,
        getCheckpointAverageTotal,
        getCheckpointTotalDwellTime,
        getCheckpointTarget,
        setCheckpointTarget,
        handleDistribute,
        addCheckpoint,
        removeCheckpoint,

        // Navigation
        goToPrevSegment,
        goToNextSegment,
        goToPrevCheckpoint,
        goToNextCheckpoint,
        handleSegmentClick,
        handleCheckpointClick,

        // Save
        handleSave,
        hasLengthMismatch
    };
};

export default useSegmentTimesByPeriod;
