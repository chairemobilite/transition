/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _cloneDeep from 'lodash/cloneDeep';
import { useTranslation } from 'react-i18next';

import Path from 'transition-common/lib/services/path/Path';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

import {
    Checkpoint,
    ResolvedCheckpoint,
    EditMode,
    LocalSegmentTimes,
    getCheckpointKey,
    checkpointsOverlap,
    resolveCheckpoints,
    distributeCheckpointForService,
    applyPendingCheckpointDistributions,
    buildSegmentsByServiceAndPeriod
} from 'transition-common/lib/services/path/PathSegmentTimeUtils';
import { pathGeographyUtils } from 'transition-common/lib/services/path/PathGeographyUtils';
import {
    groupServicesByTravelTimes,
    expandGroupedDataToServices,
    ServiceGroup
} from 'transition-common/lib/services/path/PathServiceGrouping';

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

const dayKeyMap: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun'
};

/** Build a human-readable label for a service group based on its active days. */
const buildGroupLabel = (activeDays: string[], t: (key: string) => string, commonName?: string): string => {
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

    const baseLabel = parts.join(', ') || '?';
    if (commonName) {
        return `${baseLabel} ${commonName}`;
    }
    return baseLabel;
};

/** Local editing state: serviceId -> periodShortname -> travelTimeSeconds per segment. */

type UseSegmentTimesByPeriodArgs = {
    path: Path;
    onClose: () => void;
};

