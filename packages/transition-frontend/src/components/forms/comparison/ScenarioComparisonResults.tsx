/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import TransitRoutingStepWalkButton from '../transitRouting/TransitRoutingStepWalkButton';
import TransitRoutingStepRideButton from '../transitRouting/TransitRoutingStepRideButton';
import { secondsToMinutes, secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { TrRoutingV2 } from 'chaire-lib-common/lib/api/TrRouting';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { TrRoutingRoute } from 'chaire-lib-common/lib/services/transitRouting/types';

export interface ScenarioComparisonResultsProps {
    paths: {
        path1: TrRoutingRoute;
        path2: TrRoutingRoute;
    };
    request: TransitRoutingAttributes;
    hasAlternativeWalkPath: {
        result1: boolean;
        result2: boolean;
    };
}

const insertStepButtons = (buttonArray: JSX.Element[], path: TrRoutingRoute, useAlternateColor: boolean) => {
    const textColor = useAlternateColor ? '#ff00ff' : undefined;
    path.steps.forEach((step, stepIndex) => {
        if (step.action === 'walking') {
            const boardingStep = path.steps[stepIndex + 1] as TrRoutingV2.TripStepBoarding;
            buttonArray.push(
                <TransitRoutingStepWalkButton
                    step={step}
                    stepIndex={stepIndex}
                    key={`step${stepIndex}`}
                    waitingTimeSeconds={path.steps[stepIndex + 1] ? boardingStep.waitingTime : undefined}
                    textColor={textColor}
                />
            );
        } else if (step.action === 'boarding') {
            const boardingStep = step as TrRoutingV2.TripStepBoarding;
            const alightingStep = path.steps[stepIndex + 1] as TrRoutingV2.TripStepUnboarding;
            buttonArray.push(
                <TransitRoutingStepRideButton
                    boardingStep={boardingStep}
                    alightingStep={alightingStep}
                    stepIndex={stepIndex}
                    key={`step${stepIndex}`}
                    textColor={textColor}
                />
            );
        }
    });
};

const ScenarioComparisonResults: React.FunctionComponent<ScenarioComparisonResultsProps> = (
    props: ScenarioComparisonResultsProps
) => {
    const { t } = useTranslation(['transit', 'main']);

    const stepsButtons1: JSX.Element[] = [];
    const stepsButtons2: JSX.Element[] = [];
    const path1 = props.paths.path1;
    const path2 = props.paths.path2;

    if (path1 && path2) {
        // Display a TrRoutingRoute
        insertStepButtons(stepsButtons1, path1, false);
        insertStepButtons(stepsButtons2, path2, true);

        const nonOptimisedTravelTimeSeconds1 =
            path1.timeOfTripType === 'departure'
                ? path1.arrivalTime - path1.timeOfTrip
                : path1.totalTravelTime + (path1.timeOfTrip - path1.arrivalTime);

        const nonOptimisedTravelTimeSeconds2 =
            path2.timeOfTripType === 'departure'
                ? path2.arrivalTime - path2.timeOfTrip
                : path2.totalTravelTime + (path2.timeOfTrip - path2.arrivalTime);

        return (
            <div className="tr__form-section">
                <table className="_statistics" border={1} style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th></th>
                            <th>{t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })}</th>
                            <th>
                                <div style={{ color: '#ff00ff' }}>
                                    {t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {(props.hasAlternativeWalkPath.result1 || props.hasAlternativeWalkPath.result2) && (
                            <tr>
                                <th>{t('transit:transitRouting:results:AlternativeWalkPath')}</th>
                                <td>
                                    {props.hasAlternativeWalkPath.result1
                                        ? t('transit:transitRouting:results:true')
                                        : t('transit:transitRouting:results:false')}
                                </td>
                                <td>
                                    {props.hasAlternativeWalkPath.result2
                                        ? t('transit:transitRouting:results:true')
                                        : t('transit:transitRouting:results:false')}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th>{t('transit:transitRouting:results:OptimisedTravelTime')}</th>
                            <td title={`${path1.totalTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.totalTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.totalTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.totalTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:NonOptimisedTravelTime')}</th>
                            <td title={`${nonOptimisedTravelTimeSeconds1} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(nonOptimisedTravelTimeSeconds1)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${nonOptimisedTravelTimeSeconds2} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(nonOptimisedTravelTimeSeconds2)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        {path1.timeOfTripType === 'departure' && ( // timeOfTripType will be the same for the two paths
                            <tr>
                                <th>{t('transit:transitRouting:results:EnteredDepartureTime')}</th>
                                <td>{secondsSinceMidnightToTimeStr(path1.timeOfTrip)}</td>
                                <td>{secondsSinceMidnightToTimeStr(path2.timeOfTrip)}</td>
                            </tr>
                        )}
                        <tr>
                            <th>
                                {path1.timeOfTripType === 'departure'
                                    ? t('transit:transitRouting:results:OptimisedDepartureTime')
                                    : t('transit:transitRouting:results:DepartureTime')}
                            </th>
                            <td>{secondsSinceMidnightToTimeStr(path1.departureTime)}</td>
                            <td>{secondsSinceMidnightToTimeStr(path2.departureTime)}</td>
                        </tr>
                        {path1.timeOfTripType === 'departure' && (
                            <tr>
                                <th>{t('transit:transitRouting:results:LostTimeAtDepartureIfNonOptimised')}</th>
                                <td
                                    title={`${nonOptimisedTravelTimeSeconds1 - path1.totalTravelTime} ${t(
                                        'main:secondAbbr'
                                    )}.`}
                                >
                                    {secondsToMinutes(nonOptimisedTravelTimeSeconds1 - path1.totalTravelTime)}{' '}
                                    {t('main:minuteAbbr')}.
                                </td>
                                <td
                                    title={`${nonOptimisedTravelTimeSeconds2 - path2.totalTravelTime} ${t(
                                        'main:secondAbbr'
                                    )}.`}
                                >
                                    {secondsToMinutes(nonOptimisedTravelTimeSeconds2 - path2.totalTravelTime)}{' '}
                                    {t('main:minuteAbbr')}.
                                </td>
                            </tr>
                        )}
                        {path1.timeOfTripType === 'arrival' && (
                            <tr>
                                <th>{t('transit:transitRouting:results:EnteredArrivalTime')}</th>
                                <td>{secondsSinceMidnightToTimeStr(path1.timeOfTrip)}</td>
                                <td>{secondsSinceMidnightToTimeStr(path2.timeOfTrip)}</td>
                            </tr>
                        )}
                        <tr>
                            <th>{t('transit:transitRouting:results:ArrivalTime')}</th>
                            <td>{secondsSinceMidnightToTimeStr(path1.arrivalTime)}</td>
                            <td>{secondsSinceMidnightToTimeStr(path2.arrivalTime)}</td>
                        </tr>
                        {path1.timeOfTripType === 'arrival' && (
                            <tr>
                                <th>{t('transit:transitRouting:results:LostTimeAtArrivalIfNonOptimised')}</th>
                                <td title={`${path1.timeOfTrip - path1.arrivalTime} ${t('main:secondAbbr')}.`}>
                                    {secondsToMinutes(path1.timeOfTrip - path1.arrivalTime)} {t('main:minuteAbbr')}.
                                </td>
                                <td title={`${path2.timeOfTrip - path2.arrivalTime} ${t('main:secondAbbr')}.`}>
                                    {secondsToMinutes(path2.timeOfTrip - path2.arrivalTime)} {t('main:minuteAbbr')}.
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th>{t('transit:transitRouting:results:TotalDistance')}</th>
                            <td title={`${path1.totalDistance} m`}>{path1.totalDistance} m</td>
                            <td title={`${path2.totalDistance} m`}>{path2.totalDistance} m</td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:AccessTravelTime')}</th>
                            <td title={`${path1.accessTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.accessTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.accessTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.accessTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:EgressTravelTime')}</th>
                            <td title={`${path1.egressTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.egressTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.egressTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.egressTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:NumberOfTransfers')}</th>
                            <td>{path1.numberOfTransfers}</td>
                            <td>{path2.numberOfTransfers}</td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:TotalTransferTravelTime')}</th>
                            <td title={`${path1.transferWalkingTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.transferWalkingTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.transferWalkingTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.transferWalkingTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:TotalInVehicleTime')}</th>
                            <td title={`${path1.totalInVehicleTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.totalInVehicleTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.totalInVehicleTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.totalInVehicleTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:TotalAccessTravelTime')}</th>
                            <td title={`${path1.totalNonTransitTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.totalNonTransitTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.totalNonTransitTravelTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.totalNonTransitTravelTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:results:TotalTransferWaitingTime')}</th>
                            <td title={`${path1.transferWaitingTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path1.transferWaitingTime)} {t('main:minuteAbbr')}.
                            </td>
                            <td title={`${path2.transferWaitingTime} ${t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path2.transferWaitingTime)} {t('main:minuteAbbr')}.
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div className="tr__list-transit-routing-steps-list-container">
                        <ul className="tr__list-transit-routing-steps _list-container">{stepsButtons1}</ul>
                    </div>
                    <div className="tr__list-transit-routing-steps-list-container">
                        <ul className="tr__list-transit-routing-steps _list-container">{stepsButtons2}</ul>
                    </div>
                </div>
            </div>
        );
    } else {
        return null;
    }
};

export default ScenarioComparisonResults;
