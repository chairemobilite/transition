/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TrRoutingRoute } from './types';
import { secondsSinceMidnightToTimeStr, secondsToMinutes } from '../../utils/DateTimeUtils';
import { TrRoutingV2 } from '../../api/TrRouting';

export interface TrRoutingWalkingStep {
    action: 'walking';
    arrivalTime: string;
    arrivalTimeSeconds: number;
    departureTime: string;
    departureTimeSeconds: number;
    distanceMeters: number;
    readyToBoardAt?: string;
    readyToBoardAtSeconds?: number;
    travelTimeMinutes: number;
    travelTimeSeconds: number;
    type: 'access' | 'egress' | 'transfer';
}

export interface TrRoutingBoardingStep {
    action: 'boarding';
    agencyAcronym: string;
    agencyName: string;
    agencyUuid: string;
    departureTime: string;
    departureTimeSeconds: number;
    legSequenceInTrip: number;
    lineLongname: string;
    lineShortname: string;
    lineUuid: string;
    mode: string;
    modeName: string;
    nodeCode: string;
    nodeCoordinates: [number, number];
    nodeName: string;
    nodeUuid: string;
    pathUuid: string;
    stopSequenceInTrip: number;
    tripUuid: string;
    waitingTimeMinutes: number;
    waitingTimeSeconds: number;
}

export interface TrRoutingUnboardingStep {
    action: 'unboarding';
    agencyAcronym: string;
    agencyName: string;
    agencyUuid: string;
    arrivalTime: string;
    arrivalTimeSeconds: number;
    inVehicleDistanceMeters: number;
    inVehicleTimeMinutes: number;
    inVehicleTimeSeconds: number;
    legSequenceInTrip: number;
    lineLongname: string;
    lineShortname: string;
    lineUuid: string;
    mode: string;
    modeName: string;
    nodeCode: string;
    nodeCoordinates: [number, number];
    nodeName: string;
    nodeUuid: string;
    pathUuid: string;
    stopSequenceInTrip: number;
    tripUuid: string;
}

type TrRoutingStep = TrRoutingWalkingStep | TrRoutingBoardingStep | TrRoutingUnboardingStep;

export interface TrRoutingRouteComplete {
    accessDistanceMeters: number;
    accessTravelTimeMinutes: number;
    accessTravelTimeSeconds: number;
    arrivalTime: string;
    arrivalTimeSeconds: number;
    departureTime: string;
    departureTimeSeconds: number;
    destination: [number, number];
    egressDistanceMeters: number;
    egressTravelTimeMinutes: number;
    egressTravelTimeSeconds: number;
    firstWaitingTimeMinutes: number;
    firstWaitingTimeSeconds: number;
    initialDepartureTime?: string;
    initialDepartureTimeSeconds?: number;
    initialLostTimeAtDepartureMinutes?: number;
    initialLostTimeAtDepartureSeconds?: number;
    numberOfBoardings: number;
    numberOfTransfers: number;
    origin: [number, number];
    totalDistanceMeters: number;
    totalInVehicleDistanceMeters: number;
    totalInVehicleTimeMinutes: number;
    totalInVehicleTimeSeconds: number;
    totalNonTransitDistanceMeters: number;
    totalNonTransitTravelTimeMinutes: number;
    totalNonTransitTravelTimeSeconds: number;
    totalTravelTimeMinutes: number;
    totalTravelTimeSeconds: number;
    totalWaitingTimeMinutes: number;
    totalWaitingTimeSeconds: number;
    transferWaitingTimeMinutes: number;
    transferWaitingTimeSeconds: number;
    transferWalkingDistanceMeters: number;
    transferWalkingTimeMinutes: number;
    transferWalkingTimeSeconds: number;
    steps: TrRoutingStep[];
}

const secondsToMinutesNotNull = (seconds: number) => {
    const minutes = secondsToMinutes(seconds, Math.round);
    return typeof minutes === 'number' ? minutes : -1;
};

