/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import MathJax from 'react-mathjax';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import pathStatsFormula from 'transition-common/lib/config/path/pathStats';
import Path from 'transition-common/lib/services/path/Path';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

interface StatsRowProps extends WithTranslation {
    variable: string;
    value: any;
    defaultValue?: any;
}

const StatsRowBase: React.FunctionComponent<StatsRowProps> = (props: StatsRowProps) => {
    const value = props.value !== null && props.value !== undefined ? props.value : props.defaultValue || '?';
    const pathStatFormula = pathStatsFormula[props.variable];
    const {
        translatableString,
        latexExpression,
        unit = undefined
    } = typeof pathStatFormula === 'string'
        ? { translatableString: `variable:${props.variable}`, latexExpression: props.variable }
        : pathStatFormula;
    return (
        <tr>
            <th>{props.t(translatableString)}</th>
            <td className="_latex">
                <MathJax.Node inline formula={latexExpression} />
            </td>
            <td>{`${value}${unit ? ` ${unit}` : ''}`}</td>
        </tr>
    );
};
const StatsRow = withTranslation(['transit'])(StatsRowBase);

const SimpleRow: React.FunctionComponent<{ header: string; value?: string | number; isHeader?: boolean }> = ({
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
}

const TransitPathStatistics: React.FunctionComponent<PathStatsProps> = (props: PathStatsProps) => {
    const path = props.path;
    const pathData = path.getAttributes().data;
    const variables = pathData.variables;
    const firstNode = props.firstNode;
    const lastNode = props.lastNode;

    const temporalTortuosity = path.getTemporalTortuosity();
    const temporalTortuosityWithoutDwellTimes = path.getTemporalTortuosityWithoutDwellTimes();
    const spatialTortuosity = path.getSpatialTortuosity();
    const euclidianTortuosity = path.getEuclidianTortuosity();
    const totalWeight = path.getTotalWeight();
    const averageRelativeWeight = path.getAverageRelativeWeight();

    return (
        <table className="_statistics">
            <tbody>
                {variables && <StatsRow variable="d_p" value={variables.d_p} />}
                {variables && <StatsRow variable="n_q_p" value={variables.n_q_p} />}
                {variables && <StatsRow variable="d_l_min" value={variables.d_l_min} />}
                {variables && <StatsRow variable="d_l_max" value={variables.d_l_max} />}
                {variables && <StatsRow variable="d_l_avg" value={variables.d_l_avg} />}
                {variables && <StatsRow variable="d_l_med" value={variables.d_l_med} />}
                {variables && (
                    <StatsRow variable="q'_T" value={firstNode ? firstNode.properties.name : ''} defaultValue="" />
                )}
                {variables && (
                    <StatsRow variable="q''_T" value={lastNode ? lastNode.properties.name : ''} defaultValue="" />
                )}
                {variables && <StatsRow variable="T_o_p" value={roundToDecimals((variables.T_o_p || 0) / 60, 1)} />}

                <SimpleRow header={props.t('transit:transitPath:TravelTimes')} isHeader={true} />
                <SimpleRow
                    header={props.t('transit:transitPath:IncludingDwellTimes')}
                    value={`${Math.ceil((pathData.operatingTimeWithoutLayoverTimeSeconds || 0) / 60)} min`}
                />
                <SimpleRow
                    header={props.t('transit:transitPath:ExcludingDwellTimes')}
                    value={`${Math.ceil((pathData.travelTimeWithoutDwellTimesSeconds || 0) / 60)} min`}
                />
                <SimpleRow
                    header={props.t('transit:transitPath:IncludingDwellTimesAndLayover')}
                    value={`${Math.ceil((pathData.operatingTimeWithLayoverTimeSeconds || 0) / 60)} min`}
                />
                <SimpleRow
                    header={props.t('transit:transitPath:LayoverTime')}
                    value={`${pathData.layoverTimeSeconds} s`}
                />

                <SimpleRow header={props.t('transit:transitPath:Speeds')} isHeader={true} />
                <SimpleRow
                    header={props.t('transit:transitPath:ExcludingDwellTimes')}
                    value={`${
                        Math.round((pathData.averageSpeedWithoutDwellTimesMetersPerSecond || 0) * 3.6 * 100) / 100
                    } km/h`}
                />
                <SimpleRow
                    header={props.t('transit:transitPath:OperatingSpeed')}
                    value={`${Math.round((pathData.operatingSpeedMetersPerSecond || 0) * 3.6 * 10) / 10} km/h`}
                />

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
                    <SimpleRow header={props.t('transit:transitPath:TotalODWeight')} value={Math.round(totalWeight)} />
                )}
                {averageRelativeWeight && (
                    <SimpleRow
                        header={props.t('transit:transitPath:AverageRelativeODWeight')}
                        value={Math.round(averageRelativeWeight * 100) / 100}
                    />
                )}
            </tbody>
        </table>
    );
};

export default withTranslation(['transit'])(TransitPathStatistics);
