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
    totalDwellTimeSeconds: number;
    periods: Period[];
    language: string;
    getCurrentTotal: (periodShortname: string) => number;
    getTarget: (periodShortname: string) => number;
    onTargetChange: (periodShortname: string, newSeconds: number) => void;
};


const CheckpointPeriodTimesTable: React.FunctionComponent<CheckpointPeriodTimesTableProps> = ({
    totalDwellTimeSeconds,
    periods,
    language,
    getCurrentTotal,
    getTarget,
    onTargetChange
}) => {
    const { t } = useTranslation('transit');

    return (
        <div className="period-table-wrapper">
            <table className="period-table">
                <thead>
                    <tr>
                        <th className="period-table-th">{t('transit:transitPath:Period')}</th>
                        <th className="period-table-th center" style={{ width: '18%' }}>{t('transit:transitPath:CurrentTotal')}</th>
                        <th className="period-table-th center" style={{ width: '18%' }}>{t('transit:transitPath:TargetTotal')}</th>
                        <th className="period-table-th center" style={{ width: '18%' }}>{t('transit:transitPath:TotalDwellTime')}</th>
                        <th className="period-table-th center" style={{ width: '18%' }}>{t('transit:transitPath:TotalWithDwell')}</th>
                    </tr>
                </thead>
                <tbody>
                {periods.map((period) => {
                    const current = getCurrentTotal(period.shortname);
                    const target = getTarget(period.shortname);
                    const totalWithDwell = target + totalDwellTimeSeconds;
                    return (
                        <tr key={period.shortname} className="period-table-row">
                            <td className="period-table-td">{period.name[language] || period.shortname}</td>
                            <td className="period-table-td center">
                                <strong>{formatSeconds(current)}</strong>
                            </td>
                            <td className="period-table-td center">
                                <TimeInput
                                    seconds={target}
                                    onChange={(newSec) => onTargetChange(period.shortname, newSec)}
                                />
                            </td>
                            <td className="period-table-td center">{formatSeconds(totalDwellTimeSeconds)}</td>
                            <td className="period-table-td center">
                                <TimeInput
                                    seconds={totalWithDwell}
                                    onChange={(newSec) => {
                                        const newTarget = Math.max(0, newSec - totalDwellTimeSeconds);
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