const stepToUserObject = (step: TrRoutingV2.TripStep): TrRoutingStep => {
    if (step.action === 'walking') {
        return {
            action: 'walking',
            arrivalTime: secondsSinceMidnightToTimeStr(step.arrivalTime),
            arrivalTimeSeconds: step.arrivalTime,
            departureTime: secondsSinceMidnightToTimeStr(step.departureTime),
            departureTimeSeconds: step.departureTime,
            distanceMeters: step.distance,
            readyToBoardAt:
                step.type === 'access' || step.type === 'transfer'
                    ? secondsSinceMidnightToTimeStr(step.readyToBoardAt)
                    : undefined,
            readyToBoardAtSeconds: step.type === 'access' || step.type === 'transfer' ? step.readyToBoardAt : undefined,
            travelTimeMinutes: secondsToMinutesNotNull(step.travelTime),
            travelTimeSeconds: step.travelTime,
            type: step.type
        };
    }
    if (step.action === 'boarding') {
        return {
            action: 'boarding',
            departureTime: secondsSinceMidnightToTimeStr(step.departureTime),
            departureTimeSeconds: step.departureTime,
            agencyAcronym: step.agencyAcronym,
            agencyName: step.agencyName,
            agencyUuid: step.agencyUuid,
            legSequenceInTrip: step.legSequenceInTrip,
            lineLongname: step.lineLongname,
            lineShortname: step.lineShortname,
            lineUuid: step.lineUuid,
            mode: step.mode,
            modeName: step.modeName,
            nodeCode: step.nodeCode,
            nodeCoordinates: step.nodeCoordinates,
            nodeName: step.nodeName,
            nodeUuid: step.nodeUuid,
            pathUuid: step.pathUuid,
            stopSequenceInTrip: step.stopSequenceInTrip,
            tripUuid: step.tripUuid,
            waitingTimeMinutes: secondsToMinutesNotNull(step.waitingTime),
            waitingTimeSeconds: step.waitingTime
        };
    }
    return {
        action: 'unboarding',
        arrivalTime: secondsSinceMidnightToTimeStr(step.arrivalTime),
        arrivalTimeSeconds: step.arrivalTime,
        agencyAcronym: step.agencyAcronym,
        agencyName: step.agencyName,
        agencyUuid: step.agencyUuid,
        legSequenceInTrip: step.legSequenceInTrip,
        lineLongname: step.lineLongname,
        lineShortname: step.lineShortname,
        lineUuid: step.lineUuid,
        mode: step.mode,
        modeName: step.modeName,
        nodeCode: step.nodeCode,
        nodeCoordinates: step.nodeCoordinates,
        nodeName: step.nodeName,
        nodeUuid: step.nodeUuid,
        pathUuid: step.pathUuid,
        stopSequenceInTrip: step.stopSequenceInTrip,
        tripUuid: step.tripUuid,
        inVehicleDistanceMeters: step.inVehicleDistance,
        inVehicleTimeMinutes: secondsToMinutesNotNull(step.inVehicleTime),
        inVehicleTimeSeconds: step.inVehicleTime
    };
};

export const routeToUserObject = (route: TrRoutingRoute): TrRoutingRouteComplete => {
    const initialDepartureTime = route.timeOfTripType === 'departure' ? route.timeOfTrip : route.departureTime;
    return {
        accessDistanceMeters: route.accessDistance,
        accessTravelTimeMinutes: secondsToMinutesNotNull(route.accessTravelTime),
        accessTravelTimeSeconds: route.accessTravelTime,
        arrivalTime: secondsSinceMidnightToTimeStr(route.arrivalTime),
        arrivalTimeSeconds: route.arrivalTime,
        departureTime: secondsSinceMidnightToTimeStr(route.departureTime),
        departureTimeSeconds: route.departureTime,
        destination: route.originDestination[1].geometry.coordinates as [number, number],
        egressDistanceMeters: route.egressDistance,
        egressTravelTimeMinutes: secondsToMinutesNotNull(route.egressTravelTime),
        egressTravelTimeSeconds: route.egressTravelTime,
        firstWaitingTimeMinutes: secondsToMinutesNotNull(route.firstWaitingTime),
        firstWaitingTimeSeconds: route.firstWaitingTime,
        initialDepartureTime: secondsSinceMidnightToTimeStr(initialDepartureTime),
        initialDepartureTimeSeconds: initialDepartureTime,
        initialLostTimeAtDepartureMinutes: secondsToMinutesNotNull(route.departureTime - initialDepartureTime),
        initialLostTimeAtDepartureSeconds: route.departureTime - initialDepartureTime,
        numberOfBoardings: route.numberOfBoardings,
        numberOfTransfers: route.numberOfTransfers,
        origin: route.originDestination[0].geometry.coordinates as [number, number],
        totalDistanceMeters: route.totalDistance,
        totalInVehicleDistanceMeters: route.totalInVehicleDistance,
        totalInVehicleTimeMinutes: secondsToMinutesNotNull(route.totalInVehicleTime),
        totalInVehicleTimeSeconds: route.totalInVehicleTime,
        totalNonTransitDistanceMeters: route.totalNonTransitDistance,
        totalNonTransitTravelTimeMinutes: secondsToMinutesNotNull(route.totalNonTransitTravelTime),
        totalNonTransitTravelTimeSeconds: route.totalNonTransitTravelTime,
        totalTravelTimeMinutes: secondsToMinutesNotNull(route.totalTravelTime),
        totalTravelTimeSeconds: route.totalTravelTime,
        totalWaitingTimeMinutes: secondsToMinutesNotNull(route.totalWaitingTime),
        totalWaitingTimeSeconds: route.totalWaitingTime,
        transferWaitingTimeMinutes: secondsToMinutesNotNull(route.transferWaitingTime),
        transferWaitingTimeSeconds: route.transferWaitingTime,
        transferWalkingDistanceMeters: route.transferWalkingDistance,
        transferWalkingTimeMinutes: secondsToMinutesNotNull(route.transferWalkingTime),
        transferWalkingTimeSeconds: route.transferWalkingTime,
        steps: route.steps.map(stepToUserObject)
    };
};
