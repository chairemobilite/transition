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
import type { PathTravelTimeAnalysis, TimeSpeedProfile } from 'transition-common/lib/services/path/railCurves/types';

type ChartXAxisMode = 'time' | 'distance';

const CHART_TIME_TICK_INTERVAL_MIN = 1;
const CHART_DISTANCE_TICK_INTERVAL_KM = 0.25;
const CHART_PIXELS_PER_TICK = 60;
const CHART_MIN_WIDTH_PX = 600;

export interface CurveStatsPanelProps {
    travelTimeAnalysis: PathTravelTimeAnalysis | null;
    speedProfile: TimeSpeedProfile | null;
    maxSpeedKmH: number;
}

export const CurveStatsPanel: React.FC<CurveStatsPanelProps> = ({ travelTimeAnalysis, speedProfile, maxSpeedKmH }) => {
    const { t } = useTranslation(['transit', 'main']);
    const [chartXAxisMode, setChartXAxisMode] = useState<ChartXAxisMode>('time');
    const chartContainerRef = useRef<HTMLDivElement>(null);

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

    if (!travelTimeAnalysis) {
        return null;
    }

    return (
        <div className="curve-stats-panel">
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

            <CurveStatsTable
                segments={travelTimeAnalysis.segments}
                showCurveColumns={travelTimeAnalysis.geometryResolution === 'high'}
            />
        </div>
    );
};

export default CurveStatsPanel;
