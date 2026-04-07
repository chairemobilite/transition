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
        <div className="period-table-wrapper">
            {locked && lockedMessage && (
                <p
                    className="locked-msg"
                    data-testid="segment-locked-msg"
                >
                    {lockedMessage}
                </p>
            )}
            {!isFirstSegment && (
                <div className="stop-time-row">
                    <strong>{t('transit:transitPath:StopTime')}:</strong>
                    <TimeInput seconds={stopTimeSeconds} onChange={onStopTimeChange} />
                </div>
            )}
            <table className="period-table">
                <thead>
                    <tr>
                        <th className="period-table-th">{t('transit:transitPath:Period')}</th>
                        {!isFirstSegment && <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:ArrivalTime')}</th>}
                        {!isFirstSegment && <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:StopTime')}</th>}
                        <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:DepartureTime')}</th>
                        <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:SegmentTime')}</th>
                        <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:ArrivalTime')}</th>
                    </tr>
                </thead>
                <tbody>
                    {periods.map((period) => (
                        <tr
                            key={period.shortname}
                            className="period-table-row"
                            style={{ opacity: locked ? 0.5 : 1 }}
                        >
                            <td className="period-table-td">{period.name[language] || period.shortname}</td>
                            {!isFirstSegment && <td className="period-table-td center">{formatSeconds(getArrivalTimePrevSegment(period.shortname))}</td>}
                            {!isFirstSegment && <td className="period-table-td center">{formatSeconds(stopTimeSeconds)}</td>}
                            <td className="period-table-td center">{formatSeconds(getDepartureTime(period.shortname))}</td>
                            <td className="period-table-td center">
                                <TimeInput
                                    seconds={getTimeForPeriod(period.shortname)}
                                    onChange={(newSec) => onTimeChange(period.shortname, newSec)}
                                    readOnly={locked}
                                />
                            </td>
                            <td className="period-table-td center">
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
