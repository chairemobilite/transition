/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useMemo } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import MathJax from 'react-mathjax';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

import SpeedUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/SpeedUnitFormatter';
import DistanceUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DistanceUnitFormatter';
import DurationUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DurationUnitFormatter';
import pathStatsFormula from 'transition-common/lib/config/path/pathStats';
import Path from 'transition-common/lib/services/path/Path';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import type { PathTravelTimeAnalysis } from 'transition-common/lib/services/path/railCurves/types';

interface StatsRowProps extends WithTranslation {
    variable: string;
    value: any;
    defaultValue?: any;
}

const StatsRowBase: React.FunctionComponent<StatsRowProps> = (props: StatsRowProps) => {
    const value = props.value !== null && props.value !== undefined ? props.value : props.defaultValue || '?';
    const pathStatFormula = pathStatsFormula[props.variable];
    const { translatableString, latexExpression } =
        typeof pathStatFormula === 'string'
            ? { translatableString: `variable:${props.variable}`, latexExpression: props.variable }
            : pathStatFormula;
    return (
        <tr>
            <th>{props.t(translatableString)}</th>
            <td className="_latex">
                <MathJax.Node inline formula={latexExpression} />
            </td>
            <td>{value}</td>
        </tr>
    );
};
const StatsRow = withTranslation(['transit'])(StatsRowBase);

const SimpleRow: React.FunctionComponent<{ header: string; value?: React.ReactNode; isHeader?: boolean }> = ({
    header,
    value = '',
    isHeader = false
}) => {
    return (
        <tr>
            <th className={isHeader ? '_header' : ''}>{header}</th>
            <td className="_latex"></td>
            <td>{value}</td>
        </tr>
    );
};

interface PathStatsProps extends WithTranslation {
    path: Path;
    firstNode: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
    lastNode: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
    curveAnalysis?: PathTravelTimeAnalysis | null;
}

