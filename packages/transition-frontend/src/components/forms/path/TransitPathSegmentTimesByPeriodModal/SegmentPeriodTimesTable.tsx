/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { toXXhrYYminZZsec } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import TimeInput from './TimeInput';

type Period = {
    shortname: string;
    name: Record<string, string>;
};

type SegmentPeriodTimesTableProps = {
    segmentIndex: number;
    periods: Period[];
    getTimeForPeriod: (periodShortname: string) => number;
    getStopTime: () => number;
    onStopTimeChange: (newSeconds: number) => void;
    getArrivalTimePrevSegment: (periodShortname: string) => number;
    getDepartureTime: (periodShortname: string) => number;
    getArrivalTime: (periodShortname: string) => number;
    onTimeChange: (periodShortname: string, newSeconds: number) => void;
};

const SegmentPeriodTimesTable: React.FunctionComponent<SegmentPeriodTimesTableProps> = ({
    segmentIndex,
    periods,
    getTimeForPeriod,
    getStopTime,
    onStopTimeChange,
    getArrivalTimePrevSegment,
    getDepartureTime,
    getArrivalTime,
    onTimeChange
}) => {
    const { t, i18n } = useTranslation('transit');
    const formatDuration = (seconds: number): string =>
        toXXhrYYminZZsec(seconds, t, {
            hourUnit: '',
            minuteUnit: 'main:minuteLetter',
            secondsUnit: 'main:secondLetter',
            spacer: ''
        });
    const stopTimeSeconds = getStopTime();
    const isFirstSegment = segmentIndex === 0;
    const columnWidth = isFirstSegment ? '30%' : '18%';

    return (
        <div className="period-table-wrapper">
            {!isFirstSegment && (
                <div className="stop-time-row">
                    <strong>{t('transit:transitPath:DwellTime')}:</strong>
                    <TimeInput seconds={stopTimeSeconds} onChange={onStopTimeChange} />
                </div>
            )}
            <table className="period-table">
                <thead>
                    <tr>
                        <th className="period-table-th">{t('transit:transitPath:Period')}</th>
                        {!isFirstSegment && (
                            <th className="period-table-th center" style={{ width: columnWidth }}>
                                {t('transit:transitPath:SegmentElapsedArrivalTime', { nodeIndex: segmentIndex + 1 })}
                            </th>
                        )}
                        {!isFirstSegment && (
                            <th className="period-table-th center" style={{ width: columnWidth }}>
                                {t('transit:transitPath:DwellTime')}
                            </th>
                        )}
                        <th className="period-table-th center" style={{ width: columnWidth }}>
                            {t('transit:transitPath:SegmentElapsedDepartureTime', { nodeIndex: segmentIndex + 1 })}
                        </th>
                        <th className="period-table-th center" style={{ width: columnWidth }}>
                            {t('transit:transitPath:SegmentTime')}
                        </th>
                        <th className="period-table-th center" style={{ width: columnWidth }}>
                            {t('transit:transitPath:SegmentElapsedArrivalTime', { nodeIndex: segmentIndex + 2 })}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {periods.map((period) => (
                        <tr key={period.shortname} className="period-table-row">
                            <td className="period-table-td">{period.name[i18n.language] || period.shortname}</td>
                            {!isFirstSegment && (
                                <td className="period-table-td center">
                                    {formatDuration(getArrivalTimePrevSegment(period.shortname))}
                                </td>
                            )}
                            {!isFirstSegment && (
                                <td className="period-table-td center">{formatDuration(stopTimeSeconds)}</td>
                            )}
                            <td className="period-table-td center">
                                {formatDuration(getDepartureTime(period.shortname))}
                            </td>
                            <td className="period-table-td center">
                                <TimeInput
                                    seconds={getTimeForPeriod(period.shortname)}
                                    onChange={(newSec) => onTimeChange(period.shortname, newSec)}
                                />
                            </td>
                            <td className="period-table-td center">
                                <strong>{formatDuration(getArrivalTime(period.shortname))}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SegmentPeriodTimesTable;
