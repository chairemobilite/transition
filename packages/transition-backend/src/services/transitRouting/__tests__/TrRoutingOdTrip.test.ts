/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';

import routeOdTrip from '../TrRoutingOdTrip';
import { simplePathResult, transferPathResult, alternativesResult, walkingRouteResult, cyclingRouteResult } from './TrRoutingResultStub';
import { TransitRouting, TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { UnimodalRouteCalculationResult } from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ErrorCodes } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import Path from 'transition-common/src/services/path/Path';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { routeToUserObject, TrRoutingBoardingStep, TrRoutingUnboardingStep, TrRoutingWalkingStep } from 'chaire-lib-common/src/services/trRouting/TrRoutingResultConversion';

const calculateMock = jest.fn();

jest.mock('transition-common/lib/services/transitRouting/TransitRoutingCalculator', () => {
    return {
        TransitRoutingCalculator: {
            calculate: jest.fn().mockImplementation(async (
                routing: TransitRouting,
                updatePreferences = false,
                options: { isCancelled?: () => void; [key: string]: any } = {}
            ) => calculateMock(routing, updatePreferences, options))
        }
    }
});

const transitRoutingAttributes: TransitRoutingAttributes = {
    id: 'arbitrary',
    data: {},
    savedForBatch: [],
}

beforeEach(() => {
    calculateMock.mockClear();
});

const origin = simplePathResult.routes[0].originDestination[0];
const destination = simplePathResult.routes[0].originDestination[1];
const odTrip = new BaseOdTrip({
    origin_geography: origin.geometry,
    destination_geography: destination.geometry,
    internal_id: 'test',
    timeOfTrip: 28000,
    timeType: 'departure'
}, false);

