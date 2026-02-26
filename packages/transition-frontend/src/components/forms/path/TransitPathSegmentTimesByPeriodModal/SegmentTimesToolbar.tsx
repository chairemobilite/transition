/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

type NodeChoice = {
    value: string;
    label: string;
};

type PeriodsGroupChoice = {
    value: string;
    label: string;
};

type SegmentTimesToolbarProps = {
    nodeChoices: NodeChoice[];
    newCheckpointFrom: number;
    newCheckpointTo: number;
    segmentCount: number;
    onNewCheckpointFromChange: (value: number) => void;
    onNewCheckpointToChange: (value: number) => void;
    onAddCheckpoint: () => void;
    selectedPeriodsGroup: string;
    periodsGroupChoices: PeriodsGroupChoice[];
    onPeriodsGroupChange: (value: string) => void;
};

const selectStyle: React.CSSProperties = {
    fontSize: '0.9em',
    padding: '0.15rem',
    background: 'rgba(255,255,255,0.1)',
    color: 'inherit',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '3px',
    flex: 1,
    minWidth: 0
};

const SegmentTimesToolbar: React.FunctionComponent<SegmentTimesToolbarProps> = ({
    nodeChoices,
    newCheckpointFrom,
    newCheckpointTo,
    segmentCount,
    onNewCheckpointFromChange,
    onNewCheckpointToChange,
    onAddCheckpoint,
    selectedPeriodsGroup,
    periodsGroupChoices,
    onPeriodsGroupChange
}) => {
    const { t } = useTranslation('transit');

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexShrink: 0,
                flexWrap: 'wrap',
                marginTop: '1.5rem',
                marginBottom: '3rem'
            }}
        >
            {/* Add checkpoint mini-form — left */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85em', width: '60%' }}>
                <span style={{ opacity: 0.7, flexShrink: 0 }}>{t('transit:transitPath:FromStation')}:</span>
                <select
                    data-testid="new-cp-from"
                    value={String(newCheckpointFrom)}
                    onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        onNewCheckpointFromChange(v);
                        if (v >= newCheckpointTo) onNewCheckpointToChange(Math.min(v + 1, segmentCount));
                    }}
                    style={selectStyle}
                >
                    {nodeChoices.slice(0, -1).map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>
                <span style={{ opacity: 0.7, flexShrink: 0 }}>{t('transit:transitPath:ToStation')}:</span>
                <select
                    data-testid="new-cp-to"
                    value={String(newCheckpointTo)}
                    onChange={(e) => onNewCheckpointToChange(parseInt(e.target.value, 10))}
                    style={selectStyle}
                >
                    {nodeChoices.filter((_, idx) => idx > newCheckpointFrom).map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>
                <Button
                    color="blue"
                    label={`+ ${t('transit:transitPath:AddCheckpoint')}`}
                    onClick={onAddCheckpoint}
                />
            </span>

            <span style={{ marginLeft: 'auto' }} />

            {/* Periods group selector — right */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85em' }}>
                <label>{t('transit:transitPath:PeriodsGroup')}</label>
                <InputSelect
                    id="segmentTimesByPeriod_periodsGroup"
                    value={selectedPeriodsGroup}
                    choices={periodsGroupChoices}
                    onValueChange={(e) => onPeriodsGroupChange(e.target.value)}
                    noBlank={true}
                />
            </span>
        </div>
    );
};

export default SegmentTimesToolbar;
