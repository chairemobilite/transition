/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'react-tooltip';

import { formatSeconds } from 'transition-common/lib/services/path/PathSegmentTimeUtils';
import TimeInput from './TimeInput';

type Period = {
    shortname: string;
    name: Record<string, string>;
};

type CheckpointPeriodTimesTableProps = {
    averageTotal: number;
    periods: Period[];
    language: string;
    getCurrentTotal: (periodShortname: string) => number;
    getTarget: (periodShortname: string) => number;
    onTargetChange: (periodShortname: string, newSeconds: number) => void;
};

const cellStyle: React.CSSProperties = { padding: '0.5rem' };
const centerCellStyle: React.CSSProperties = { textAlign: 'center', padding: '0.5rem' };
const headerStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.2)'
};
const centerHeaderStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.2)'
};

const CheckpointPeriodTimesTable: React.FunctionComponent<CheckpointPeriodTimesTableProps> = ({
    averageTotal,
    periods,
    language,
    getCurrentTotal,
    getTarget,
    onTargetChange
}) => {
    const { t } = useTranslation('transit');

    return (
        <div style={{ marginTop: '0.5rem', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={headerStyle}>{t('transit:transitPath:Period')}</th>
                        <th style={centerHeaderStyle}>{t('transit:transitPath:CurrentTotal')}</th>
                        <th style={centerHeaderStyle}>{t('transit:transitPath:TargetTotal')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.3)' }}>
                        <td style={{ ...cellStyle, fontWeight: 'bold' }}>{t('transit:transitPath:AverageTime')}</td>
                        <td style={centerCellStyle}>
                            <strong>{formatSeconds(averageTotal)}</strong>
                        </td>
                        <td style={{ ...centerCellStyle, opacity: 0.4 }}>&mdash;</td>
                    </tr>
                    {periods.map((period) => {
                        const current = getCurrentTotal(period.shortname);
                        const target = getTarget(period.shortname);
                        const isDifferent = current !== target;
                        return (
                            <tr key={period.shortname} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <td style={cellStyle}>{period.name[language] || period.shortname}</td>
                                <td style={centerCellStyle}>
                                    <strong>{formatSeconds(current)}</strong>
                                </td>
                                <td style={centerCellStyle}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <TimeInput
                                            seconds={target}
                                            onChange={(newSec) => onTargetChange(period.shortname, newSec)}
                                        />
                                        <span
                                            style={{
                                                width: '0.8em',
                                                fontSize: '0.8em',
                                                textAlign: 'center',
                                                cursor: 'default'
                                            }}
                                            data-tooltip-id={isDifferent ? `unsaved-${period.shortname}` : undefined}
                                        >
                                            {isDifferent ? '*' : ''}
                                        </span>
                                        {isDifferent && (
                                            <Tooltip
                                                id={`unsaved-${period.shortname}`}
                                                delayShow={0}
                                                opacity={1}
                                                place="right"
                                                noArrow
                                                positionStrategy="fixed"
                                                style={{
                                                    zIndex: 100,
                                                    fontSize: '11px',
                                                    maxWidth: '150px',
                                                    whiteSpace: 'normal',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <span>{t('transit:transitPath:UnsavedChange')}</span>
                                            </Tooltip>
                                        )}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default CheckpointPeriodTimesTable;