describe('csv only result', () => {

    test('One mode', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: false,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(1);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${expectedUserResult.origin[1]},${expectedUserResult.origin[0]},` +
            `${expectedUserResult.destination[1]},${expectedUserResult.destination[0]},` +
            `1,1,success,${expectedUserResult.departureTime},` +
            `${expectedUserResult.departureTimeSeconds},${expectedUserResult.arrivalTime},${expectedUserResult.arrivalTimeSeconds},` +
            `${expectedUserResult.initialDepartureTime},${expectedUserResult.initialDepartureTimeSeconds},${expectedUserResult.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResult.initialLostTimeAtDepartureSeconds},${expectedUserResult.totalTravelTimeMinutes},${expectedUserResult.totalTravelTimeSeconds},` +
            `${expectedUserResult.totalDistanceMeters},${expectedUserResult.totalInVehicleTimeMinutes},${expectedUserResult.totalInVehicleTimeSeconds},` +
            `${expectedUserResult.totalInVehicleDistanceMeters},${expectedUserResult.totalNonTransitTravelTimeMinutes},${expectedUserResult.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResult.totalNonTransitDistanceMeters},${expectedUserResult.numberOfBoardings},${expectedUserResult.numberOfTransfers},` +
            `${expectedUserResult.transferWalkingTimeMinutes},${expectedUserResult.transferWalkingTimeSeconds},${expectedUserResult.transferWalkingDistanceMeters},` +
            `${expectedUserResult.accessTravelTimeMinutes},${expectedUserResult.accessTravelTimeSeconds},${expectedUserResult.accessDistanceMeters},` +
            `${expectedUserResult.egressTravelTimeMinutes},${expectedUserResult.egressTravelTimeSeconds},${expectedUserResult.egressDistanceMeters},` +
            `${expectedUserResult.transferWaitingTimeMinutes},` +
            `${expectedUserResult.transferWaitingTimeSeconds},${expectedUserResult.firstWaitingTimeMinutes},${expectedUserResult.firstWaitingTimeSeconds},` +
            `${expectedUserResult.totalWaitingTimeMinutes},${expectedUserResult.totalWaitingTimeSeconds},` +
            `${(expectedUserResult.steps[1] as any).lineUuid},${(expectedUserResult.steps[1] as any).mode},access210s262m|wait180s|ride391s1426m|egress753s998m`
        );
        expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({
            _attributes: expect.objectContaining({
                originGeojson: origin,
                destinationGeojson: destination
            })
        }), false, expect.anything());
    });

    test('Multiple modes', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: false,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(1);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` + 
            `${expectedUserResult.origin[1]},${expectedUserResult.origin[0]},` +
            `${expectedUserResult.destination[1]},${expectedUserResult.destination[0]},` +
            `1,1,success,${expectedUserResult.departureTime},` +
            `${expectedUserResult.departureTimeSeconds},${expectedUserResult.arrivalTime},${expectedUserResult.arrivalTimeSeconds},` +
            `${expectedUserResult.initialDepartureTime},${expectedUserResult.initialDepartureTimeSeconds},${expectedUserResult.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResult.initialLostTimeAtDepartureSeconds},${expectedUserResult.totalTravelTimeMinutes},${expectedUserResult.totalTravelTimeSeconds},` +
            `${expectedUserResult.totalDistanceMeters},${expectedUserResult.totalInVehicleTimeMinutes},${expectedUserResult.totalInVehicleTimeSeconds},` +
            `${expectedUserResult.totalInVehicleDistanceMeters},${expectedUserResult.totalNonTransitTravelTimeMinutes},${expectedUserResult.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResult.totalNonTransitDistanceMeters},${expectedUserResult.numberOfBoardings},${expectedUserResult.numberOfTransfers},` +
            `${expectedUserResult.transferWalkingTimeMinutes},${expectedUserResult.transferWalkingTimeSeconds},${expectedUserResult.transferWalkingDistanceMeters},` +
            `${expectedUserResult.accessTravelTimeMinutes},${expectedUserResult.accessTravelTimeSeconds},${expectedUserResult.accessDistanceMeters},` +
            `${expectedUserResult.egressTravelTimeMinutes},${expectedUserResult.egressTravelTimeSeconds},${expectedUserResult.egressDistanceMeters},` +
            `${expectedUserResult.transferWaitingTimeMinutes},` +
            `${expectedUserResult.transferWaitingTimeSeconds},${expectedUserResult.firstWaitingTimeMinutes},${expectedUserResult.firstWaitingTimeSeconds},` +
            `${expectedUserResult.totalWaitingTimeMinutes},${expectedUserResult.totalWaitingTimeSeconds},` +
            `${(expectedUserResult.steps[1] as any).lineUuid},${(expectedUserResult.steps[1] as any).mode},access210s262m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
    });

    test('With alternatives', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: alternativesResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: false,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(alternativesResult.routes[0]);
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(2);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${expectedUserResult.origin[1]},${expectedUserResult.origin[0]},` +
            `${expectedUserResult.destination[1]},${expectedUserResult.destination[0]},` +
            `1,2,success,${expectedUserResult.departureTime},` +
            `${expectedUserResult.departureTimeSeconds},${expectedUserResult.arrivalTime},${expectedUserResult.arrivalTimeSeconds},` +
            `${expectedUserResult.initialDepartureTime},${expectedUserResult.initialDepartureTimeSeconds},${expectedUserResult.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResult.initialLostTimeAtDepartureSeconds},${expectedUserResult.totalTravelTimeMinutes},${expectedUserResult.totalTravelTimeSeconds},` +
            `${expectedUserResult.totalDistanceMeters},${expectedUserResult.totalInVehicleTimeMinutes},${expectedUserResult.totalInVehicleTimeSeconds},` +
            `${expectedUserResult.totalInVehicleDistanceMeters},${expectedUserResult.totalNonTransitTravelTimeMinutes},${expectedUserResult.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResult.totalNonTransitDistanceMeters},${expectedUserResult.numberOfBoardings},${expectedUserResult.numberOfTransfers},` +
            `${expectedUserResult.transferWalkingTimeMinutes},${expectedUserResult.transferWalkingTimeSeconds},${expectedUserResult.transferWalkingDistanceMeters},` +
            `${expectedUserResult.accessTravelTimeMinutes},${expectedUserResult.accessTravelTimeSeconds},${expectedUserResult.accessDistanceMeters},` +
            `${expectedUserResult.egressTravelTimeMinutes},${expectedUserResult.egressTravelTimeSeconds},${expectedUserResult.egressDistanceMeters},` +
            `${expectedUserResult.transferWaitingTimeMinutes},` +
            `${expectedUserResult.transferWaitingTimeSeconds},${expectedUserResult.firstWaitingTimeMinutes},${expectedUserResult.firstWaitingTimeSeconds},` +
            `${expectedUserResult.totalWaitingTimeMinutes},${expectedUserResult.totalWaitingTimeSeconds},` +
            `${(expectedUserResult.steps[1] as any).lineUuid},${(expectedUserResult.steps[1] as any).mode},access210s262m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
        const expectedUserResultAlt = routeToUserObject(alternativesResult.routes[1]);
        expect((result.csv as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${expectedUserResultAlt.origin[1]},${expectedUserResultAlt.origin[0]},` +
            `${expectedUserResultAlt.destination[1]},${expectedUserResultAlt.destination[0]},` +
            `2,2,success,${expectedUserResultAlt.departureTime},` +
            `${expectedUserResultAlt.departureTimeSeconds},${expectedUserResultAlt.arrivalTime},${expectedUserResultAlt.arrivalTimeSeconds},` +
            `${expectedUserResultAlt.initialDepartureTime},${expectedUserResultAlt.initialDepartureTimeSeconds},${expectedUserResultAlt.initialLostTimeAtDepartureMinutes},` +
            `${expectedUserResultAlt.initialLostTimeAtDepartureSeconds},${expectedUserResultAlt.totalTravelTimeMinutes},${expectedUserResultAlt.totalTravelTimeSeconds},` +
            `${expectedUserResultAlt.totalDistanceMeters},${expectedUserResultAlt.totalInVehicleTimeMinutes},${expectedUserResultAlt.totalInVehicleTimeSeconds},` +
            `${expectedUserResultAlt.totalInVehicleDistanceMeters},${expectedUserResultAlt.totalNonTransitTravelTimeMinutes},${expectedUserResultAlt.totalNonTransitTravelTimeSeconds},` +
            `${expectedUserResultAlt.totalNonTransitDistanceMeters},${expectedUserResultAlt.numberOfBoardings},${expectedUserResultAlt.numberOfTransfers},` +
            `${expectedUserResultAlt.transferWalkingTimeMinutes},${expectedUserResultAlt.transferWalkingTimeSeconds},${expectedUserResultAlt.transferWalkingDistanceMeters},` +
            `${expectedUserResultAlt.accessTravelTimeMinutes},${expectedUserResultAlt.accessTravelTimeSeconds},${expectedUserResultAlt.accessDistanceMeters},` +
            `${expectedUserResultAlt.egressTravelTimeMinutes},${expectedUserResultAlt.egressTravelTimeSeconds},${expectedUserResultAlt.egressDistanceMeters},` +
            `${expectedUserResultAlt.transferWaitingTimeMinutes},` +
            `${expectedUserResultAlt.transferWaitingTimeSeconds},${expectedUserResultAlt.firstWaitingTimeMinutes},${expectedUserResultAlt.firstWaitingTimeSeconds},` +
            `${expectedUserResultAlt.totalWaitingTimeMinutes},${expectedUserResultAlt.totalWaitingTimeSeconds},` +
            `${(expectedUserResultAlt.steps[1] as any).lineUuid}|${(expectedUserResultAlt.steps[4] as any).lineUuid},` +
            `${(expectedUserResultAlt.steps[1] as any).mode}|${(expectedUserResultAlt.steps[4] as any).mode},` +
            `access210s262m|wait180s|ride391s1426m|transfer753s998m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
    });

    test('No routing found', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                )
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: false,
            reverseOD: false,
        });
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toBeUndefined;
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(1);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]},` +
            `${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]},` +
            `,,TRROUTING_NO_ROUTING_FOUND,,` +
            `,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
    });
});

describe('detailed csv only result', () => {

    test('One mode', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: true,
            withGeometries: false,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(4);
        const accessStep = expectedUserResult.steps[0] as TrRoutingWalkingStep;
        const boardingStep = expectedUserResult.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = expectedUserResult.steps[2] as TrRoutingUnboardingStep;
        const egressStep = expectedUserResult.steps[3] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,1,${expectedUserResult.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,2,${expectedUserResult.steps[1].action},` +
            `,,,` +
            `,${boardingStep.departureTime},,` +
            `${boardingStep.departureTimeSeconds},,` +
            `${boardingStep.agencyAcronym},${boardingStep.agencyName},${boardingStep.agencyUuid},` +
            `${boardingStep.lineShortname},${boardingStep.lineLongname},${boardingStep.lineUuid},` +
            `${boardingStep.pathUuid},${boardingStep.modeName},${boardingStep.mode},` +
            `${boardingStep.tripUuid},,${boardingStep.legSequenceInTrip},` +
            `${boardingStep.stopSequenceInTrip},${boardingStep.nodeName},${boardingStep.nodeCode},` +
            `${boardingStep.nodeUuid},"${boardingStep.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep.waitingTimeSeconds},${boardingStep.waitingTimeMinutes},,` +
            ``
        );
        expect((result.csvDetailed as string[])[2]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,3,${expectedUserResult.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep.arrivalTime},` +
            `,${unboardingStep.arrivalTimeSeconds},` +
            `${unboardingStep.agencyAcronym},${unboardingStep.agencyName},${unboardingStep.agencyUuid},` +
            `${unboardingStep.lineShortname},${unboardingStep.lineLongname},${unboardingStep.lineUuid},` +
            `${unboardingStep.pathUuid},${unboardingStep.modeName},${unboardingStep.mode},` +
            `${unboardingStep.tripUuid},,${unboardingStep.legSequenceInTrip},` +
            `${unboardingStep.stopSequenceInTrip},${unboardingStep.nodeName},${unboardingStep.nodeCode},` +
            `${unboardingStep.nodeUuid},"${unboardingStep.nodeCoordinates}",${unboardingStep.inVehicleTimeSeconds},` +
            `${unboardingStep.inVehicleTimeMinutes},${unboardingStep.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((result.csvDetailed as string[])[3]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,4,${expectedUserResult.steps[3].action},` +
            `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
            `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
            `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
    });

    test('Multiple modes', async () => {
        // Detailed steps should be same as single transit mode

        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: true,
            withGeometries: false,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(4);
        const accessStep = expectedUserResult.steps[0] as TrRoutingWalkingStep;
        const boardingStep = expectedUserResult.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = expectedUserResult.steps[2] as TrRoutingUnboardingStep;
        const egressStep = expectedUserResult.steps[3] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,1,${expectedUserResult.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,2,${expectedUserResult.steps[1].action},` +
            `,,,` +
            `,${boardingStep.departureTime},,` +
            `${boardingStep.departureTimeSeconds},,` +
            `${boardingStep.agencyAcronym},${boardingStep.agencyName},${boardingStep.agencyUuid},` +
            `${boardingStep.lineShortname},${boardingStep.lineLongname},${boardingStep.lineUuid},` +
            `${boardingStep.pathUuid},${boardingStep.modeName},${boardingStep.mode},` +
            `${boardingStep.tripUuid},,${boardingStep.legSequenceInTrip},` +
            `${boardingStep.stopSequenceInTrip},${boardingStep.nodeName},${boardingStep.nodeCode},` +
            `${boardingStep.nodeUuid},"${boardingStep.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep.waitingTimeSeconds},${boardingStep.waitingTimeMinutes},,` +
            ``
        );
        expect((result.csvDetailed as string[])[2]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,3,${expectedUserResult.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep.arrivalTime},` +
            `,${unboardingStep.arrivalTimeSeconds},` +
            `${unboardingStep.agencyAcronym},${unboardingStep.agencyName},${unboardingStep.agencyUuid},` +
            `${unboardingStep.lineShortname},${unboardingStep.lineLongname},${unboardingStep.lineUuid},` +
            `${unboardingStep.pathUuid},${unboardingStep.modeName},${unboardingStep.mode},` +
            `${unboardingStep.tripUuid},,${unboardingStep.legSequenceInTrip},` +
            `${unboardingStep.stopSequenceInTrip},${unboardingStep.nodeName},${unboardingStep.nodeCode},` +
            `${unboardingStep.nodeUuid},"${unboardingStep.nodeCoordinates}",${unboardingStep.inVehicleTimeSeconds},` +
            `${unboardingStep.inVehicleTimeMinutes},${unboardingStep.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((result.csvDetailed as string[])[3]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,4,${expectedUserResult.steps[3].action},` +
            `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
            `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
            `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
    });

    test('With alternatives', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: alternativesResult.routes,
                maxWalkingTime: 300
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const expectedUserResult = routeToUserObject(alternativesResult.routes[0]);
        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: true,
            withGeometries: false,
            reverseOD: false,
        });
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(11);

        // Validate first path
        const accessStep = expectedUserResult.steps[0] as TrRoutingWalkingStep;
        const boardingStep = expectedUserResult.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = expectedUserResult.steps[2] as TrRoutingUnboardingStep;
        const egressStep = expectedUserResult.steps[3] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,1,${expectedUserResult.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,2,${expectedUserResult.steps[1].action},` +
            `,,,` +
            `,${boardingStep.departureTime},,` +
            `${boardingStep.departureTimeSeconds},,` +
            `${boardingStep.agencyAcronym},${boardingStep.agencyName},${boardingStep.agencyUuid},` +
            `${boardingStep.lineShortname},${boardingStep.lineLongname},${boardingStep.lineUuid},` +
            `${boardingStep.pathUuid},${boardingStep.modeName},${boardingStep.mode},` +
            `${boardingStep.tripUuid},,${boardingStep.legSequenceInTrip},` +
            `${boardingStep.stopSequenceInTrip},${boardingStep.nodeName},${boardingStep.nodeCode},` +
            `${boardingStep.nodeUuid},"${boardingStep.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep.waitingTimeSeconds},${boardingStep.waitingTimeMinutes},,` +
            ``
        );
        expect((result.csvDetailed as string[])[2]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,3,${expectedUserResult.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep.arrivalTime},` +
            `,${unboardingStep.arrivalTimeSeconds},` +
            `${unboardingStep.agencyAcronym},${unboardingStep.agencyName},${unboardingStep.agencyUuid},` +
            `${unboardingStep.lineShortname},${unboardingStep.lineLongname},${unboardingStep.lineUuid},` +
            `${unboardingStep.pathUuid},${unboardingStep.modeName},${unboardingStep.mode},` +
            `${unboardingStep.tripUuid},,${unboardingStep.legSequenceInTrip},` +
            `${unboardingStep.stopSequenceInTrip},${unboardingStep.nodeName},${unboardingStep.nodeCode},` +
            `${unboardingStep.nodeUuid},"${unboardingStep.nodeCoordinates}",${unboardingStep.inVehicleTimeSeconds},` +
            `${unboardingStep.inVehicleTimeMinutes},${unboardingStep.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((result.csvDetailed as string[])[3]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,4,${expectedUserResult.steps[3].action},` +
        `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
        `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
        `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
        `,,,,,,,,,,,,,,,,,,,,,,,,`
        );

        // Validate second path, with transfer steps
        const expectedUserResultAlt = routeToUserObject(alternativesResult.routes[1]);
        const accessStepSeq2 = expectedUserResultAlt.steps[0] as TrRoutingWalkingStep;
        const boardingStep1Seq2 = expectedUserResultAlt.steps[1] as TrRoutingBoardingStep;
        const unboardingStep1Seq2 = expectedUserResultAlt.steps[2] as TrRoutingUnboardingStep;
        const transferStep = expectedUserResultAlt.steps[3] as TrRoutingWalkingStep;
        const boardingStep2Seq2 = expectedUserResultAlt.steps[4] as TrRoutingBoardingStep;
        const unboardingStep2Seq2 = expectedUserResultAlt.steps[5] as TrRoutingUnboardingStep;
        const egressStepSeq2 = expectedUserResultAlt.steps[6] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[4]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,1,${expectedUserResultAlt.steps[0].action},` +
            `${accessStepSeq2.type},${accessStepSeq2.travelTimeSeconds},${accessStepSeq2.travelTimeMinutes},` +
            `${accessStepSeq2.distanceMeters},${accessStepSeq2.departureTime},${accessStepSeq2.arrivalTime},` +
            `${accessStepSeq2.departureTimeSeconds},${accessStepSeq2.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStepSeq2.readyToBoardAt},${accessStepSeq2.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[5]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,2,${expectedUserResultAlt.steps[1].action},` +
            `,,,` +
            `,${boardingStep1Seq2.departureTime},,` +
            `${boardingStep1Seq2.departureTimeSeconds},,` +
            `${boardingStep1Seq2.agencyAcronym},${boardingStep1Seq2.agencyName},${boardingStep1Seq2.agencyUuid},` +
            `${boardingStep1Seq2.lineShortname},${boardingStep1Seq2.lineLongname},${boardingStep1Seq2.lineUuid},` +
            `${boardingStep1Seq2.pathUuid},${boardingStep1Seq2.modeName},${boardingStep1Seq2.mode},` +
            `${boardingStep1Seq2.tripUuid},,${boardingStep1Seq2.legSequenceInTrip},` +
            `${boardingStep1Seq2.stopSequenceInTrip},${boardingStep1Seq2.nodeName},${boardingStep1Seq2.nodeCode},` +
            `${boardingStep1Seq2.nodeUuid},"${boardingStep1Seq2.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep1Seq2.waitingTimeSeconds},${boardingStep1Seq2.waitingTimeMinutes},,` +
            ``
        );
        expect((result.csvDetailed as string[])[6]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,3,${expectedUserResultAlt.steps[2].action},` +
            `,,,` +
            `,,${unboardingStep1Seq2.arrivalTime},` +
            `,${unboardingStep1Seq2.arrivalTimeSeconds},` +
            `${unboardingStep1Seq2.agencyAcronym},${unboardingStep1Seq2.agencyName},${unboardingStep1Seq2.agencyUuid},` +
            `${unboardingStep1Seq2.lineShortname},${unboardingStep1Seq2.lineLongname},${unboardingStep1Seq2.lineUuid},` +
            `${unboardingStep1Seq2.pathUuid},${unboardingStep1Seq2.modeName},${unboardingStep1Seq2.mode},` +
            `${unboardingStep1Seq2.tripUuid},,${unboardingStep1Seq2.legSequenceInTrip},` +
            `${unboardingStep1Seq2.stopSequenceInTrip},${unboardingStep1Seq2.nodeName},${unboardingStep1Seq2.nodeCode},` +
            `${unboardingStep1Seq2.nodeUuid},"${unboardingStep1Seq2.nodeCoordinates}",${unboardingStep1Seq2.inVehicleTimeSeconds},` +
            `${unboardingStep1Seq2.inVehicleTimeMinutes},${unboardingStep1Seq2.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((result.csvDetailed as string[])[7]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,4,${expectedUserResultAlt.steps[3].action},` +
            `${transferStep.type},${transferStep.travelTimeSeconds},${transferStep.travelTimeMinutes},` +
            `${transferStep.distanceMeters},${transferStep.departureTime},${transferStep.arrivalTime},` +
            `${transferStep.departureTimeSeconds},${transferStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,${transferStep.readyToBoardAt},${transferStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[8]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,5,${expectedUserResultAlt.steps[4].action},` +
            `,,,` +
            `,${boardingStep2Seq2.departureTime},,` +
            `${boardingStep2Seq2.departureTimeSeconds},,` +
            `${boardingStep2Seq2.agencyAcronym},${boardingStep2Seq2.agencyName},${boardingStep2Seq2.agencyUuid},` +
            `${boardingStep2Seq2.lineShortname},${boardingStep2Seq2.lineLongname},${boardingStep2Seq2.lineUuid},` +
            `${boardingStep2Seq2.pathUuid},${boardingStep2Seq2.modeName},${boardingStep2Seq2.mode},` +
            `${boardingStep2Seq2.tripUuid},,${boardingStep2Seq2.legSequenceInTrip},` +
            `${boardingStep2Seq2.stopSequenceInTrip},${boardingStep2Seq2.nodeName},${boardingStep2Seq2.nodeCode},` +
            `${boardingStep2Seq2.nodeUuid},"${boardingStep2Seq2.nodeCoordinates}",,` +
            `,,,` +
            `${boardingStep2Seq2.waitingTimeSeconds},${boardingStep2Seq2.waitingTimeMinutes},,` +
            ``
        );
        expect((result.csvDetailed as string[])[9]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,6,${expectedUserResultAlt.steps[5].action},` +
            `,,,` +
            `,,${unboardingStep2Seq2.arrivalTime},` +
            `,${unboardingStep2Seq2.arrivalTimeSeconds},` +
            `${unboardingStep2Seq2.agencyAcronym},${unboardingStep2Seq2.agencyName},${unboardingStep2Seq2.agencyUuid},` +
            `${unboardingStep2Seq2.lineShortname},${unboardingStep2Seq2.lineLongname},${unboardingStep2Seq2.lineUuid},` +
            `${unboardingStep2Seq2.pathUuid},${unboardingStep2Seq2.modeName},${unboardingStep2Seq2.mode},` +
            `${unboardingStep2Seq2.tripUuid},,${unboardingStep2Seq2.legSequenceInTrip},` +
            `${unboardingStep2Seq2.stopSequenceInTrip},${unboardingStep2Seq2.nodeName},${unboardingStep2Seq2.nodeCode},` +
            `${unboardingStep2Seq2.nodeUuid},"${unboardingStep2Seq2.nodeCoordinates}",${unboardingStep2Seq2.inVehicleTimeSeconds},` +
            `${unboardingStep2Seq2.inVehicleTimeMinutes},${unboardingStep2Seq2.inVehicleDistanceMeters},,` +
            `,,,` +
            ``
        );
        expect((result.csvDetailed as string[])[10]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,7,${expectedUserResultAlt.steps[6].action},` +
            `${egressStepSeq2.type},${egressStepSeq2.travelTimeSeconds},${egressStepSeq2.travelTimeMinutes},` +
            `${egressStepSeq2.distanceMeters},${egressStepSeq2.departureTime},${egressStepSeq2.arrivalTime},` +
            `${egressStepSeq2.departureTimeSeconds},${egressStepSeq2.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
    });

    test('No routing found', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                )
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: true,
            withGeometries: false,
            reverseOD: false,
        });
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toBeUndefined;
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(0);
    });
    
});

describe('geometries result', () => {

    const path = new Path({
        id: (simplePathResult.routes[0].steps[1] as any).pathUuid,
        geography: {
            type: 'LineString',
            coordinates: [[-73,45], [-73.01,45.001], [-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                [-73.021,45.02], [-73.03,45.04], [-73.03,45.045], [-73.035,45.05], [-73.04,45.06] ]
        },
        direction: 'outbound',
        line_id: (simplePathResult.routes[0].steps[1] as any).lineUuid,
        nodes: ['node1', 'node2', 'node3', 'node4', 'node5', 'node6', 'node7', 'node8'],
        segments: [0, 2, 3, 4, 6, 7, 8, 9],
        data: {}
    }, false);
    const pathCollection = new PathCollection([path.toGeojson()], {});

    test('One mode', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: true,
            reverseOD: false,
            pathCollection
        });
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeDefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.geometries as GeoJSON.Feature[]).length).toEqual(1);
        expect((result.geometries as GeoJSON.Feature[])[0]).toEqual({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                    [-73.021,45.02], [-73.03,45.04], [-73.03,45.045]]
            },
            properties: expect.objectContaining({
                action: 'ride',
                routingMode: 'transit',
                mode: 'bus',
                internalId: odTrip.attributes.internal_id
            })
        });
    });

    test('Multiple modes', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: true,
            reverseOD: false,
            pathCollection
        });
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeDefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.geometries as GeoJSON.Feature[]).length).toEqual(3);
        expect((result.geometries as GeoJSON.Feature[])[0]).toEqual({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                    [-73.021,45.02], [-73.03,45.04], [-73.03,45.045]]
            },
            properties: expect.objectContaining({
                action: 'ride',
                routingMode: 'transit',
                mode: 'bus',
                internalId: odTrip.attributes.internal_id
            })
        });
        expect((result.geometries as GeoJSON.Feature[])[1]).toEqual({
            type: 'Feature',
            geometry: walkingRouteResult.routes[0].geometry,
            properties: expect.objectContaining({
                mode: 'walking',
                routingMode: 'walking'
            })
        });
        expect((result.geometries as GeoJSON.Feature[])[2]).toEqual({
            type: 'Feature',
            geometry: cyclingRouteResult.routes[0].geometry,
            properties: expect.objectContaining({
                mode: 'cycling',
                routingMode: 'cycling'
            })
        })
    });

    test('No routing found', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                )
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            exportCsv: true,
            exportCsvDetailed: false,
            withGeometries: true,
            reverseOD: false,
        });
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeDefined();
        expect(result.result).toBeUndefined;
        expect(result.csv).toBeDefined();
        expect((result.geometries as GeoJSON.Feature[]).length).toEqual(0);
    });
});

test('Test reverse OD', async () => {
    // The returned data has no relation with the query, it is the same as before, nothing to test here, just that the parameters are right
    const routingAttributes = _cloneDeep(transitRoutingAttributes);
    routingAttributes.routingModes = ['transit'];
    const routing = new TransitRouting(routingAttributes);
    const resultByMode = { transit:
        new TransitRoutingResult({
            origin: origin,
            destination: destination,
            paths: simplePathResult.routes,
            maxWalkingTime: 300
        })
    };
    calculateMock.mockResolvedValue(resultByMode);

    const result = await routeOdTrip(odTrip, {
        routing,
        odTripIndex: 0,
        odTripsCount: 1,
        exportCsv: true,
        exportCsvDetailed: false,
        withGeometries: false,
        reverseOD: true,
    });
    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({
        _attributes: expect.objectContaining({
            originGeojson: destination,
            destinationGeojson: origin
        })
    }), false, expect.anything());
});
