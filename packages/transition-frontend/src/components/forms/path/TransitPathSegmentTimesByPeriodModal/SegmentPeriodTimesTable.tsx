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
    isFirstSegment: boolean;
    periods: Period[];
    language: string;
    locked: boolean;
    lockedMessage?: string;
    getTimeForPeriod: (periodShortname: string) => number;
    getStopTime: () => number;
    onStopTimeChange: (newSeconds: number) => void;
    getArrivalTimePrevSegment: (periodShortname: string) => number;
    getDepartureTime: (periodShortname: string) => number;
    getArrivalTime: (periodShortname: string) => number;
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
    isFirstSegment,
    periods,
    language,
    locked,
    lockedMessage,
    getTimeForPeriod,
    getStopTime,
    onStopTimeChange,
    getArrivalTimePrevSegment,
    getDepartureTime,
    getArrivalTime,
    onTimeChange
}) => {
    const { t } = useTranslation('transit');
    const stopTimeSeconds = getStopTime();
    const columnWidth = isFirstSegment ? '30%' : '18%';

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
            {!isFirstSegment && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold' }}>{t('transit:transitPath:StopTime')}:</span>
                    <TimeInput seconds={stopTimeSeconds} onChange={onStopTimeChange} />
                </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={headerStyle}>{t('transit:transitPath:Period')}</th>
                        {!isFirstSegment && <th style={{ ...centerHeaderStyle, width: columnWidth }}>{t('transit:transitPath:ArrivalTime')}</th>}
                        {!isFirstSegment && <th style={{ ...centerHeaderStyle, width: columnWidth }}>{t('transit:transitPath:StopTime')}</th>}
                        <th style={{ ...centerHeaderStyle, width: columnWidth }}>{t('transit:transitPath:DepartureTime')}</th>
                        <th style={{ ...centerHeaderStyle, width: columnWidth }}>{t('transit:transitPath:SegmentTime')}</th>
                        <th style={{ ...centerHeaderStyle, width: columnWidth }}>{t('transit:transitPath:ArrivalTime')}</th>
                    </tr>
                </thead>
                <tbody>
                    {periods.map((period) => (
                        <tr
                            key={period.shortname}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', opacity: locked ? 0.5 : 1 }}
                        >
                            <td style={cellStyle}>{period.name[language] || period.shortname}</td>
                            {!isFirstSegment && <td style={centerCellStyle}>{formatSeconds(getArrivalTimePrevSegment(period.shortname))}</td>}
                            {!isFirstSegment && <td style={centerCellStyle}>{formatSeconds(stopTimeSeconds)}</td>}
                            <td style={centerCellStyle}>{formatSeconds(getDepartureTime(period.shortname))}</td>
                            <td style={centerCellStyle}>
                                <TimeInput
                                    seconds={getTimeForPeriod(period.shortname)}
                                    onChange={(newSec) => onTimeChange(period.shortname, newSec)}
                                    readOnly={locked}
                                />
                            </td>
                            <td style={centerCellStyle}>
                                <strong>{formatSeconds(getArrivalTime(period.shortname))}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SegmentPeriodTimesTable;