/**
 * Hook managing all state and logic for the segment times editing modal.
 *
 * Kept as a single hook because `handleSave` needs to see everything (localData,
 * localDwellTimes, checkpoints, serviceGroups) to build the payload written back to
 * the path, and localData is also shared between cell-by-cell editing and checkpoint
 * distribution. Splitting would force this state into a Context or lifted to the
 * parent, which hides the coupling without removing it. Returns are grouped by
 * feature (pathDisplay, serviceSelection, navigation, segmentEdit, checkpointEdit,
 * save)
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
    const periodsGroupByServiceId: Record<string, string | undefined> = React.useMemo(() => {
        const map: Record<string, string | undefined> = {};
        if (!line) return map;
        for (const serviceId of serviceIds) {
            const schedule = line.getSchedule(serviceId);
            map[serviceId] = schedule?.attributes?.periods_group_shortname ?? undefined;
        }
        return map;
    }, [serviceIds.join(','), line]);
    const serviceGroups: ServiceGroup[] = React.useMemo(
        () =>
            groupServicesByTravelTimes(
                path,
                serviceIds,
                totalPathTime,
                servicesCollection,
                noGrouping,
                periodsGroupByServiceId
            ),
        [serviceIds.join(','), noGrouping, periodsGroupByServiceId]
    );

    const getGroupLabel = (group: ServiceGroup): string => {
        if (noGrouping || group.serviceIds.length === 1) {
            const service = servicesCollection?.getById(group.serviceIds[0]);
            return service ? service.toString(false) : group.serviceIds[0];
        }
        return buildGroupLabel(group.activeDays, t, group.commonName);
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

    const periodNamesByShortname: Record<string, string> = React.useMemo(() => {
        const map: Record<string, string> = {};
        const periodsGroups = Preferences.get('transit.periods') || {};
        for (const group of Object.values(periodsGroups) as any[]) {
            for (const p of group.periods || []) {
                if (p.shortname && p.name?.[language]) {
                    map[p.shortname] = p.name[language];
                }
            }
        }
        return map;
    }, [language]);

    const periods = collectPeriodsWithTripsForGroup(selectedGroup)
        .sort((a, b) => a.start_at_hour - b.start_at_hour)
        .map((period: any) => {
            const shortname = period.period_shortname || '';
            return {
                shortname,
                name: {
                    [language]:
                        periodNamesByShortname[shortname] ||
                        `${shortname} (${period.start_at_hour}h-${period.end_at_hour}h)`
                }
            };
        });

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

    // Checkpoint helpers (use ResolvedCheckpoint for index-based calculations)
    const getCheckpointCurrentTotal = (checkpoint: ResolvedCheckpoint, periodShortname: string): number => {
        let total = 0;
        for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
            total += getTimeForCell(i, periodShortname);
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

    const handleDistribute = async (checkpoint: ResolvedCheckpoint) => {
        const key = getCheckpointTargetKey(checkpoint);
        const targetTimesByPeriod = checkpointTargets[key];
        if (!targetTimesByPeriod) return;

        const osrmTimes = await pathGeographyUtils.calculateSegmentTimesForCheckpoint(
            path,
            checkpoint.fromNodeIndex,
            checkpoint.toNodeIndex
        );

        if (!selectedGroup) return;
        setLocalData((previousLocalData) => {
            const updatedLocalData = _cloneDeep(previousLocalData);
            distributeCheckpointForService({
                data: updatedLocalData,
                group: selectedGroup,
                checkpoint,
                osrmTimes,
                targetTimesByPeriod,
                baseSegments: segments
            });
            return updatedLocalData;
        });
    };

    const addCheckpoint = (fromNodeIndex: number, toNodeIndex: number) => {
        if (fromNodeIndex >= toNodeIndex) return;
        const newResolved: ResolvedCheckpoint = {
            fromNodeId: nodeIds[fromNodeIndex],
            toNodeId: nodeIds[toNodeIndex],
            fromNodeIndex,
            toNodeIndex
        };
        const overlaps = resolvedCheckpoints.some((checkpoint) => checkpointsOverlap(checkpoint, newResolved));
        if (overlaps) return;
        const newCheckpoint: Checkpoint = {
            fromNodeId: nodeIds[fromNodeIndex],
            toNodeId: nodeIds[toNodeIndex]
        };
        // Insert the new checkpoint in chronological order along the path so the array
        // stays sorted by fromNodeIndex and the navigation arrows move through
        // checkpoints in the same order the user sees them on the line overview.
        const nextCheckpointIndex = resolvedCheckpoints.findIndex((cp) => cp.fromNodeIndex > fromNodeIndex);
        const insertIndex = nextCheckpointIndex === -1 ? resolvedCheckpoints.length : nextCheckpointIndex;
        setCheckpoints((prev) =>
            insertIndex >= prev.length
                ? [...prev, newCheckpoint]
                : [...prev.slice(0, insertIndex), newCheckpoint, ...prev.slice(insertIndex)]
        );
        setActiveCheckpointIndex(insertIndex);
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
        setSaveError(null);
        try {
            const updatedLocalData = _cloneDeep(localData);
            await applyPendingCheckpointDistributions({
                dataToUpdate: updatedLocalData,
                path,
                resolvedCheckpoints,
                serviceGroups,
                checkpointTargets
            });
            setLocalData(updatedLocalData);

            const expandedData = expandGroupedDataToServices(updatedLocalData, serviceGroups);
            const segmentsByServiceAndPeriod = buildSegmentsByServiceAndPeriod({
                expandedData,
                path,
                dwellTimes: localDwellTimes
            });

            path.set(
                'data.segmentsByServiceAndPeriod',
                Object.keys(segmentsByServiceAndPeriod).length > 0 ? segmentsByServiceAndPeriod : undefined
            );
            path.set('data.segmentTimesCheckpoints', checkpoints.length > 0 ? checkpoints : undefined);
            path.set('data.dwellTimeSeconds', localDwellTimes);
            path.updateBaseFromServicePeriodData();

            onClose();
        } catch (error) {
            console.error('Error saving segment times:', error);
            setSaveError((error as Error).message || 'An error occurred while saving segment times.');
        }
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

    // Navigation — wrapped in startTransition so the UI stays responsive during re-renders
    const goToPrevSegment = () => React.startTransition(() => setActiveSegmentIndex((prev) => Math.max(0, prev - 1)));
    const goToNextSegment = () =>
        React.startTransition(() => setActiveSegmentIndex((prev) => Math.min(segmentCount - 1, prev + 1)));
    const goToPrevCheckpoint = () =>
        React.startTransition(() => setActiveCheckpointIndex((prev) => Math.max(0, prev - 1)));
    const goToNextCheckpoint = () =>
        React.startTransition(() =>
            setActiveCheckpointIndex((prev) => Math.min(resolvedCheckpoints.length - 1, prev + 1))
        );

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
        // Derived display data from the path: references the sub-components use
        // to render the labels, period list, and segment count.
        pathDisplay: {
            segmentCount,
            periods,
            nodeLabels,
            nodeChoices
        },
        // Service/group selection UI. The selected group drives which period set is edited
        // and which service's data gets written back to the path on save.
        serviceSelection: {
            serviceChoices,
            selectedGroupIndex,
            setSelectedGroupIndex,
            noGrouping,
            setNoGrouping
        },
        // Navigation between segments and checkpoints inside the modal. Mutates
        // activeSegmentIndex / activeCheckpointIndex / editMode, which are all shared
        // across multiple sub-components (overview, carousel, tables) so they must live
        // in the hook rather than in any individual sub-component.
        navigation: {
            activeSegmentIndex,
            activeCheckpointIndex,
            activeCheckpoint,
            editMode,
            goToPrevSegment,
            goToNextSegment,
            goToPrevCheckpoint,
            goToNextCheckpoint,
            handleSegmentClick,
            handleCheckpointClick
        },
        // Per-segment editing and read helpers. All of these ultimately read or write
        // localData and must stay here because localData is shared with the checkpoint
        // distribution flow and with handleSave.
        segmentEdit: {
            getTimeForCell,
            handleCellChange,
            isSegmentInAnyCheckpoint,
            getDwellTimeForSegment,
            setDwellTimeForSegment,
            getDepartureTimeAtSegment,
            getArrivalTimeAfterSegment
        },
        // Checkpoint editing and the calculated totals per period. `checkpoints` is the
        // resolved (index-based) form used for all checkpoint-based calculations.
        checkpointEdit: {
            checkpoints: resolvedCheckpoints,
            addCheckpoint,
            removeCheckpoint,
            getCheckpointCurrentTotal,
            getCheckpointTotalDwellTime,
            getCheckpointTarget,
            setCheckpointTarget,
            handleDistribute
        },
        // Save flow and related error/validity state. handleSave is the reason this hook
        // is a single big hook: it must see localData, checkpoints, localDwellTimes, and
        // serviceGroups all at once to build the payload written to the path.
        save: {
            handleSave,
            hasLengthMismatch,
            saveError
        }
    };
};

export default useSegmentTimesByPeriod;
