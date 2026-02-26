/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { formatSeconds } from 'transition-common/lib/services/path/PathSegmentTimeUtils';
import TimeInput from './TimeInput';

type Period = {
    shortname: string;
    name: Record<string, string>;
};

type SegmentPeriodTimesTableProps = {
    averageSegmentSeconds: number;
    averageTotal: number;
    periods: Period[];
    language: string;
    locked: boolean;
    lockedMessage?: string;
    getTimeForPeriod: (periodShortname: string) => number;
    getPeriodTotal: (periodShortname: string) => number;
    onTimeChange: (periodShortname: string, newSeconds: number) => void;
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

const SegmentPeriodTimesTable: React.FunctionComponent<SegmentPeriodTimesTableProps> = ({
    averageSegmentSeconds,
    averageTotal,
    periods,
    language,
    locked,
    lockedMessage,
    getTimeForPeriod,
    getPeriodTotal,
    onTimeChange
}) => {
    const { t } = useTranslation('transit');

    return (
        <div style={{ marginTop: '0.5rem', width: '100%' }}>
            {locked && lockedMessage && (
                <p
                    style={{ color: '#ff9800', fontSize: '0.85em', marginBottom: '0.5rem' }}
                    data-testid="segment-locked-msg"
                >
                    {lockedMessage}
                </p>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={headerStyle}>{t('transit:transitPath:Period')}</th>
                        <th style={centerHeaderStyle}>{t('transit:transitPath:SegmentTime')}</th>
                        <th style={centerHeaderStyle}>{t('transit:transitPath:PeriodTotal')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.3)' }}>
                        <td style={{ ...cellStyle, fontWeight: 'bold' }}>{t('transit:transitPath:AverageTime')}</td>
                        <td style={centerCellStyle}>
                            <TimeInput seconds={averageSegmentSeconds} onChange={() => {}} readOnly={true} />
                        </td>
                        <td style={centerCellStyle}>
                            <strong>{formatSeconds(averageTotal)}</strong>
                        </td>
                    </tr>
                    {periods.map((period) => (
                        <tr
                            key={period.shortname}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', opacity: locked ? 0.5 : 1 }}
                        >
                            <td style={cellStyle}>{period.name[language] || period.shortname}</td>
                            <td style={centerCellStyle}>
                                <TimeInput
                                    seconds={getTimeForPeriod(period.shortname)}
                                    onChange={(newSec) => onTimeChange(period.shortname, newSec)}
                                    readOnly={locked}
                                />
                            </td>
                            <td style={centerCellStyle}>
                                <strong>{formatSeconds(getPeriodTotal(period.shortname))}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SegmentPeriodTimesTable;
