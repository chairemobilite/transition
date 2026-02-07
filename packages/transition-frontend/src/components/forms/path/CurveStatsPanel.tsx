/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

import CurveStatsTable from './CurveStatsTable';
import Path from 'transition-common/lib/services/path/Path';
import { analyzePathSegmentTravelTimes } from 'transition-common/lib/services/path/railCurves/segmentTravelTime';
import { getSpeedByTimeWithDwellTimes } from 'transition-common/lib/services/path/railCurves/speedProfile';
import type { PathTravelTimeAnalysis, TimeSpeedProfile } from 'transition-common/lib/services/path/railCurves/types';
import {
    getDefaultRunningSpeedKmH,
    getDefaultAcceleration,
    getDefaultDeceleration
} from 'transition-common/lib/services/line/types';
import type { RailMode } from 'transition-common/lib/services/line/types';

type ChartXAxisMode = 'time' | 'distance';

// Speed profile chart configuration constants.
// TODO: These tick intervals are fixed values that work well for typical
// urban/suburban paths. For very long paths (e.g. 2+ hour HSR routes)
// or very short paths (e.g. < 5 min tram segments), it would be better
// to compute the tick interval dynamically based on the total duration
// or distance, so the chart doesn't end up with too many or too few ticks.

/** Time axis tick interval in minutes */
const CHART_TIME_TICK_INTERVAL_MIN = 1;
/** Distance axis tick interval in kilometers */
const CHART_DISTANCE_TICK_INTERVAL_KM = 0.25;
/** Speed profile sampling interval in seconds (see getSpeedByTimeWithDwellTimes) */
const SPEED_PROFILE_INTERVAL_SECONDS = 2;
/** Pixels allocated per tick mark on the chart X-axis (controls how "stretched" the plot is) */
const CHART_PIXELS_PER_TICK = 60;
/** Minimum chart width in pixels (ensures the chart is readable even for very short paths) */
const CHART_MIN_WIDTH_PX = 600;

export interface CurveStatsPanelProps {
    path: Path;
    highlightedSegmentIndex?: number;
    /** Running speed in km/h. Falls back to the mode-aware default from getDefaultRunningSpeedKmH. */
    maxSpeedKmH?: number;
}

/**
 * Inline panel displaying curve-aware travel time statistics and speed profile
 * chart for a transit path. Intended to be placed directly in the right panel
 * after the statistics section.
 */