const TransitPathStatistics: React.FunctionComponent<PathStatsProps> = (props: PathStatsProps) => {
    const path = props.path;
    const pathData = path.attributes.data;
    const variables = pathData.variables;
    const firstNode = props.firstNode;
    const lastNode = props.lastNode;
    const curveAnalysis = props.curveAnalysis;

    const curveAwareStats = useMemo(() => {
        if (!curveAnalysis) {
            return null;
        }

        const totalDwellTimeSeconds = (pathData.totalDwellTimeSeconds as number) || 0;
        const maxSpeedKmH = (path.getData('defaultRunningSpeedKmH') as number) || 80;
        const runningSpeedMps = (maxSpeedKmH * 1000) / 3600;
        const noDwellNoCurvesTimeSeconds =
            runningSpeedMps > 0 ? curveAnalysis.totalDistanceMeters / runningSpeedMps : 0;

        const operatingTimeNoCurvesSeconds = noDwellNoCurvesTimeSeconds + totalDwellTimeSeconds;

        return {
            operatingTimeWithoutLayoverTimeSeconds: curveAnalysis.totalTimeWithCurvesSeconds + totalDwellTimeSeconds,
            operatingTimeNoCurvesSeconds,
            travelTimeWithoutDwellTimesSeconds: curveAnalysis.totalNoDwellCurveTimeSeconds,
            travelTimeWithoutDwellTimesNoCurvesSeconds: noDwellNoCurvesTimeSeconds,
            averageSpeedWithoutDwellTimesMetersPerSecond:
                curveAnalysis.totalNoDwellCurveTimeSeconds > 0
                    ? curveAnalysis.totalDistanceMeters / curveAnalysis.totalNoDwellCurveTimeSeconds
                    : 0,
            averageSpeedWithoutDwellTimesNoCurvesMetersPerSecond: runningSpeedMps,
            operatingSpeedMetersPerSecond:
                curveAnalysis.totalTimeWithCurvesSeconds + totalDwellTimeSeconds > 0
                    ? curveAnalysis.totalDistanceMeters /
                      (curveAnalysis.totalTimeWithCurvesSeconds + totalDwellTimeSeconds)
                    : 0,
            operatingSpeedNoCurvesMetersPerSecond:
                operatingTimeNoCurvesSeconds > 0 ? curveAnalysis.totalDistanceMeters / operatingTimeNoCurvesSeconds : 0,
            geometryResolution: curveAnalysis.geometryResolution
        };
    }, [curveAnalysis, pathData.totalDwellTimeSeconds]);

    const effectiveStats = curveAwareStats
        ? {
            operatingTimeWithoutLayoverTimeSeconds: curveAwareStats.operatingTimeWithoutLayoverTimeSeconds,
            travelTimeWithoutDwellTimesSeconds: curveAwareStats.travelTimeWithoutDwellTimesSeconds,
            averageSpeedWithoutDwellTimesMetersPerSecond:
                  curveAwareStats.averageSpeedWithoutDwellTimesMetersPerSecond,
            averageSpeedWithoutDwellTimesNoCurvesMetersPerSecond:
                  curveAwareStats.averageSpeedWithoutDwellTimesNoCurvesMetersPerSecond,
            operatingSpeedMetersPerSecond: curveAwareStats.operatingSpeedMetersPerSecond
        }
        : {
            operatingTimeWithoutLayoverTimeSeconds: pathData.operatingTimeWithoutLayoverTimeSeconds,
            travelTimeWithoutDwellTimesSeconds: pathData.travelTimeWithoutDwellTimesSeconds,
            averageSpeedWithoutDwellTimesMetersPerSecond: pathData.averageSpeedWithoutDwellTimesMetersPerSecond,
            operatingSpeedMetersPerSecond: pathData.operatingSpeedMetersPerSecond
        };

    const temporalTortuosity = path.getTemporalTortuosity();
    const temporalTortuosityWithoutDwellTimes = path.getTemporalTortuosityWithoutDwellTimes();
    const spatialTortuosity = path.getSpatialTortuosity();
    const euclidianTortuosity = path.getEuclidianTortuosity();
    const totalWeight = path.getTotalWeight();
    const averageRelativeWeight = path.getAverageRelativeWeight();

    return (
        <React.Fragment>
            <table className="_statistics">
                <tbody>
                    {variables && (
                        <StatsRow
                            variable="d_p"
                            value={
                                !_isBlank(variables.d_p) ? (
                                    <DistanceUnitFormatter
                                        value={variables.d_p as number}
                                        sourceUnit="m"
                                        destinationUnit="km"
                                    />
                                ) : (
                                    '?'
                                )
                            }
                        />
                    )}
                    {variables && <StatsRow variable="n_q_p" value={variables.n_q_p} />}
                    {variables && (
                        <StatsRow
                            variable="d_l_min"
                            value={
                                !_isBlank(variables.d_l_min) ? (
                                    <DistanceUnitFormatter
                                        value={variables.d_l_min as number}
                                        sourceUnit="m"
                                        destinationUnit="m"
                                    />
                                ) : (
                                    '?'
                                )
                            }
                        />
                    )}
                    {variables && (
                        <StatsRow
                            variable="d_l_max"
                            value={
                                !_isBlank(variables.d_l_max) ? (
                                    <DistanceUnitFormatter
                                        value={variables.d_l_max as number}
                                        sourceUnit="m"
                                        destinationUnit="m"
                                    />
                                ) : (
                                    '?'
                                )
                            }
                        />
                    )}
                    {variables && (
                        <StatsRow
                            variable="d_l_avg"
                            value={
                                !_isBlank(variables.d_l_avg) ? (
                                    <DistanceUnitFormatter
                                        value={variables.d_l_avg as number}
                                        sourceUnit="m"
                                        destinationUnit="m"
                                    />
                                ) : (
                                    '?'
                                )
                            }
                        />
                    )}
                    {variables && (
                        <StatsRow
                            variable="d_l_med"
                            value={
                                !_isBlank(variables.d_l_med) ? (
                                    <DistanceUnitFormatter
                                        value={variables.d_l_med as number}
                                        sourceUnit="m"
                                        destinationUnit="m"
                                    />
                                ) : (
                                    '?'
                                )
                            }
                        />
                    )}
                    {variables && (
                        <StatsRow variable="q'_T" value={firstNode ? firstNode.properties.name : ''} defaultValue="" />
                    )}
                    {variables && (
                        <StatsRow variable="q''_T" value={lastNode ? lastNode.properties.name : ''} defaultValue="" />
                    )}
                    {variables && (
                        <StatsRow
                            variable="T_o_p"
                            value={
                                !_isBlank(variables.T_o_p) ? (
                                    <DurationUnitFormatter
                                        value={variables.T_o_p as number}
                                        sourceUnit="s"
                                        destinationUnit="m"
                                    />
                                ) : (
                                    '0'
                                )
                            }
                        />
                    )}

                    <SimpleRow header={props.t('transit:transitPath:TravelTimes')} isHeader={true} />
                    <SimpleRow
                        header={props.t(
                            curveAwareStats && curveAwareStats.geometryResolution === 'high'
                                ? 'transit:transitPath:IncludingDwellTimesWithCurves'
                                : 'transit:transitPath:IncludingDwellTimes'
                        )}
                        value={
                            <DurationUnitFormatter
                                value={effectiveStats.operatingTimeWithoutLayoverTimeSeconds || 0}
                                sourceUnit="s"
                                destinationUnit="m"
                            />
                        }
                    />
                    {curveAwareStats && curveAwareStats.geometryResolution === 'high' && (
                        <SimpleRow
                            header={props.t('transit:transitPath:IncludingDwellTimesNoCurves')}
                            value={
                                <DurationUnitFormatter
                                    value={curveAwareStats.operatingTimeNoCurvesSeconds || 0}
                                    sourceUnit="s"
                                    destinationUnit="m"
                                />
                            }
                        />
                    )}
                    <SimpleRow
                        header={props.t(
                            curveAwareStats && curveAwareStats.geometryResolution === 'high'
                                ? 'transit:transitPath:ExcludingDwellTimesWithCurves'
                                : 'transit:transitPath:ExcludingDwellTimes'
                        )}
                        value={
                            <DurationUnitFormatter
                                value={effectiveStats.travelTimeWithoutDwellTimesSeconds || 0}
                                sourceUnit="s"
                                destinationUnit="m"
                            />
                        }
                    />
                    {curveAwareStats && curveAwareStats.geometryResolution === 'high' && (
                        <SimpleRow
                            header={props.t('transit:transitPath:ExcludingDwellTimesNoCurves')}
                            value={
                                <DurationUnitFormatter
                                    value={curveAwareStats.travelTimeWithoutDwellTimesNoCurvesSeconds || 0}
                                    sourceUnit="s"
                                    destinationUnit="m"
                                />
                            }
                        />
                    )}
                    <SimpleRow
                        header={props.t('transit:transitPath:IncludingDwellTimesAndLayover')}
                        value={
                            <DurationUnitFormatter
                                value={
                                    curveAwareStats
                                        ? (effectiveStats.operatingTimeWithoutLayoverTimeSeconds || 0) +
                                          ((pathData.layoverTimeSeconds as number) || 0)
                                        : (pathData.operatingTimeWithLayoverTimeSeconds as number) || 0
                                }
                                sourceUnit="s"
                                destinationUnit="m"
                            />
                        }
                    />
                    <SimpleRow
                        header={props.t('transit:transitPath:LayoverTime')}
                        value={
                            <DurationUnitFormatter
                                value={(pathData.layoverTimeSeconds as number) || 0}
                                sourceUnit="s"
                                destinationUnit="m"
                            />
                        }
                    />

                    <SimpleRow header={props.t('transit:transitPath:Speeds')} isHeader={true} />
                    <SimpleRow
                        header={props.t(
                            curveAwareStats && curveAwareStats.geometryResolution === 'high'
                                ? 'transit:transitPath:ExcludingDwellTimesWithCurves'
                                : 'transit:transitPath:ExcludingDwellTimes'
                        )}
                        value={
                            <SpeedUnitFormatter
                                value={effectiveStats.averageSpeedWithoutDwellTimesMetersPerSecond || 0}
                                sourceUnit="m/s"
                                destinationUnit="km/h"
                            />
                        }
                    />
                    {curveAwareStats && curveAwareStats.geometryResolution === 'high' && (
                        <SimpleRow
                            header={props.t('transit:transitPath:ExcludingDwellTimesNoCurves')}
                            value={
                                <SpeedUnitFormatter
                                    value={curveAwareStats.averageSpeedWithoutDwellTimesNoCurvesMetersPerSecond || 0}
                                    sourceUnit="m/s"
                                    destinationUnit="km/h"
                                />
                            }
                        />
                    )}
                    <SimpleRow
                        header={props.t(
                            curveAwareStats && curveAwareStats.geometryResolution === 'high'
                                ? 'transit:transitPath:OperatingSpeedWithCurves'
                                : 'transit:transitPath:OperatingSpeed'
                        )}
                        value={
                            <SpeedUnitFormatter
                                value={effectiveStats.operatingSpeedMetersPerSecond || 0}
                                sourceUnit="m/s"
                                destinationUnit="km/h"
                            />
                        }
                    />
                    {curveAwareStats && curveAwareStats.geometryResolution === 'high' && (
                        <SimpleRow
                            header={props.t('transit:transitPath:OperatingSpeedNoCurves')}
                            value={
                                <SpeedUnitFormatter
                                    value={curveAwareStats.operatingSpeedNoCurvesMetersPerSecond || 0}
                                    sourceUnit="m/s"
                                    destinationUnit="km/h"
                                />
                            }
                        />
                    )}

                    {temporalTortuosity && (
                        <SimpleRow
                            header={props.t('transit:transitPath:TemporalTortuosity')}
                            value={Math.round(temporalTortuosity * 100) / 100}
                        />
                    )}
                    {temporalTortuosityWithoutDwellTimes && (
                        <SimpleRow
                            header={props.t('transit:transitPath:TemporalTortuosityWithoutDwellTimes')}
                            value={Math.round(temporalTortuosityWithoutDwellTimes * 100) / 100}
                        />
                    )}
                    {spatialTortuosity && (
                        <SimpleRow
                            header={props.t('transit:transitPath:SpatialTortuosity')}
                            value={Math.round(spatialTortuosity * 100) / 100}
                        />
                    )}
                    {euclidianTortuosity && (
                        <SimpleRow
                            header={props.t('transit:transitPath:EuclidianTortuosity')}
                            value={Math.round(euclidianTortuosity * 100) / 100}
                        />
                    )}
                    {totalWeight && (
                        <SimpleRow
                            header={props.t('transit:transitPath:TotalODWeight')}
                            value={Math.round(totalWeight)}
                        />
                    )}
                    {averageRelativeWeight && (
                        <SimpleRow
                            header={props.t('transit:transitPath:AverageRelativeODWeight')}
                            value={Math.round(averageRelativeWeight * 100) / 100}
                        />
                    )}
                </tbody>
            </table>
        </React.Fragment>
    );
};

export default withTranslation(['transit'])(TransitPathStatistics);
