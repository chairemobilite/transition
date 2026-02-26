/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _cloneDeep from 'lodash/cloneDeep';

import Path, { SegmentTimesByPeriod } from 'transition-common/lib/services/path/Path';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

import {
    Checkpoint,
    EditMode,
    getCheckpointKey,
    checkpointsOverlap,
    distributeTime
} from 'transition-common/lib/services/path/PathSegmentTimeUtils';

type UseSegmentTimesByPeriodArgs = {
    path: Path;
    language: string;
    onClose: () => void;
};

const useSegmentTimesByPeriod = ({ path, language, onClose }: UseSegmentTimesByPeriodArgs) => {
    const segments = path.attributes.data.segments || [];
    const segmentCount = segments.length;

    const periodsGroups = Preferences.get('transit.periods') || {};
    const periodsGroupKeys = Object.keys(periodsGroups);
    const defaultGroup = periodsGroupKeys.includes('default') ? 'default' : periodsGroupKeys[0] || '';

    const [selectedPeriodsGroup, setSelectedPeriodsGroup] = React.useState<string>(defaultGroup);
    const [localData, setLocalData] = React.useState<SegmentTimesByPeriod>(() =>
        _cloneDeep(path.attributes.data.segmentTimesByPeriod || {})
    );
    const [activeSegmentIndex, setActiveSegmentIndex] = React.useState<number>(0);

    // Checkpoint state
    const savedCheckpoints = path.attributes.data.segmentTimesCheckpoints || [];
    const [editMode, setEditMode] = React.useState<EditMode>(savedCheckpoints.length > 0 ? 'checkpoint' : 'segment');
    const [checkpoints, setCheckpoints] = React.useState<Checkpoint[]>(() =>
        _cloneDeep(path.attributes.data.segmentTimesCheckpoints || [])
    );
    const [activeCheckpointIndex, setActiveCheckpointIndex] = React.useState<number>(0);
    const [checkpointTargets, setCheckpointTargets] = React.useState<Record<string, Record<string, number>>>({});
    const [newCheckpointFrom, setNewCheckpointFrom] = React.useState<number>(0);
    const [newCheckpointTo, setNewCheckpointTo] = React.useState<number>(Math.min(2, segmentCount));

    const periodsGroup = periodsGroups[selectedPeriodsGroup];
    const periods = periodsGroup?.periods || [];

    const periodsGroupChoices = periodsGroupKeys.map((shortname) => ({
        value: shortname,
        label: periodsGroups[shortname].name[language] || shortname
    }));

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

    // Segment helpers
    const getTimeForCell = (segmentIndex: number, periodShortname: string): number => {
        const override = localData[selectedPeriodsGroup]?.[periodShortname]?.[segmentIndex];
        return override !== undefined ? override : segments[segmentIndex].travelTimeSeconds;
    };

    const handleCellChange = (segmentIndex: number, periodShortname: string, newSeconds: number) => {
        setLocalData((prev) => {
            const next = _cloneDeep(prev);
            if (!next[selectedPeriodsGroup]) {
                next[selectedPeriodsGroup] = {};
            }
            if (!next[selectedPeriodsGroup][periodShortname]) {
                next[selectedPeriodsGroup][periodShortname] = segments.map((s) => s.travelTimeSeconds);
            }
            next[selectedPeriodsGroup][periodShortname][segmentIndex] = newSeconds;
            return next;
        });
    };

    const isSegmentInAnyCheckpoint = (segIdx: number): boolean =>
        checkpoints.some((checkpoint) => segIdx >= checkpoint.fromNodeIndex && segIdx < checkpoint.toNodeIndex);

    const getAverageTotal = (): number => segments.reduce((sum, s) => sum + s.travelTimeSeconds, 0);

    const getPeriodTotal = (periodShortname: string): number => {
        const periodTimes = localData[selectedPeriodsGroup]?.[periodShortname];
        if (!periodTimes) return getAverageTotal();
        return periodTimes.reduce((sum, val) => sum + val, 0);
    };

    // Checkpoint helpers
    const getCheckpointCurrentTotal = (checkpoint: Checkpoint, periodShortname: string): number => {
        let total = 0;
        for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
            total += getTimeForCell(i, periodShortname);
        }
        return total;
    };

    const getCheckpointAverageTotal = (checkpoint: Checkpoint): number => {
        let total = 0;
        for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
            total += segments[i].travelTimeSeconds;
        }
        return total;
    };

    const getCheckpointTarget = (checkpoint: Checkpoint, periodShortname: string): number => {
        const key = getCheckpointKey(checkpoint);
        return checkpointTargets[key]?.[periodShortname] ?? getCheckpointCurrentTotal(checkpoint, periodShortname);
    };

    const setCheckpointTarget = (checkpoint: Checkpoint, periodShortname: string, value: number) => {
        const key = getCheckpointKey(checkpoint);
        setCheckpointTargets((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [periodShortname]: value
            }
        }));
    };

    const handleDistribute = (checkpoint: Checkpoint) => {
        const key = getCheckpointKey(checkpoint);
        const targets = checkpointTargets[key];
        if (!targets) return;

        setLocalData((prev) => {
            const next = _cloneDeep(prev);
            if (!next[selectedPeriodsGroup]) {
                next[selectedPeriodsGroup] = {};
            }

            for (const [periodShortname, targetTotal] of Object.entries(targets)) {
                if (!next[selectedPeriodsGroup][periodShortname]) {
                    next[selectedPeriodsGroup][periodShortname] = segments.map((s) => s.travelTimeSeconds);
                }
                const distributed = distributeTime(segments, checkpoint.fromNodeIndex, checkpoint.toNodeIndex, targetTotal);
                for (let i = 0; i < distributed.length; i++) {
                    next[selectedPeriodsGroup][periodShortname][checkpoint.fromNodeIndex + i] = distributed[i];
                }
            }
            return next;
        });
    };

    const addCheckpoint = () => {
        if (newCheckpointFrom >= newCheckpointTo) return;
        const newCheckpoint: Checkpoint = { fromNodeIndex: newCheckpointFrom, toNodeIndex: newCheckpointTo };
        const overlaps = checkpoints.some((checkpoint) => checkpointsOverlap(checkpoint, newCheckpoint));
        if (overlaps) return;
        setCheckpoints((prev) => [...prev, newCheckpoint]);
        setActiveCheckpointIndex(checkpoints.length);
        setEditMode('checkpoint');
    };

    const removeCheckpoint = (index: number) => {
        const checkpoint = checkpoints[index];
        const key = getCheckpointKey(checkpoint);
        setCheckpoints((prev) => prev.filter((_, i) => i !== index));
        setCheckpointTargets((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setActiveCheckpointIndex((prev) => Math.max(0, Math.min(prev, checkpoints.length - 2)));
        if (checkpoints.length <= 1) {
            setEditMode('segment');
        }
    };

    const handleSave = () => {
        const cleanedData = _cloneDeep(localData);
        for (const groupKey of Object.keys(cleanedData)) {
            for (const periodKey of Object.keys(cleanedData[groupKey])) {
                if (!cleanedData[groupKey][periodKey] || cleanedData[groupKey][periodKey].length === 0) {
                    delete cleanedData[groupKey][periodKey];
                }
            }
            if (Object.keys(cleanedData[groupKey]).length === 0) {
                delete cleanedData[groupKey];
            }
        }
        path.set('data.segmentTimesByPeriod', Object.keys(cleanedData).length > 0 ? cleanedData : undefined);
        path.set('data.segmentTimesCheckpoints', checkpoints.length > 0 ? checkpoints : undefined);
        onClose();
    };

    const hasLengthMismatch = (): boolean => {
        const groupData = localData[selectedPeriodsGroup];
        if (!groupData) return false;
        return Object.values(groupData).some((times: number[]) => times.length !== segmentCount);
    };

    // Navigation
    const goToPrevSegment = () => setActiveSegmentIndex((prev) => Math.max(0, prev - 1));
    const goToNextSegment = () => setActiveSegmentIndex((prev) => Math.min(segmentCount - 1, prev + 1));
    const goToPrevCheckpoint = () => setActiveCheckpointIndex((prev) => Math.max(0, prev - 1));
    const goToNextCheckpoint = () => setActiveCheckpointIndex((prev) => Math.min(checkpoints.length - 1, prev + 1));

    const handleSegmentClick = (idx: number) => {
        setActiveSegmentIndex(idx);
        setEditMode('segment');
    };

    const handleCheckpointClick = (idx: number) => {
        setActiveCheckpointIndex(idx);
        setEditMode('checkpoint');
    };

    const activeCheckpoint = checkpoints[activeCheckpointIndex];

    return {
        // Derived data
        segments,
        segmentCount,
        periods,
        periodsGroupChoices,
        nodeLabels,
        nodeChoices,

        // State
        selectedPeriodsGroup,
        setSelectedPeriodsGroup,
        activeSegmentIndex,
        editMode,
        checkpoints,
        activeCheckpointIndex,
        activeCheckpoint,
        newCheckpointFrom,
        newCheckpointTo,
        setNewCheckpointFrom,
        setNewCheckpointTo,

        // Segment handlers
        getTimeForCell,
        handleCellChange,
        isSegmentInAnyCheckpoint,
        getAverageTotal,
        getPeriodTotal,

        // Checkpoint handlers
        getCheckpointCurrentTotal,
        getCheckpointAverageTotal,
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
