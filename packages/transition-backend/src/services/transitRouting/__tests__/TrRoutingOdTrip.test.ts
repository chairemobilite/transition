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
import { TestUtils } from 'chaire-lib-common/lib/test';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { UnimodalRouteCalculationResult } from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ErrorCodes } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { TrRoutingBoardingStep, TrRoutingUnboardingStep, TrRoutingWalkingStep } from 'chaire-lib-common/lib/api/TrRouting';
import Path from 'transition-common/src/services/path/Path';
import PathCollection from 'transition-common/lib/services/path/PathCollection';

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

const origin = TestUtils.makePoint(simplePathResult.path.origin);
const destination = TestUtils.makePoint(simplePathResult.path.destination);
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
                hasAlternatives: false,
                paths: [simplePathResult.path],
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
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(1);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${simplePathResult.path.origin[0]},${simplePathResult.path.origin[1]},` +
            `${simplePathResult.path.destination[0]},${simplePathResult.path.destination[1]},` +
            `,,success,${simplePathResult.path.departureTime},` +
            `${simplePathResult.path.departureTimeSeconds},${simplePathResult.path.arrivalTime},${simplePathResult.path.arrivalTimeSeconds},` +
            `${simplePathResult.path.initialDepartureTime},${simplePathResult.path.initialDepartureTimeSeconds},${simplePathResult.path.initialLostTimeAtDepartureMinutes},` +
            `${simplePathResult.path.initialLostTimeAtDepartureSeconds},${simplePathResult.path.totalTravelTimeMinutes},${simplePathResult.path.totalTravelTimeSeconds},` +
            `${simplePathResult.path.totalDistanceMeters},${simplePathResult.path.totalInVehicleTimeMinutes},${simplePathResult.path.totalInVehicleTimeSeconds},` +
            `${simplePathResult.path.totalInVehicleDistanceMeters},${simplePathResult.path.totalNonTransitTravelTimeMinutes},${simplePathResult.path.totalNonTransitTravelTimeSeconds},` +
            `${simplePathResult.path.totalNonTransitDistanceMeters},${simplePathResult.path.numberOfBoardings},${simplePathResult.path.numberOfTransfers},` +
            `${simplePathResult.path.transferWalkingTimeMinutes},${simplePathResult.path.transferWalkingTimeSeconds},${simplePathResult.path.transferWalkingDistanceMeters},` +
            `${simplePathResult.path.accessTravelTimeMinutes},${simplePathResult.path.accessTravelTimeSeconds},${simplePathResult.path.accessDistanceMeters},` +
            `${simplePathResult.path.egressTravelTimeMinutes},${simplePathResult.path.egressTravelTimeSeconds},${simplePathResult.path.egressDistanceMeters},` +
            `${simplePathResult.path.nearestNetworkNodeOriginDistanceMeters || ''},${simplePathResult.path.nearestNetworkNodeDestinationDistanceMeters || ''},${simplePathResult.path.transferWaitingTimeMinutes},` +
            `${simplePathResult.path.transferWaitingTimeSeconds},${simplePathResult.path.firstWaitingTimeMinutes},${simplePathResult.path.firstWaitingTimeSeconds},` +
            `${simplePathResult.path.totalWaitingTimeMinutes},${simplePathResult.path.totalWaitingTimeSeconds},` +
            `,${(simplePathResult.path.steps[1] as TrRoutingBoardingStep).lineUuid},${(simplePathResult.path.steps[1] as TrRoutingBoardingStep).mode},access210s262m|wait180s|ride391s1426m|egress753s998m`
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
                hasAlternatives: false,
                paths: [simplePathResult.path],
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
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(1);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` + 
            `${simplePathResult.path.origin[0]},${simplePathResult.path.origin[1]},` +
            `${simplePathResult.path.destination[0]},${simplePathResult.path.destination[1]},` +
            `,,success,${simplePathResult.path.departureTime},` +
            `${simplePathResult.path.departureTimeSeconds},${simplePathResult.path.arrivalTime},${simplePathResult.path.arrivalTimeSeconds},` +
            `${simplePathResult.path.initialDepartureTime},${simplePathResult.path.initialDepartureTimeSeconds},${simplePathResult.path.initialLostTimeAtDepartureMinutes},` +
            `${simplePathResult.path.initialLostTimeAtDepartureSeconds},${simplePathResult.path.totalTravelTimeMinutes},${simplePathResult.path.totalTravelTimeSeconds},` +
            `${simplePathResult.path.totalDistanceMeters},${simplePathResult.path.totalInVehicleTimeMinutes},${simplePathResult.path.totalInVehicleTimeSeconds},` +
            `${simplePathResult.path.totalInVehicleDistanceMeters},${simplePathResult.path.totalNonTransitTravelTimeMinutes},${simplePathResult.path.totalNonTransitTravelTimeSeconds},` +
            `${simplePathResult.path.totalNonTransitDistanceMeters},${simplePathResult.path.numberOfBoardings},${simplePathResult.path.numberOfTransfers},` +
            `${simplePathResult.path.transferWalkingTimeMinutes},${simplePathResult.path.transferWalkingTimeSeconds},${simplePathResult.path.transferWalkingDistanceMeters},` +
            `${simplePathResult.path.accessTravelTimeMinutes},${simplePathResult.path.accessTravelTimeSeconds},${simplePathResult.path.accessDistanceMeters},` +
            `${simplePathResult.path.egressTravelTimeMinutes},${simplePathResult.path.egressTravelTimeSeconds},${simplePathResult.path.egressDistanceMeters},` +
            `${simplePathResult.path.nearestNetworkNodeOriginDistanceMeters || ''},${simplePathResult.path.nearestNetworkNodeDestinationDistanceMeters || ''},${simplePathResult.path.transferWaitingTimeMinutes},` +
            `${simplePathResult.path.transferWaitingTimeSeconds},${simplePathResult.path.firstWaitingTimeMinutes},${simplePathResult.path.firstWaitingTimeSeconds},` +
            `${simplePathResult.path.totalWaitingTimeMinutes},${simplePathResult.path.totalWaitingTimeSeconds},` +
            `,${(simplePathResult.path.steps[1] as TrRoutingBoardingStep).lineUuid},${(simplePathResult.path.steps[1] as TrRoutingBoardingStep).mode},access210s262m|wait180s|ride391s1426m|egress753s998m,`+
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
                hasAlternatives: true,
                paths: alternativesResult.alternatives,
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
        expect(result.csvDetailed).toBeUndefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csv as string[]).length).toEqual(2);
        expect((result.csv as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${simplePathResult.path.origin[0]},${simplePathResult.path.origin[1]},` +
            `${simplePathResult.path.destination[0]},${simplePathResult.path.destination[1]},` +
            `1,2,success,${simplePathResult.path.departureTime},` +
            `${simplePathResult.path.departureTimeSeconds},${simplePathResult.path.arrivalTime},${simplePathResult.path.arrivalTimeSeconds},` +
            `${simplePathResult.path.initialDepartureTime},${simplePathResult.path.initialDepartureTimeSeconds},${simplePathResult.path.initialLostTimeAtDepartureMinutes},` +
            `${simplePathResult.path.initialLostTimeAtDepartureSeconds},${simplePathResult.path.totalTravelTimeMinutes},${simplePathResult.path.totalTravelTimeSeconds},` +
            `${simplePathResult.path.totalDistanceMeters},${simplePathResult.path.totalInVehicleTimeMinutes},${simplePathResult.path.totalInVehicleTimeSeconds},` +
            `${simplePathResult.path.totalInVehicleDistanceMeters},${simplePathResult.path.totalNonTransitTravelTimeMinutes},${simplePathResult.path.totalNonTransitTravelTimeSeconds},` +
            `${simplePathResult.path.totalNonTransitDistanceMeters},${simplePathResult.path.numberOfBoardings},${simplePathResult.path.numberOfTransfers},` +
            `${simplePathResult.path.transferWalkingTimeMinutes},${simplePathResult.path.transferWalkingTimeSeconds},${simplePathResult.path.transferWalkingDistanceMeters},` +
            `${simplePathResult.path.accessTravelTimeMinutes},${simplePathResult.path.accessTravelTimeSeconds},${simplePathResult.path.accessDistanceMeters},` +
            `${simplePathResult.path.egressTravelTimeMinutes},${simplePathResult.path.egressTravelTimeSeconds},${simplePathResult.path.egressDistanceMeters},` +
            `${simplePathResult.path.nearestNetworkNodeOriginDistanceMeters || ''},${simplePathResult.path.nearestNetworkNodeDestinationDistanceMeters || ''},${simplePathResult.path.transferWaitingTimeMinutes},` +
            `${simplePathResult.path.transferWaitingTimeSeconds},${simplePathResult.path.firstWaitingTimeMinutes},${simplePathResult.path.firstWaitingTimeSeconds},` +
            `${simplePathResult.path.totalWaitingTimeMinutes},${simplePathResult.path.totalWaitingTimeSeconds},` +
            `,${(simplePathResult.path.steps[1] as TrRoutingBoardingStep).lineUuid},${(simplePathResult.path.steps[1] as TrRoutingBoardingStep).mode},access210s262m|wait180s|ride391s1426m|egress753s998m,`+
            `${walkingRouteResult.routes[0].duration},${walkingRouteResult.routes[0].distance},` +
            `${cyclingRouteResult.routes[0].duration},${cyclingRouteResult.routes[0].distance}`
        );
        expect((result.csv as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},` +
            `${transferPathResult.path.origin[0]},${transferPathResult.path.origin[1]},` +
            `${transferPathResult.path.destination[0]},${transferPathResult.path.destination[1]},` +
            `2,2,success,${transferPathResult.path.departureTime},` +
            `${transferPathResult.path.departureTimeSeconds},${transferPathResult.path.arrivalTime},${transferPathResult.path.arrivalTimeSeconds},` +
            `${transferPathResult.path.initialDepartureTime},${transferPathResult.path.initialDepartureTimeSeconds},${transferPathResult.path.initialLostTimeAtDepartureMinutes},` +
            `${transferPathResult.path.initialLostTimeAtDepartureSeconds},${transferPathResult.path.totalTravelTimeMinutes},${transferPathResult.path.totalTravelTimeSeconds},` +
            `${transferPathResult.path.totalDistanceMeters},${transferPathResult.path.totalInVehicleTimeMinutes},${transferPathResult.path.totalInVehicleTimeSeconds},` +
            `${transferPathResult.path.totalInVehicleDistanceMeters},${transferPathResult.path.totalNonTransitTravelTimeMinutes},${transferPathResult.path.totalNonTransitTravelTimeSeconds},` +
            `${transferPathResult.path.totalNonTransitDistanceMeters},${transferPathResult.path.numberOfBoardings},${transferPathResult.path.numberOfTransfers},` +
            `${transferPathResult.path.transferWalkingTimeMinutes},${transferPathResult.path.transferWalkingTimeSeconds},${transferPathResult.path.transferWalkingDistanceMeters},` +
            `${transferPathResult.path.accessTravelTimeMinutes},${transferPathResult.path.accessTravelTimeSeconds},${transferPathResult.path.accessDistanceMeters},` +
            `${transferPathResult.path.egressTravelTimeMinutes},${transferPathResult.path.egressTravelTimeSeconds},${transferPathResult.path.egressDistanceMeters},` +
            `${transferPathResult.path.nearestNetworkNodeOriginDistanceMeters || ''},${transferPathResult.path.nearestNetworkNodeDestinationDistanceMeters || ''},${transferPathResult.path.transferWaitingTimeMinutes},` +
            `${transferPathResult.path.transferWaitingTimeSeconds},${transferPathResult.path.firstWaitingTimeMinutes},${transferPathResult.path.firstWaitingTimeSeconds},` +
            `${transferPathResult.path.totalWaitingTimeMinutes},${transferPathResult.path.totalWaitingTimeSeconds},` +
            `,${(transferPathResult.path.steps[1] as TrRoutingBoardingStep).lineUuid}|${(transferPathResult.path.steps[4] as TrRoutingBoardingStep).lineUuid},` +
            `${(transferPathResult.path.steps[1] as TrRoutingBoardingStep).mode}|${(transferPathResult.path.steps[4] as TrRoutingBoardingStep).mode},` +
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
                hasAlternatives: false,
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
            `${simplePathResult.path.origin[1]},${simplePathResult.path.origin[0]},` +
            `${simplePathResult.path.destination[1]},${simplePathResult.path.destination[0]},` +
            `,,TRROUTING_NO_ROUTING_FOUND,,` +
            `,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,`+
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
                hasAlternatives: false,
                paths: [simplePathResult.path],
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
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(4);
        const accessStep = simplePathResult.path.steps[0] as TrRoutingWalkingStep;
        const boardingStep = simplePathResult.path.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = simplePathResult.path.steps[2] as TrRoutingUnboardingStep;
        const egressStep = simplePathResult.path.steps[3] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,1,${simplePathResult.path.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,2,${simplePathResult.path.steps[1].action},` +
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
        expect((result.csvDetailed as string[])[2]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,3,${simplePathResult.path.steps[2].action},` +
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
        expect((result.csvDetailed as string[])[3]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,4,${simplePathResult.path.steps[3].action},` +
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
                hasAlternatives: false,
                paths: [simplePathResult.path],
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
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(4);
        const accessStep = simplePathResult.path.steps[0] as TrRoutingWalkingStep;
        const boardingStep = simplePathResult.path.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = simplePathResult.path.steps[2] as TrRoutingUnboardingStep;
        const egressStep = simplePathResult.path.steps[3] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,1,${simplePathResult.path.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,2,${simplePathResult.path.steps[1].action},` +
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
        expect((result.csvDetailed as string[])[2]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,3,${simplePathResult.path.steps[2].action},` +
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
        expect((result.csvDetailed as string[])[3]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,4,${simplePathResult.path.steps[3].action},` +
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
                hasAlternatives: true,
                paths: alternativesResult.alternatives,
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
        expect(result.csvDetailed).toBeDefined();
        expect(result.geometries).toBeUndefined();
        expect(result.result).toEqual(resultByMode.transit);
        expect(result.csv).toBeDefined();
        expect((result.csvDetailed as string[]).length).toEqual(11);

        // Validate first path
        const accessStep = simplePathResult.path.steps[0] as TrRoutingWalkingStep;
        const boardingStep = simplePathResult.path.steps[1] as TrRoutingBoardingStep;
        const unboardingStep = simplePathResult.path.steps[2] as TrRoutingUnboardingStep;
        const egressStep = simplePathResult.path.steps[3] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[0]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,1,${simplePathResult.path.steps[0].action},` +
            `${accessStep.type},${accessStep.travelTimeSeconds},${accessStep.travelTimeMinutes},` +
            `${accessStep.distanceMeters},${accessStep.departureTime},${accessStep.arrivalTime},` +
            `${accessStep.departureTimeSeconds},${accessStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStep.readyToBoardAt},${accessStep.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[1]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,2,${simplePathResult.path.steps[1].action},` +
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
        expect((result.csvDetailed as string[])[2]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,3,${simplePathResult.path.steps[2].action},` +
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
        expect((result.csvDetailed as string[])[3]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},1,4,${simplePathResult.path.steps[3].action},` +
        `${egressStep.type},${egressStep.travelTimeSeconds},${egressStep.travelTimeMinutes},` +
        `${egressStep.distanceMeters},${egressStep.departureTime},${egressStep.arrivalTime},` +
        `${egressStep.departureTimeSeconds},${egressStep.arrivalTimeSeconds},` +
        `,,,,,,,,,,,,,,,,,,,,,,,,`
        );

        // Validate second path, with transfer steps
        const accessStepSeq2 = transferPathResult.path.steps[0] as TrRoutingWalkingStep;
        const boardingStep1Seq2 = transferPathResult.path.steps[1] as TrRoutingBoardingStep;
        const unboardingStep1Seq2 = transferPathResult.path.steps[2] as TrRoutingUnboardingStep;
        const transferStep = transferPathResult.path.steps[3] as TrRoutingWalkingStep;
        const boardingStep2Seq2 = transferPathResult.path.steps[4] as TrRoutingBoardingStep;
        const unboardingStep2Seq2 = transferPathResult.path.steps[5] as TrRoutingUnboardingStep;
        const egressStepSeq2 = transferPathResult.path.steps[6] as TrRoutingWalkingStep;
        expect((result.csvDetailed as string[])[4]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,1,${transferPathResult.path.steps[0].action},` +
            `${accessStepSeq2.type},${accessStepSeq2.travelTimeSeconds},${accessStepSeq2.travelTimeMinutes},` +
            `${accessStepSeq2.distanceMeters},${accessStepSeq2.departureTime},${accessStepSeq2.arrivalTime},` +
            `${accessStepSeq2.departureTimeSeconds},${accessStepSeq2.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,` +
            `${accessStepSeq2.readyToBoardAt},${accessStepSeq2.readyToBoardAtSeconds}`
        );
        expect((result.csvDetailed as string[])[5]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,2,${transferPathResult.path.steps[1].action},` +
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
        expect((result.csvDetailed as string[])[6]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,3,${transferPathResult.path.steps[2].action},` +
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
        expect((result.csvDetailed as string[])[7]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,4,${transferPathResult.path.steps[3].action},` +
            `${transferStep.type},${transferStep.travelTimeSeconds},${transferStep.travelTimeMinutes},` +
            `${transferStep.distanceMeters},${transferStep.departureTime},${transferStep.arrivalTime},` +
            `${transferStep.departureTimeSeconds},${transferStep.arrivalTimeSeconds},` +
            `,,,,,,,,,,,,,,,,,,,,,,,,`
        );
        expect((result.csvDetailed as string[])[8]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,5,${transferPathResult.path.steps[4].action},` +
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
        expect((result.csvDetailed as string[])[9]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,6,${transferPathResult.path.steps[5].action},` +
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
        expect((result.csvDetailed as string[])[10]).toEqual(`${odTrip.getId()},${odTrip.attributes.internal_id},2,7,${transferPathResult.path.steps[6].action},` +
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
                hasAlternatives: false,
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
        id: (simplePathResult.path.steps[1] as TrRoutingBoardingStep).pathUuid,
        geography: {
            type: 'LineString',
            coordinates: [[-73,45], [-73.01,45.001], [-73.015,45.001], [-73.015,45.01], [-73.02,45.015],
                [-73.021,45.02], [-73.03,45.04], [-73.03,45.045], [-73.035,45.05], [-73.04,45.06] ]
        },
        direction: 'outbound',
        line_id: (simplePathResult.path.steps[1] as TrRoutingBoardingStep).lineUuid,
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
                hasAlternatives: false,
                paths: [simplePathResult.path],
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
                hasAlternatives: false,
                paths: [simplePathResult.path],
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
                hasAlternatives: false,
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
            hasAlternatives: false,
            paths: [simplePathResult.path],
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
