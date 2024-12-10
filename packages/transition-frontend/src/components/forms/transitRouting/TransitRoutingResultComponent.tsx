/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import TransitRoutingStepWalkButton from './TransitRoutingStepWalkButton';
import TransitRoutingStepRideButton from './TransitRoutingStepRideButton';
import RouteButton from './RouteButton';
import DistanceUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DistanceUnitFormatter';
import DurationUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DurationUnitFormatter';
import { secondsToMinutes, secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { TrRoutingV2 } from 'chaire-lib-common/lib/api/TrRouting';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { TrRoutingRoute } from 'chaire-lib-common/lib/services/transitRouting/types';
import { pathIsRoute } from 'chaire-lib-common/lib/services/routing/RoutingResult';

export interface TransitRoutingResultsProps extends WithTranslation {
    path: TrRoutingRoute | Route;
    routingMode: RoutingOrTransitMode;
    request: TransitRoutingAttributes;
}

const TransitRoutingResults: React.FunctionComponent<TransitRoutingResultsProps> = (
    props: TransitRoutingResultsProps
) => {
    //const TransitRoutingResults = function({ results, activeStepIndex, t }) {

    const stepsButtons: JSX.Element[] = [];
    const path = props.path;

    if (pathIsRoute(path)) {
        const pathToDisplay = path;
        return (
            <React.Fragment>
                {pathToDisplay && (
                    <div className="tr__form-section">
                        <table className="_statistics">
                            <tbody>
                                <tr>
                                    <th>{props.t('transit:transitRouting:results:TravelTime')}</th>
                                    <td title={`${pathToDisplay.duration} ${props.t('main:secondAbbr')}.`}>
                                        <DurationUnitFormatter value={pathToDisplay.duration} sourceUnit="s" />
                                    </td>
                                </tr>
                                <tr>
                                    <th>{props.t('transit:transitRouting:results:Distance')}</th>
                                    <td>
                                        <DistanceUnitFormatter value={pathToDisplay.distance} sourceUnit="m" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="tr__list-transit-routing-steps-list-container">
                            <ul className="tr__list-transit-routing-steps _list-container">
                                <RouteButton
                                    travelTimeSeconds={pathToDisplay.duration}
                                    distanceMeters={pathToDisplay.distance}
                                    key={'singleModeButton'}
                                    // Single mode if main mode is transit means walking
                                    // FIXME This is a hack, we should have a proper way to know if the path mode is walking
                                    routingMode={props.routingMode === 'transit' ? 'walking' : props.routingMode}
                                />
                            </ul>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    } else if (path) {
        // Display a TrRoutingRoute
        path.steps.forEach((step, stepIndex) => {
            if (step.action === 'walking') {
                const boardingStep = path.steps[stepIndex + 1] as TrRoutingV2.TripStepBoarding;
                stepsButtons.push(
                    <TransitRoutingStepWalkButton
                        step={step}
                        stepIndex={stepIndex}
                        key={`step${stepIndex}`}
                        waitingTimeSeconds={path.steps[stepIndex + 1] ? boardingStep.waitingTime : undefined}
                    />
                );
            } else if (step.action === 'boarding') {
                const boardingStep = step as TrRoutingV2.TripStepBoarding;
                const alightingStep = path.steps[stepIndex + 1] as TrRoutingV2.TripStepUnboarding;
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

        const nonOptimisedTravelTimeSeconds =
            path.timeOfTripType === 'departure'
                ? path.arrivalTime - path.timeOfTrip
                : path.totalTravelTime + (path.timeOfTrip - path.arrivalTime);
        return (
            <div className="tr__form-section">
                <table className="_statistics">
                    <tbody>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:OptimisedTravelTime')}</th>
                            <td title={`${path.totalTravelTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.totalTravelTime)} {props.t('main:minuteAbbr')}.
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
                                {path.timeOfTripType === 'departure' && path.departureTime !== path.timeOfTrip
                                    ? props.t('transit:transitRouting:results:OptimisedDepartureTime')
                                    : props.t('transit:transitRouting:results:DepartureTime')}
                            </th>
                            <td>{secondsSinceMidnightToTimeStr(path.departureTime)}</td>
                        </tr>
                        {path.timeOfTripType === 'departure' && path.departureTime !== path.timeOfTrip && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:NonOptimisedDepartureTime')}</th>
                                <td>{secondsSinceMidnightToTimeStr(path.timeOfTrip)}</td>
                            </tr>
                        )}
                        {path.timeOfTripType === 'departure' && path.departureTime !== path.timeOfTrip && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:LostTimeAtDepartureIfNonOptimised')}</th>
                                <td
                                    title={`${nonOptimisedTravelTimeSeconds - path.totalTravelTime} ${props.t(
                                        'main:secondAbbr'
                                    )}.`}
                                >
                                    {secondsToMinutes(nonOptimisedTravelTimeSeconds - path.totalTravelTime)}{' '}
                                    {props.t('main:minuteAbbr')}.
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th>{props.t('transit:transitRouting:results:ArrivalTime')}</th>
                            <td>{secondsSinceMidnightToTimeStr(path.arrivalTime)}</td>
                        </tr>
                        {path.timeOfTripType === 'arrival' && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:NonOptimisedArrivalTime')}</th>
                                <td>{secondsSinceMidnightToTimeStr(path.timeOfTrip)}</td>
                            </tr>
                        )}
                        {path.timeOfTripType === 'arrival' && (
                            <tr>
                                <th>{props.t('transit:transitRouting:results:LostTimeAtArrivalIfNonOptimised')}</th>
                                <td title={`${path.timeOfTrip - path.arrivalTime} ${props.t('main:secondAbbr')}.`}>
                                    {secondsToMinutes(path.timeOfTrip - path.arrivalTime)} {props.t('main:minuteAbbr')}.
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalDistance')}</th>
                            <td title={`${path.totalDistance} m`}>{path.totalDistance} m</td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:AccessTravelTime')}</th>
                            <td title={`${path.accessTravelTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.accessTravelTime)} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:EgressTravelTime')}</th>
                            <td title={`${path.egressTravelTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.egressTravelTime)} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:NumberOfTransfers')}</th>
                            <td>{path.numberOfTransfers}</td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalTransferTravelTime')}</th>
                            <td title={`${path.transferWalkingTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.transferWalkingTime)} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalInVehicleTime')}</th>
                            <td title={`${path.totalInVehicleTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.totalInVehicleTime)} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalAccessTravelTime')}</th>
                            <td title={`${path.totalNonTransitTravelTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.totalNonTransitTravelTime)} {props.t('main:minuteAbbr')}.
                            </td>
                        </tr>
                        <tr>
                            <th>{props.t('transit:transitRouting:results:TotalTransferWaitingTime')}</th>
                            <td title={`${path.transferWaitingTime} ${props.t('main:secondAbbr')}.`}>
                                {secondsToMinutes(path.transferWaitingTime)} {props.t('main:minuteAbbr')}.
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
