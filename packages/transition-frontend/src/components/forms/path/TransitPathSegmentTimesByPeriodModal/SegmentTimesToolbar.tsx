/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { ResolvedCheckpoint } from 'transition-common/lib/services/path/PathSegmentTimeUtils';

type NodeChoice = {
    value: string;
    label: string;
};

type ServiceChoice = {
    value: string;
    label: string;
};

type SegmentTimesToolbarProps = {
    nodeChoices: NodeChoice[];
    resolvedCheckpoints: ResolvedCheckpoint[];
    segmentCount: number;
    onAddCheckpoint: (from: number, to: number) => void;
    selectedServiceId: string;
    serviceChoices: ServiceChoice[];
    onServiceChange: (value: string) => void;
    noGrouping: boolean;
    onNoGroupingChange: (value: boolean) => void;
};

const SegmentTimesToolbar: React.FunctionComponent<SegmentTimesToolbarProps> = ({
    nodeChoices,
    resolvedCheckpoints,
    segmentCount,
    onAddCheckpoint,
    selectedServiceId,
    serviceChoices,
    onServiceChange,
    noGrouping,
    onNoGroupingChange
}) => {
    const { t } = useTranslation('transit');

    // Local UI state for the "add checkpoint" mini-form. Kept inside this component
    // so the parent hook doesn't have to carry purely-local checkpoint-creation state.
    const [newCheckpointFrom, setNewCheckpointFrom] = React.useState<number>(0);
    const [newCheckpointTo, setNewCheckpointTo] = React.useState<number>(Math.min(2, segmentCount));

    const sortedCheckpoints = React.useMemo(
        () => [...resolvedCheckpoints].sort((a, b) => a.fromNodeIndex - b.fromNodeIndex),
        [resolvedCheckpoints]
    );
    const nextCheckpointAfterFrom = sortedCheckpoints.find((cp) => cp.fromNodeIndex > newCheckpointFrom);
    const newCheckpointMaxTo = nextCheckpointAfterFrom ? nextCheckpointAfterFrom.fromNodeIndex : segmentCount;
    const isNodeInsideCheckpoint = React.useCallback(
        (idx: number) => sortedCheckpoints.some((cp) => cp.fromNodeIndex < idx && idx < cp.toNodeIndex),
        [sortedCheckpoints]
    );

    // Clamp "to" when maxTo shrinks (e.g. "from" moved before an existing checkpoint)
    React.useEffect(() => {
        if (newCheckpointTo > newCheckpointMaxTo) {
            setNewCheckpointTo(newCheckpointMaxTo);
        }
    }, [newCheckpointMaxTo, newCheckpointTo]);

    return (
        <div className="toolbar">
            {/* Add checkpoint mini-form — left */}
            <span className="toolbar-checkpoint-form">
                <span className="toolbar-label">{t('transit:transitPath:FromStation')}:</span>
                <select
                    data-testid="new-cp-from"
                    value={String(newCheckpointFrom)}
                    onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setNewCheckpointFrom(v);
                        if (v >= newCheckpointTo) setNewCheckpointTo(Math.min(v + 1, segmentCount));
                    }}
                    className="toolbar-select"
                >
                    {nodeChoices
                        .slice(0, -1)
                        .filter((_, idx) => !isNodeInsideCheckpoint(idx))
                        .map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                </select>
                <span className="toolbar-label">{t('transit:transitPath:ToStation')}:</span>
                <select
                    data-testid="new-cp-to"
                    value={String(newCheckpointTo)}
                    onChange={(e) => setNewCheckpointTo(parseInt(e.target.value, 10))}
                    className="toolbar-select"
                >
                    {nodeChoices
                        .filter((_, idx) => idx > newCheckpointFrom && idx <= newCheckpointMaxTo)
                        .map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                </select>
                <Button
                    color="blue"
                    label={`+ ${t('transit:transitPath:AddCheckpoint')}`}
                    onClick={() => onAddCheckpoint(newCheckpointFrom, newCheckpointTo)}
                />
            </span>

            <span className="toolbar-spacer" />

            {/* Service selector with no-grouping toggle stacked below */}
            <span className="toolbar-service-group">
                <span className="toolbar-service-row">
                    <label>{t('transit:transitService:Service')}</label>
                    <InputSelect
                        id="segmentTimesByPeriod_service"
                        value={selectedServiceId}
                        choices={serviceChoices}
                        onValueChange={(e) => onServiceChange(e.target.value)}
                        noBlank={true}
                    />
                </span>
                <span className="toolbar-grouping-toggle">
                    <InputCheckboxBoolean
                        id="segmentTimesByPeriod_noGrouping"
                        isChecked={noGrouping}
                        label={t('transit:transitPath:ShowServicesIndividually')}
                        onValueChange={(e) => onNoGroupingChange(e.target.value)}
                    />
                </span>
            </span>
        </div>
    );
};

export default React.memo(SegmentTimesToolbar);
