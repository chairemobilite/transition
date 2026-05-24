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
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

import {
    LocalSegmentTimes,
    ServiceSegmentTimes,
    buildSegmentsByServiceAndPeriod
} from 'transition-common/lib/services/path/PathSegmentTimeUtils';

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
 * localDwellTimes, services) to build the payload written back to the path, and
 * localData is shared between cell-by-cell editing and the save flow. Splitting
 * would force this state into a Context or lifted to the parent, which hides the
 * coupling without removing it. Returns are grouped by feature (pathDisplay,
 * serviceSelection, navigation, segmentEdit, save).
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

    const collectPeriodsWithTripsForService = (service: ServiceSegmentTimes | undefined): any[] => {
        const periodsByShortname = new Map<string, any>();
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

    const buildPeriodChoice = (period: any) => ({
        shortname: period.period_shortname || '',
        name: {
            [language]: `${period.period_shortname || '?'} (${period.start_at_hour}h-${period.end_at_hour}h)`
        }
    });

    const periods = collectPeriodsWithTripsForService(selectedService)
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

    const handleSave = async () => {
        setSaveError(null);
        try {
            const updatedLocalData = _cloneDeep(localData);

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

    const handleSegmentClick = (idx: number) => {
        React.startTransition(() => {
            setActiveSegmentIndex(idx);
        });
    };

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
        // Navigation between segments inside the modal. Mutates activeSegmentIndex,
        // which is shared across multiple sub-components (overview, carousel, table)
        // so it must live in the hook rather than in any individual sub-component.
        navigation: {
            activeSegmentIndex,
            goToPrevSegment,
            goToNextSegment,
            handleSegmentClick
        },
        // Per-segment editing and read helpers. All of these ultimately read or write
        // localData and must stay here because localData is shared with handleSave.
        segmentEdit: {
            getTimeForCell,
            handleCellChange,
            getDwellTimeForSegment,
            setDwellTimeForSegment,
            getDepartureTimeAtSegment,
            getArrivalTimeAfterSegment
        },
        // Save flow and related error/validity state. handleSave is the reason this hook
        // is a single big hook: it must see localData, localDwellTimes, and services all
        // at once to build the payload written to the path.
        save: {
            handleSave,
            hasLengthMismatch,
            saveError
        }
    };
};

export default useSegmentTimesByPeriod;
