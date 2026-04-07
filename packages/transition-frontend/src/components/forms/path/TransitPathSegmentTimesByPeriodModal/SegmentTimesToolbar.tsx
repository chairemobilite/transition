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
    newCheckpointFrom: number;
    newCheckpointTo: number;
    newCheckpointMaxTo: number;
    isNodeInsideCheckpoint: (idx: number) => boolean;
    segmentCount: number;
    onNewCheckpointFromChange: (value: number) => void;
    onNewCheckpointToChange: (value: number) => void;
    onAddCheckpoint: () => void;
    selectedServiceId: string;
    serviceChoices: ServiceChoice[];
    onServiceChange: (value: string) => void;
    noGrouping: boolean;
    onNoGroupingChange: (value: boolean) => void;
};

const SegmentTimesToolbar: React.FunctionComponent<SegmentTimesToolbarProps> = ({
    nodeChoices,
    newCheckpointFrom,
    newCheckpointTo,
    newCheckpointMaxTo,
    isNodeInsideCheckpoint,
    segmentCount,
    onNewCheckpointFromChange,
    onNewCheckpointToChange,
    onAddCheckpoint,
    selectedServiceId,
    serviceChoices,
    onServiceChange,
    noGrouping,
    onNoGroupingChange
}) => {
    const { t } = useTranslation('transit');

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
                        onNewCheckpointFromChange(v);
                        if (v >= newCheckpointTo) onNewCheckpointToChange(Math.min(v + 1, segmentCount));
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
                    onChange={(e) => onNewCheckpointToChange(parseInt(e.target.value, 10))}
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
                <Button color="blue" label={`+ ${t('transit:transitPath:AddCheckpoint')}`} onClick={onAddCheckpoint} />
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

export default SegmentTimesToolbar;
