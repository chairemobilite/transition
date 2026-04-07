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

type PeriodRowProps = {
    periodShortname: string;
    periodLabel: string;
    isFirstSegment: boolean;
    locked: boolean;
    dwellTimeSeconds: number;
    arrivalTimePrevSeconds: number;
    departureTimeSeconds: number;
    segmentTimeSeconds: number;
    arrivalTimeSeconds: number;
    onSegmentTimeChange: (newSeconds: number) => void;
};

const PeriodRow: React.FunctionComponent<PeriodRowProps> = ({
    periodLabel,
    isFirstSegment,
    locked,
    dwellTimeSeconds,
    arrivalTimePrevSeconds,
    departureTimeSeconds,
    segmentTimeSeconds,
    arrivalTimeSeconds,
    onSegmentTimeChange
}) => (
    <tr className="period-table-row" style={{ opacity: locked ? 0.5 : 1 }}>
        <td className="period-table-td">{periodLabel}</td>
        {!isFirstSegment && <td className="period-table-td center">{formatSeconds(arrivalTimePrevSeconds)}</td>}
        {!isFirstSegment && <td className="period-table-td center">{formatSeconds(dwellTimeSeconds)}</td>}
        <td className="period-table-td center">{formatSeconds(departureTimeSeconds)}</td>
        <td className="period-table-td center">
            <TimeInput seconds={segmentTimeSeconds} onChange={onSegmentTimeChange} readOnly={locked} />
        </td>
        <td className="period-table-td center">
            <strong>{formatSeconds(arrivalTimeSeconds)}</strong>
        </td>
    </tr>
);

const MemoizedPeriodRow = React.memo(PeriodRow);

type SegmentPeriodTimesTableProps = {
    activeSegmentIndex: number;
    periods: Period[];
    language: string;
    locked: boolean;
    lockedMessage?: string;
    getTimeForCell: (segmentIndex: number, periodShortname: string) => number;
    getDwellTimeForSegment: (segmentIndex: number) => number;
    setDwellTimeForSegment: (segmentIndex: number, newSeconds: number) => void;
    getArrivalTimeAfterSegment: (segmentIndex: number, periodShortname: string) => number;
    getDepartureTimeAtSegment: (segmentIndex: number, periodShortname: string) => number;
    handleCellChange: (segmentIndex: number, periodShortname: string, newSeconds: number) => void;
};


const SegmentPeriodTimesTable: React.FunctionComponent<SegmentPeriodTimesTableProps> = ({
    activeSegmentIndex,
    periods,
    language,
    locked,
    lockedMessage,
    getTimeForCell,
    getDwellTimeForSegment,
    setDwellTimeForSegment,
    getArrivalTimeAfterSegment,
    getDepartureTimeAtSegment,
    handleCellChange
}) => {
    const { t } = useTranslation('transit');
    const isFirstSegment = activeSegmentIndex === 0;
    const dwellTimeSeconds = getDwellTimeForSegment(activeSegmentIndex);
    const columnWidth = isFirstSegment ? '30%' : '18%';

    // Pre-compute stable callbacks per period so MemoizedPeriodRow receives the same reference
    const periodCallbacks = React.useRef<Record<string, (newSeconds: number) => void>>({});
    periods.forEach((period) => {
        if (!periodCallbacks.current[period.shortname]) {
            periodCallbacks.current[period.shortname] = (newSeconds: number) =>
                handleCellChange(activeSegmentIndex, period.shortname, newSeconds);
        }
    });
    // Update callbacks when activeSegmentIndex changes
    React.useEffect(() => {
        periods.forEach((period) => {
            periodCallbacks.current[period.shortname] = (newSeconds: number) =>
                handleCellChange(activeSegmentIndex, period.shortname, newSeconds);
        });
    }, [activeSegmentIndex]);

    return (
        <div className="period-table-wrapper">
            {locked && lockedMessage && (
                <p className="locked-msg" data-testid="segment-locked-msg">
                    {lockedMessage}
                </p>
            )}
            {!isFirstSegment && (
                <div className="stop-time-row">
                    <strong>{t('transit:transitPath:DwellTime')}:</strong>
                    <TimeInput seconds={dwellTimeSeconds} onChange={(newSec) => setDwellTimeForSegment(activeSegmentIndex, newSec)} />
                </div>
            )}
            <table className="period-table">
                <thead>
                    <tr>
                        <th className="period-table-th">{t('transit:transitPath:Period')}</th>
                        {!isFirstSegment && <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:ArrivalTime')}</th>}
                        {!isFirstSegment && <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:DwellTime')}</th>}
                        <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:DepartureTime')}</th>
                        <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:SegmentTime')}</th>
                        <th className="period-table-th center" style={{ width: columnWidth }}>{t('transit:transitPath:ArrivalTime')}</th>
                    </tr>
                </thead>
                <tbody>
                    {periods.map((period) => (
                        <MemoizedPeriodRow
                            key={period.shortname}
                            periodShortname={period.shortname}
                            periodLabel={period.name[language] || period.shortname}
                            isFirstSegment={isFirstSegment}
                            locked={locked}
                            dwellTimeSeconds={dwellTimeSeconds}
                            arrivalTimePrevSeconds={activeSegmentIndex > 0 ? getArrivalTimeAfterSegment(activeSegmentIndex - 1, period.shortname) : 0}
                            departureTimeSeconds={getDepartureTimeAtSegment(activeSegmentIndex, period.shortname)}
                            segmentTimeSeconds={getTimeForCell(activeSegmentIndex, period.shortname)}
                            arrivalTimeSeconds={getArrivalTimeAfterSegment(activeSegmentIndex, period.shortname)}
                            onSegmentTimeChange={periodCallbacks.current[period.shortname]}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default React.memo(SegmentPeriodTimesTable);
