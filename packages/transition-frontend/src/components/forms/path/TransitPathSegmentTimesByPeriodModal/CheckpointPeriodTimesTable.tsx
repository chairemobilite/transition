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

type CheckpointPeriodTimesTableProps = {
    totalStopTimeSeconds: number;
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
    totalStopTimeSeconds,
    periods,
    language,
    getCurrentTotal,
    getTarget,
    onTargetChange
}) => {
    const { t } = useTranslation('transit');

    return (
        <div style={{ marginTop: '0.5rem', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={headerStyle}>{t('transit:transitPath:Period')}</th>
                        <th style={{ ...centerHeaderStyle, width: '18%' }}>{t('transit:transitPath:CurrentTotal')}</th>
                        <th style={{ ...centerHeaderStyle, width: '18%' }}>{t('transit:transitPath:TargetTotal')}</th>
                        <th style={{ ...centerHeaderStyle, width: '18%' }}>{t('transit:transitPath:TotalStopTime')}</th>
                        <th style={{ ...centerHeaderStyle, width: '18%' }}>{t('transit:transitPath:TotalWithStops')}</th>
                    </tr>
                </thead>
                <tbody>
                {periods.map((period) => {
                    const current = getCurrentTotal(period.shortname);
                    const target = getTarget(period.shortname);
                    const totalWithStops = target + totalStopTimeSeconds;
                    return (
                        <tr key={period.shortname} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <td style={cellStyle}>{period.name[language] || period.shortname}</td>
                            <td style={centerCellStyle}>
                                <strong>{formatSeconds(current)}</strong>
                            </td>
                            <td style={centerCellStyle}>
                                <TimeInput
                                    seconds={target}
                                    onChange={(newSec) => onTargetChange(period.shortname, newSec)}
                                />
                            </td>
                            <td style={centerCellStyle}>{formatSeconds(totalStopTimeSeconds)}</td>
                            <td style={centerCellStyle}>
                                <TimeInput
                                    seconds={totalWithStops}
                                    onChange={(newSec) => {
                                        const newTarget = Math.max(0, newSec - totalStopTimeSeconds);
                                        onTargetChange(period.shortname, newTarget);
                                    }}
                                />
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