export const CurveStatsPanel: React.FC<CurveStatsPanelProps> = ({
    path,
    highlightedSegmentIndex,
    maxSpeedKmH: maxSpeedKmHProp
}) => {
    const pathMode = path.getMode() as RailMode | undefined;
    const maxSpeedKmH = maxSpeedKmHProp ?? getDefaultRunningSpeedKmH(pathMode);
    const { t } = useTranslation(['transit', 'main']);
    const [chartXAxisMode, setChartXAxisMode] = useState<ChartXAxisMode>('time');
    const chartContainerRef = useRef<HTMLDivElement>(null);

    const accelerationMps2 = path.getData('defaultAcceleration', getDefaultAcceleration(pathMode)) as number;
    const decelerationMps2 = path.getData('defaultDeceleration', getDefaultDeceleration(pathMode)) as number;

    // Stable primitive key derived from the mutable path object so that
    // useMemo re-runs when the geometry actually changes (including
    // intermediate waypoint edits), even though the path object reference
    // stays the same. We hash all coordinates so any edit is detected.
    const geographyKey = useMemo(() => {
        const coords = path.attributes?.geography?.coordinates;
        if (!coords || coords.length === 0) return '';
        // Simple DJB2-style hash over all coordinate values — fast and
        // sufficient for change detection (not cryptographic).
        // 5381 is the traditional DJB2 starting value chosen by Daniel
        // J. Bernstein; it produces good distribution for short inputs.
        let hash = 5381;
        for (let i = 0; i < coords.length; i++) {
            hash = ((hash << 5) + hash + coords[i][0] * 1e6) | 0;
            hash = ((hash << 5) + hash + coords[i][1] * 1e6) | 0;
        }
        return `${coords.length}:${hash}`;
    }, [path.attributes?.geography]);

    const curveAnalysis: PathTravelTimeAnalysis | null = useMemo(() => {
        return analyzePathSegmentTravelTimes(path, {
            mode: pathMode || 'rail',
            runningSpeedKmH: maxSpeedKmH,
            accelerationMps2,
            decelerationMps2,
            maxSpeedKmH: maxSpeedKmH
        });
    }, [path, maxSpeedKmH, pathMode, accelerationMps2, decelerationMps2, geographyKey]);

    const speedProfile: TimeSpeedProfile | null = useMemo(() => {
        const geography = path.attributes?.geography;
        const segments = path.attributes?.segments;
        const dwellTimes = path.attributes?.data?.dwellTimeSeconds || [];

        if (!geography || !segments || segments.length < 1) {
            return null;
        }

        return getSpeedByTimeWithDwellTimes(
            geography,
            segments,
            dwellTimes,
            {
                mode: pathMode || 'rail',
                runningSpeedKmH: maxSpeedKmH,
                accelerationMps2,
                decelerationMps2,
                maxSpeedKmH: maxSpeedKmH,
                initialSpeedKmH: 0,
                finalSpeedKmH: 0
            },
            SPEED_PROFILE_INTERVAL_SECONDS
        );
    }, [path, maxSpeedKmH, pathMode, accelerationMps2, decelerationMps2, geographyKey]);

    const stationDistancesKm = useMemo(() => {
        if (!speedProfile) return [];
        const distances: number[] = [];
        let lastDistanceKm: number | null = null;

        for (const pt of speedProfile.points) {
            if (pt.isDwelling) {
                const distKm = Math.round((pt.distanceMeters / 1000) * 100) / 100;
                if (lastDistanceKm === null || distKm !== lastDistanceKm) {
                    distances.push(distKm);
                    lastDistanceKm = distKm;
                }
            }
        }
        return distances;
    }, [speedProfile]);

    const xAxisTicks = useMemo(() => {
        if (!speedProfile) return [];
        if (chartXAxisMode === 'time') {
            const totalMin = speedProfile.totalTimeSeconds / 60;
            const ticks: number[] = [];
            for (let m = 0; m <= Math.ceil(totalMin); m += CHART_TIME_TICK_INTERVAL_MIN) {
                ticks.push(m);
            }
            return ticks;
        } else {
            const totalKm = speedProfile.totalDistanceMeters / 1000;
            const interval = CHART_DISTANCE_TICK_INTERVAL_KM;
            const ticks: number[] = [];
            for (let d = 0; d <= Math.ceil(totalKm / interval) * interval; d += interval) {
                ticks.push(Math.round(d * 100) / 100);
            }
            return ticks;
        }
    }, [speedProfile, chartXAxisMode]);

    const chartData = useMemo(() => {
        if (!speedProfile) return [];
        const allPoints = speedProfile.points.map((pt) => ({
            timeMinutes: Math.round((pt.timeSeconds / 60) * 100) / 100,
            timeSeconds: pt.timeSeconds,
            distanceKm: Math.round((pt.distanceMeters / 1000) * 100) / 100,
            speedKmH: Math.round(pt.speedKmH),
            maxSpeedByRadiusKmH: Math.round(pt.maxSpeedByRadiusKmH),
            isDwelling: pt.isDwelling
        }));

        if (chartXAxisMode === 'distance') {
            const filteredPoints: typeof allPoints = [];
            let lastDistanceKm: number | null = null;

            for (const pt of allPoints) {
                if (pt.isDwelling) continue;
                if (lastDistanceKm !== null && pt.distanceKm === lastDistanceKm && pt.speedKmH === 0) continue;
                filteredPoints.push(pt);
                lastDistanceKm = pt.distanceKm;
            }
            return filteredPoints;
        }

        return allPoints;
    }, [speedProfile, chartXAxisMode]);

    if (!curveAnalysis) {
        return null;
    }

    return (
        <div className="curve-stats-panel">
            {/* Speed Profile Chart */}
            {speedProfile && chartData.length > 0 && (
                <div className="curve-stats-chart">
                    <div className="curve-stats-chart-header">
                        <h4>{t('transit:transitPath:SpeedProfile')}</h4>
                        <div className="curve-stats-chart-controls">
                            <div className="curve-stats-chart-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${chartXAxisMode === 'time' ? 'active' : ''}`}
                                    onClick={() => setChartXAxisMode('time')}
                                    aria-pressed={chartXAxisMode === 'time'}
                                >
                                    {t('transit:transitPath:SpeedVsTime')}
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${chartXAxisMode === 'distance' ? 'active' : ''}`}
                                    onClick={() => setChartXAxisMode('distance')}
                                    aria-pressed={chartXAxisMode === 'distance'}
                                >
                                    {t('transit:transitPath:SpeedVsDistance')}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div ref={chartContainerRef} style={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%' }}>
                        <LineChart
                            data={chartData}
                            width={Math.max(CHART_MIN_WIDTH_PX, xAxisTicks.length * CHART_PIXELS_PER_TICK)}
                            height={300}
                            margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis
                                dataKey={chartXAxisMode === 'time' ? 'timeMinutes' : 'distanceKm'}
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                ticks={xAxisTicks}
                                label={{
                                    value:
                                        chartXAxisMode === 'time'
                                            ? t('transit:transitPath:TimeMinutes')
                                            : t('transit:transitPath:DistanceKm'),
                                    position: 'insideBottomRight',
                                    offset: 0
                                }}
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis
                                domain={[0, Math.ceil((maxSpeedKmH * 1.1) / 10) * 10]}
                                label={{
                                    value: t('transit:transitPath:SpeedKmH'),
                                    angle: -90,
                                    position: 'insideLeft',
                                    offset: 10
                                }}
                                tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                                formatter={(value, name) => {
                                    const label =
                                        name === 'speedKmH'
                                            ? t('transit:transitPath:ActualSpeed')
                                            : t('transit:transitPath:MaxSpeedByCurve');
                                    return [`${value} km/h`, label];
                                }}
                                labelFormatter={(value) => (chartXAxisMode === 'time' ? `${value} min` : `${value} km`)}
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px'
                                }}
                            />
                            <Legend
                                verticalAlign="top"
                                align="left"
                                height={36}
                                formatter={(value: string) => {
                                    if (value === 'speedKmH') return t('transit:transitPath:ActualSpeed');
                                    if (value === 'maxSpeedByRadiusKmH')
                                        return t('transit:transitPath:MaxSpeedByCurve');
                                    return value;
                                }}
                            />
                            <ReferenceLine
                                y={maxSpeedKmH}
                                stroke="#999"
                                strokeDasharray="5 5"
                                label={{
                                    value: t('transit:transitPath:RunningSpeed'),
                                    position: 'right',
                                    fontSize: 10,
                                    fill: '#666'
                                }}
                            />
                            {chartXAxisMode === 'time'
                                ? speedProfile.stationTimes.map((time, idx) => (
                                    <ReferenceLine
                                        key={`station-${idx}`}
                                        x={Math.round((time / 60) * 100) / 100}
                                        stroke="#2196f3"
                                        strokeDasharray="2 2"
                                        strokeWidth={1}
                                    />
                                ))
                                : stationDistancesKm.map((dist, idx) => (
                                    <ReferenceLine
                                        key={`station-dist-${idx}`}
                                        x={dist}
                                        stroke="#2196f3"
                                        strokeDasharray="2 2"
                                        strokeWidth={1}
                                    />
                                ))}
                            <Line
                                type="monotone"
                                dataKey="maxSpeedByRadiusKmH"
                                stroke="#ffcc80"
                                strokeWidth={2}
                                dot={false}
                                name="maxSpeedByRadiusKmH"
                            />
                            <Line
                                type="monotone"
                                dataKey="speedKmH"
                                stroke="#1976d2"
                                strokeWidth={2}
                                dot={false}
                                name="speedKmH"
                            />
                        </LineChart>
                    </div>
                </div>
            )}

            {/* Per-Segment Breakdown */}
            <CurveStatsTable
                segments={curveAnalysis.segments}
                highlightedSegmentIndex={highlightedSegmentIndex}
                showCurveColumns={curveAnalysis.geometryResolution === 'high'}
            />
        </div>
    );
};

export default CurveStatsPanel;
