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
import { SchedulePeriod } from 'transition-common/lib/services/schedules/Schedule';
import { PeriodsGroup } from 'transition-common/lib/services/schedules/Period';

import {
    Checkpoint,
    ResolvedCheckpoint,
    EditMode,
    LocalSegmentTimes,
    ServiceSegmentTimes,
    getCheckpointKey,
    checkpointsOverlap,
    resolveCheckpoints,
    distributeCheckpointForService,
    applyPendingCheckpointDistributions,
    buildSegmentsByServiceAndPeriod,
    computeOccurrence
} from 'transition-common/lib/services/path/PathSegmentTimeUtils';
import { pathGeographyUtils } from 'transition-common/lib/services/path/PathGeographyUtils';

/**
 * Read the stored per-segment travel times for a service from the path's
 * segmentsByServiceAndPeriod cache, keyed by period shortname.
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

/** Local editing state: serviceId -> periodShortname -> travelTimeSeconds per segment. */

type UseSegmentTimesByPeriodArgs = {
    path: Path;
    onClose: () => void;
};

/**
 * Hook managing all state and logic for the segment times editing modal.
 *
 * Kept as a single hook because `handleSave` needs to see everything (localData,
 * localDwellTimes, checkpoints, services) to build the payload written back to
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

    const services: ServiceSegmentTimes[] = React.useMemo(
        () =>
            serviceIds.map((serviceId) => ({
                serviceId,
                averageTimesByPeriod: getAverageSegmentTimesByPeriod(path, serviceId)
            })),
        [serviceIds.join(','), path]
    );

    const getServiceLabel = (service: ServiceSegmentTimes): string => {
        const serviceObject = servicesCollection?.getById(service.serviceId);
        return serviceObject ? serviceObject.toString(false) : service.serviceId;
    };

    const serviceChoices = services.map((service, index) => ({
        value: String(index),
        label: getServiceLabel(service)
    }));

    const [selectedServiceIndex, setSelectedServiceIndex] = React.useState<string>('0');
    const selectedService = services[parseInt(selectedServiceIndex, 10)] || services[0];
    const selectedServiceId = selectedService?.serviceId || '';
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
                if (fromId && toId)
                    return {
                        fromNodeId: fromId,
                        toNodeId: toId,
                        fromNodeOccurrence: computeOccurrence(nodeIds, cp.fromNodeIndex),
                        toNodeOccurrence: computeOccurrence(nodeIds, cp.toNodeIndex)
                    };
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

    const collectPeriodsWithTripsForService = (service: ServiceSegmentTimes | undefined): SchedulePeriod[] => {
        const periodsByShortname = new Map<string, SchedulePeriod>();
        if (!service) return [];
        const schedule = line ? line.getSchedule(service.serviceId) : undefined;
        const schedulePeriods = schedule?.attributes?.periods || [];
        for (const period of schedulePeriods) {
            const shortname = period.period_shortname || '';
            if (period.trips && period.trips.length > 0 && !periodsByShortname.has(shortname)) {
                periodsByShortname.set(shortname, period);
            }
        }
        return Array.from(periodsByShortname.values());
    };

    const periodNamesByShortname: Record<string, string> = React.useMemo(() => {
        const map: Record<string, string> = {};
        const periodsGroups = Preferences.get('transit.periods') || {};
        for (const group of Object.values(periodsGroups) as PeriodsGroup[]) {
            for (const p of group.periods || []) {
                if (p.shortname && p.name?.[language]) {
                    map[p.shortname] = p.name[language];
                }
            }
        }
        return map;
    }, [language]);

    const periods = collectPeriodsWithTripsForService(selectedService)
        .sort((a, b) => a.start_at_hour - b.start_at_hour)
        .map((period: SchedulePeriod) => {
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
        const avgTime = selectedService?.averageTimesByPeriod[periodShortname]?.[segmentIndex];
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
        [selectedServiceId, segments, selectedService]
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

        if (!selectedService) return;
        setLocalData((previousLocalData) => {
            const updatedLocalData = _cloneDeep(previousLocalData);
            distributeCheckpointForService({
                data: updatedLocalData,
                service: selectedService,
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
            toNodeId: nodeIds[toNodeIndex],
            fromNodeOccurrence: computeOccurrence(nodeIds, fromNodeIndex),
            toNodeOccurrence: computeOccurrence(nodeIds, toNodeIndex)
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
        // Find and remove the matching checkpoint from the stored array by node IDs and occurrence
        setCheckpoints((prev) =>
            prev.filter(
                (cp) =>
                    cp.fromNodeId !== resolved.fromNodeId ||
                    cp.toNodeId !== resolved.toNodeId ||
                    (cp.fromNodeOccurrence ?? 0) !== (resolved.fromNodeOccurrence ?? 0) ||
                    (cp.toNodeOccurrence ?? 0) !== (resolved.toNodeOccurrence ?? 0)
            )
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
                services,
                checkpointTargets
            });
            setLocalData(updatedLocalData);

            // Without grouping, localData is already per-service; no expansion needed.
            const segmentsByServiceAndPeriod = buildSegmentsByServiceAndPeriod({
                expandedData: updatedLocalData,
                path,
                dwellTimes: localDwellTimes
            });

            path.set(
                'data.segmentsByServiceAndPeriod',
                Object.keys(segmentsByServiceAndPeriod).length > 0 ? segmentsByServiceAndPeriod : undefined
            );
            path.set('data.segmentTimesCheckpoints', checkpoints.length > 0 ? checkpoints : undefined);
            path.set('data.dwellTimeSeconds', localDwellTimes);

            // FIXME: implement modification of global time when we modify a time by period by service

            onClose();
        } catch (error) {
            console.error('Error saving segment times:', error);
            setSaveError((error as Error).message || t('transit:transitPath:SegmentTimesSaveError'));
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
        // Service selection UI. The selected service drives which period set is edited
        // and which service's data gets written back to the path on save.
        serviceSelection: {
            serviceChoices,
            selectedServiceIndex,
            setSelectedServiceIndex
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
        // services all at once to build the payload written to the path.
        save: {
            handleSave,
            hasLengthMismatch,
            saveError
        }
    };
};

export default useSegmentTimesByPeriod;
