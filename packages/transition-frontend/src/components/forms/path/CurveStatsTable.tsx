/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import DistanceUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DistanceUnitFormatter';
import DurationUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DurationUnitFormatter';
import SpeedUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/SpeedUnitFormatter';
import type { SegmentTravelTimeResult } from 'transition-common/lib/services/path/railCurves/types';

export interface CurveStatsTableProps {
    segments: SegmentTravelTimeResult[];
    /** Index of the segment to visually highlight (optional) */
    highlightedSegmentIndex?: number;
    /** Whether curve-specific columns (with/without curves, difference, radius, speed limit) should be shown */
    showCurveColumns?: boolean;
}

/**
 * Per-segment breakdown table showing travel time with/without curves,
 * minimum radius and curve speed limit for each segment.
 * When showCurveColumns is false, only distance and travel time are shown.
 */
const CurveStatsTable: React.FC<CurveStatsTableProps> = ({
    segments,
    highlightedSegmentIndex,
    showCurveColumns = true
}) => {
    const { t } = useTranslation(['transit']);

    return (
        <div className="curve-stats-segments">
            <h4>{t('transit:transitPath:PerSegmentBreakdown')}</h4>
            <div className="curve-stats-table-container">
                <table className="_statistics _small curve-stats-table">
                    <thead>
                        <tr>
                            <th>{t('transit:transitPath:Segment')}</th>
                            <th>{t('transit:transitPath:Distance')}</th>
                            {showCurveColumns ? (
                                <>
                                    <th>{t('transit:transitPath:TimeWithoutCurves')}</th>
                                    <th>{t('transit:transitPath:TimeWithCurves')}</th>
                                    <th>{t('transit:transitPath:Difference')}</th>
                                    <th>{t('transit:transitPath:MinRadius')}</th>
                                    <th>{t('transit:transitPath:CurveSpeedLimit')}</th>
                                </>
                            ) : (
                                <th>{t('transit:transitPath:TravelTime')}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {segments.map((segment, index) => {
                            const isHighlighted = highlightedSegmentIndex === index;

                            return (
                                <tr
                                    key={segment.segmentIndex}
                                    className={isHighlighted ? 'curve-stats-highlighted' : ''}
                                >
                                    <td>{index + 1}</td>
                                    <td>
                                        <DistanceUnitFormatter
                                            value={segment.distanceMeters}
                                            sourceUnit="m"
                                            destinationUnit="m"
                                        />
                                    </td>
                                    {showCurveColumns ? (
                                        <>
                                            <td>
                                                <DurationUnitFormatter
                                                    value={segment.travelTimeWithoutCurvesSeconds}
                                                    sourceUnit="s"
                                                    destinationUnit="s"
                                                />
                                            </td>
                                            <td>
                                                <DurationUnitFormatter
                                                    value={segment.travelTimeWithCurvesSeconds}
                                                    sourceUnit="s"
                                                    destinationUnit="s"
                                                />
                                            </td>
                                            <td className={segment.differenceSeconds > 0 ? 'positive-diff' : ''}>
                                                {segment.differenceSeconds > 0 ? '+' : ''}
                                                {segment.differenceSeconds}s
                                            </td>
                                            <td>
                                                {segment.minRadiusInSegmentMeters !== null ? (
                                                    <DistanceUnitFormatter
                                                        value={segment.minRadiusInSegmentMeters}
                                                        sourceUnit="m"
                                                        destinationUnit="m"
                                                    />
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td>
                                                {segment.curveSpeedLimitKmH !== null ? (
                                                    <SpeedUnitFormatter
                                                        value={(segment.curveSpeedLimitKmH * 1000) / 3600}
                                                        sourceUnit="m/s"
                                                        destinationUnit="km/h"
                                                    />
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                        </>
                                    ) : (
                                        <td>
                                            <DurationUnitFormatter
                                                value={segment.travelTimeWithCurvesSeconds}
                                                sourceUnit="s"
                                                destinationUnit="s"
                                            />
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CurveStatsTable;
