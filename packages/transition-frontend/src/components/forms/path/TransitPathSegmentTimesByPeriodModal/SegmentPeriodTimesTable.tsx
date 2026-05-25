/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import TimeInput from './TimeInput';

type Period = {
    shortname: string;
    name: Record<string, string>;
};

type SegmentPeriodTimesTableProps = {
    periods: Period[];
    getTimeForPeriod: (periodShortname: string) => number;
    onTimeChange: (periodShortname: string, newSeconds: number) => void;
};

const SegmentPeriodTimesTable: React.FunctionComponent<SegmentPeriodTimesTableProps> = ({
    periods,
    getTimeForPeriod,
    onTimeChange
}) => {
    const { t, i18n } = useTranslation('transit');

    return (
        <div className="period-table-wrapper">
            <table className="period-table">
                <thead>
                    <tr>
                        <th className="period-table-th">{t('transit:transitPath:Period')}</th>
                        <th className="period-table-th center">{t('transit:transitPath:SegmentTime')}</th>
                    </tr>
                </thead>
                <tbody>
                    {periods.map((period) => (
                        <tr key={period.shortname} className="period-table-row">
                            <td className="period-table-td">{period.name[i18n.language] || period.shortname}</td>
                            <td className="period-table-td center">
                                <TimeInput
                                    seconds={getTimeForPeriod(period.shortname)}
                                    onChange={(newSec) => onTimeChange(period.shortname, newSec)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SegmentPeriodTimesTable;
