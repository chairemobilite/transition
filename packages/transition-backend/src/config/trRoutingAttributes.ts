/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// TODO These should be typed and/or belong to somewhere else, not sure where,
// but they are really custom to the batch routing results.

// Base attributes for batch routing results for all modes, not just transit
const base = {
    uuid: null,
    internalId: null,
    originLat: null,
    originLon: null,
    destinationLat: null,
    destinationLon: null
} as { [key: string]: string | number | null };

const steps = {
    // comes from trRouting (all possible attributes in the json output of steps)
    uuid: null,
    internalId: null,
    alternativeSequence: null,
    stepSequence: null,
    action: null,
    type: null,
    travelTimeSeconds: null,
    travelTimeMinutes: null,
    distanceMeters: null,
    departureTime: null,
    arrivalTime: null,
    departureTimeSeconds: null,
    arrivalTimeSeconds: null,
    agencyAcronym: null,
    agencyName: null,
    agencyUuid: null,
    lineShortname: null,
    lineLongname: null,
    lineUuid: null,
    pathUuid: null,
    modeName: null,
    mode: null,
    tripUuid: null,
    sequenceInTrip: null, // deprecated in trRouting
    legSequenceInTrip: null,
    stopSequenceInTrip: null,
    nodeName: null,
    nodeCode: null,
    nodeUuid: null,
    nodeCoordinates: null,
    inVehicleTimeSeconds: null,
    inVehicleTimeMinutes: null,
    inVehicleDistanceMeters: null,
    nearestNetworkNodeDistanceMeters: null,
    waitingTimeSeconds: null,
    waitingTimeMinutes: null,
    readyToBoardAt: null,
    readyToBoardAtSeconds: null
} as { [key: string]: string | number | null };

const transit = {
    // comes from trRouting (all possible attributes in the json output of main result or each alternative result)
    alternativeSequence: null,
    alternativeTotalSequence: null,
    status: null,
    departureTime: null,
    departureTimeSeconds: null,
    arrivalTime: null,
    arrivalTimeSeconds: null,
    initialDepartureTime: null,
    initialDepartureTimeSeconds: null,
    initialLostTimeAtDepartureMinutes: null,
    initialLostTimeAtDepartureSeconds: null,
    totalTravelTimeMinutes: null,
    totalTravelTimeSeconds: null,
    totalDistanceMeters: null,
    totalInVehicleTimeMinutes: null,
    totalInVehicleTimeSeconds: null,
    totalInVehicleDistanceMeters: null,
    totalNonTransitTravelTimeMinutes: null,
    totalNonTransitTravelTimeSeconds: null,
    totalNonTransitDistanceMeters: null,
    numberOfBoardings: null,
    numberOfTransfers: null,
    transferWalkingTimeMinutes: null,
    transferWalkingTimeSeconds: null,
    transferWalkingDistanceMeters: null,
    accessTravelTimeMinutes: null,
    accessTravelTimeSeconds: null,
    accessDistanceMeters: null,
    egressTravelTimeMinutes: null,
    egressTravelTimeSeconds: null,
    egressDistanceMeters: null,
    nearestNetworkNodeOriginDistanceMeters: null,
    nearestNetworkNodeDestinationDistanceMeters: null,
    transferWaitingTimeMinutes: null,
    transferWaitingTimeSeconds: null,
    firstWaitingTimeMinutes: null,
    firstWaitingTimeSeconds: null,
    totalWaitingTimeMinutes: null,
    totalWaitingTimeSeconds: null,
    optimizeCases: null,
    lineUuids: null,
    modes: null,
    stepsSummary: null
} as { [key: string]: string | number | null };

export { base, steps, transit };
