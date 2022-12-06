/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import TransitRoutingStepWalkButton from './TransitRoutingStepWalkButton';
import TransitRoutingStepRideButton from './TransitRoutingStepRideButton';
import RouteButton from './RouteButton';
import { secondsToMinutes, secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { TrRoutingBoardingStep, TrRoutingPath, TrRoutingUnboardingStep } from 'chaire-lib-common/lib/api/TrRouting';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';

// TODO: extract these typeguards elsewhere:
const pathIsRoute = (path: Route | TrRoutingPath | undefined): path is Route => {
    return typeof (path as any).distance === 'number';
};
export interface TransitRoutingResultsProps extends WithTranslation {
    path?: TrRoutingPath | Route;
    walkOnly?: Route;
    routingMode: RoutingOrTransitMode;
    request: TransitRoutingAttributes;
}

const TransitRoutingResults: React.FunctionComponent<TransitRoutingResultsProps> = (
    props: TransitRoutingResultsProps
) => {
    //const TransitRoutingResults = function({ results, activeStepIndex, t }) {

    const stepsButtons: JSX.Element[] = [];
    const path = props.path;
    const walkOnly = props.walkOnly;

    if ((!path && walkOnly) || pathIsRoute(path)) {
        const pathToDisplay = walkOnly || path;
        return (
            <React.Fragment>
                {pathToDisplay && (
                    <div className="tr__form-section">
                        <table className="_statistics">
                            <tbody>
                                {walkOnly && (
                                    <tr>
                                        <th className="_header">
                                            {props.t('transit:transitPath:routingModes:walking')}
                                        </th>
                                        <td></td>
                                    </tr>
                                )}
                                <tr>
                                    <th>{props.t('transit:transitRouting:results:TravelTime')}</th>
                                    <td title={`${pathToDisplay.duration} ${props.t('main:secondAbbr')}.`}>
                                        {secondsToMinutes(pathToDisplay.duration, Math.round)}{' '}
                                        {props.t('main:minuteAbbr')}.
                                    </td>
                                </tr>
                                <tr>
                                    <th>{props.t('transit:transitRouting:results:Distance')}</th>
                                    <td>{Math.round(pathToDisplay.distance)} m</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="tr__list-transit-routing-steps-list-container">
                            <ul className="tr__list-transit-routing-steps _list-container">
                                <RouteButton
                                    travelTimeSeconds={pathToDisplay.duration}
                                    distanceMeters={pathToDisplay.distance}
                                    key={'walkOnlyButton'}
                                    routingMode={walkOnly ? 'walking' : props.routingMode}
                                />
                            </ul>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    } else if (path) {
        path.steps.forEach((step, stepIndex) => {
            if (step.action === 'walking') {
                const boardingStep = path.steps[stepIndex + 1] as TrRoutingBoardingStep;
                stepsButtons.push(
                    <TransitRoutingStepWalkButton
                        step={step}
                        stepIndex={stepIndex}
                        key={`step${stepIndex}`}
                        waitingTimeSeconds={path.steps[stepIndex + 1] ? boardingStep.waitingTimeSeconds : undefined}
                    />
                );
            } else if (step.action === 'board') {
                const boardingStep = step as TrRoutingBoardingStep;
                const alightingStep = path.steps[stepIndex + 1] as TrRoutingUnboardingStep;
                stepsButtons.push(
                    <TransitRoutingStepRideButton
                        boardingStep={boardingStep}
                        alightingStep={alightingStep}
                        stepIndex={stepIndex}
                        key={`step${stepIndex}`}
                    />
                );
            }
        });

        const nonOptimisedTravelTimeSeconds = !_isBlank(path.initialLostTimeAtDepartureMinutes)
            ? path.totalTravelTimeSeconds + path.initialLostTimeAtDepartureSeconds
            : path.totalTravelTimeSeconds +
              ((props.request.arrivalTimeSecondsSinceMidnight || path.arrivalTimeSeconds) - path.arrivalTimeSeconds);
        return (
            <div className="tr__form-section">
                <table className="_statistics">
                    <tbody>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:OptimisedTravelTime')}</th>
                            <td title={`${path.totalTravelTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.totalTravelTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:NonOptimisedTravelTime')}</th>
                            <td title={`${nonOptimisedTravelTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(nonOptimisedTravelTimeSeconds)} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {!_isBlank(path.initialDepartureTime)
                                    ? props.t('transit:transitRouting:results:OptimisedDepartureTime')
                                    : props.t('transit:transitRouting:results:DepartureTime')}
                            </th>
                            <td>{path.departureTime}</td>
                        </tr>
                        {!_isBlank(path.initialDepartureTime) && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:NonOptimisedDepartureTime')}</th>
                                <td>{path.initialDepartureTime}</td>
                            </tr>
                        )}
                        {!_isBlank(path.initialLostTimeAtDepartureMinutes) && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:LostTimeAtDepartureIfNonOptimised')}</th>
                                <td title={`${path.initialLostTimeAtDepartureSeconds} ${props.t('main:secondAbbr')}.`}>
                                    {path.initialLostTimeAtDepartureMinutes} {props.t('main:minuteAbbr')}.
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th>{props.t('transit:transitRouting:results:ArrivalTime')}</th>
                            <td>{path.arrivalTime}</td>
                        </tr>
                        {_isBlank(path.initialLostTimeAtDepartureMinutes) && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:NonOptimisedArrivalTime')}</th>
                                <td>
                                    {secondsSinceMidnightToTimeStr(
                                        props.request.arrivalTimeSecondsSinceMidnight || path.arrivalTimeSeconds
                                    )}
                                </td>
                            </tr>
                        )}
                        {_isBlank(path.initialLostTimeAtDepartureMinutes) && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:LostTimeAtArrivalIfNonOptimised')}</th>
                                <td
                                    title={`${
                                        (props.request.arrivalTimeSecondsSinceMidnight || path.arrivalTimeSeconds) -
                                        path.arrivalTimeSeconds
                                    } ${props.t('main:secondAbbr')}.`}
                                >
                                    {secondsToMinutes(
                                        (props.request.arrivalTimeSecondsSinceMidnight || path.arrivalTimeSeconds) -
                                            path.arrivalTimeSeconds
                                    )}{' '}
                                    {props.t('main:minuteAbbr')}.
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalDistance')}</th>
                            <td title={`${path.totalDistanceMeters} m`}>{path.totalDistanceMeters} m</td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:AccessTravelTime')}</th>
                            <td title={`${path.accessTravelTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.accessTravelTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:EgressTravelTime')}</th>
                            <td title={`${path.egressTravelTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.egressTravelTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:NumberOfTransfers')}</th>
                            <td>{path.numberOfTransfers}</td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalTransferTravelTime')}</th>
                            <td title={`${path.transferWalkingTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.transferWalkingTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalInVehicleTime')}</th>
                            <td title={`${path.totalInVehicleTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.totalInVehicleTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalAccessTravelTime')}</th>
                            <td title={`${path.totalNonTransitTravelTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.totalNonTransitTravelTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalTransferWaitingTime')}</th>
                            <td title={`${path.transferWaitingTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                                {path.transferWaitingTimeMinutes} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div className="tr__list-transit-routing-steps-list-container">
                    <ul className="tr__list-transit-routing-steps _list-container">{stepsButtons}</ul>
                </div>
            </div>
        );
    } else {
        return null;
    }
};

export default withTranslation(['transit', 'main'])(TransitRoutingResults);
